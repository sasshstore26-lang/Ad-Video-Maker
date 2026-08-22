// Adworks AI proxy
//
// Why this exists: the Android app is a static WebView (Capacitor) -- anything shipped
// inside the APK can be pulled out with a zip tool and a few minutes. If the
// ANTHROPIC_API_KEY lived in the app, anyone who installed the APK could extract it and
// run up charges on your account. This tiny server is the fix: it holds the key, the
// app calls this server over HTTPS, and this server calls Anthropic.
//
// Deploy this anywhere that can run Node (Render, Railway, Fly.io, a small VPS, etc.),
// set ANTHROPIC_API_KEY as an environment variable there (never commit it to git), and
// point the app at the deployed URL -- see ADWORKS_API_BASE_URL in apk/www/index.html.

const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error(
    "FATAL: ANTHROPIC_API_KEY is not set. Set it as an environment variable before starting the server."
    );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 20;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/generate-ad-script", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests, slow down." });
  }

         const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.slice(0, 4000) : "";
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' string in request body." });
  }

         try {
           const message = await anthropic.messages.create({
             model: "claude-sonnet-5",
             max_tokens: 1400,
             messages: [{ role: "user", content: prompt }],
           });
           const raw = message.content
           .filter((block) => block.type === "text")
           .map((block) => block.text)
           .join("");
           res.json({ raw });
         } catch (err) {
           console.error("Anthropic call failed:", err?.message || err);
           res.status(502).json({ error: "AI generation failed upstream." });
         }
});

app.listen(PORT, () => {
  console.log(`Adworks AI proxy listening on :${PORT}`);
});
