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
const API_KEY = process.env.ANTHROPIC_API_KEY;const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

app.post("/generate-ad-image", async (req, res) => { const ip = req.ip || req.socket.remoteAddress || "unknown"; if (rateLimited(ip)) { return res.status(429).json({ error: "Too many requests, slow down." }); } if (!OPENAI_API_KEY) { return res.status(503).json({ error: "Image generation not configured (OPENAI_API_KEY is empty)." }); } const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.slice(0, 2000) : ""; if (!prompt) { return res.status(400).json({ error: "Missing 'prompt' string in request body." }); } try { const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + OPENAI_API_KEY }, body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "low", n: 1 }) }); if (!r.ok) { const errText = await r.text().catch(() => ""); console.error("OpenAI image call failed:", r.status, errText); return res.status(502).json({ error: "Image generation failed upstream." }); } const data = await r.json(); const b64 = data && data.data && data.data[0] && data.data[0].b64_json; if (!b64) { return res.status(502).json({ error: "Image generation returned no image." }); } res.json({ b64 }); } catch (err) { console.error("OpenAI image call failed:", err && err.message || err); res.status(502).json({ error: "Image generation failed upstream." }); } }); app.post("/generate-voiceover", async (req, res) => { const ip = req.ip || req.socket.remoteAddress || "unknown"; if (rateLimited(ip)) { return res.status(429).json({ error: "Too many requests, slow down." }); } if (!OPENAI_API_KEY) { return res.status(503).json({ error: "Voiceover not configured (OPENAI_API_KEY is empty)." }); } const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 2000) : ""; if (!text) { return res.status(400).json({ error: "Missing 'text' string in request body." }); } const voice = typeof req.body?.voice === "string" && req.body.voice ? req.body.voice : "alloy"; try { const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + OPENAI_API_KEY }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text, response_format: "mp3" }) }); if (!r.ok) { const errText = await r.text().catch(() => ""); console.error("OpenAI TTS call failed:", r.status, errText); return res.status(502).json({ error: "Voiceover generation failed upstream." }); } const buf = Buffer.from(await r.arrayBuffer()); const b64 = buf.toString("base64"); res.json({ b64, mime: "audio/mpeg" }); } catch (err) { console.error("OpenAI TTS call failed:", err && err.message || err); res.status(502).json({ error: "Voiceover generation failed upstream." }); } }); app.listen(PORT, () => {
  console.log(`Adworks AI proxy listening on :${PORT}`);
});
