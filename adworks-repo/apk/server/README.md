# Adworks AI proxy

Holds `ANTHROPIC_API_KEY` server-side so it never ships inside the Android APK. The app
calls this server; this server calls Anthropic.

## Run locally

```bash
cd adworks-repo/apk/server
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # your real key, never committed
npm start
```

Server listens on `http://localhost:8787`. Test it:

```bash
curl -X POST http://localhost:8787/generate-ad-script \
  -H 'content-type: application/json' \
  -d '{"prompt":"Say hello in five words."}'
```

## Deploy

Any host that runs Node works. Easiest options for a solo/demo project:

- **Render** (render.com): New -> Web Service -> point at this `server/` folder ->
-   build command `npm install`, start command `npm start` -> add `ANTHROPIC_API_KEY` under
-     Environment.
- - **Railway** (railway.app): New Project -> Deploy from repo -> add `ANTHROPIC_API_KEY` as a
  -   variable.
  -   - **Fly.io**: `fly launch` from this folder, then `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`.
   
      - Whichever you use, once deployed you'll have a URL like
      - `https://adworks-ai-proxy.onrender.com`. Put that into
      - `adworks-repo/apk/www/index.html` as `ADWORKS_API_BASE_URL` (the small script tag
      - near the top of the file), then push -- the existing GitHub Actions workflow will
      - rebuild the APK pointed at your live server.
   
      - ## Security notes
   
      - - The API key lives only in this server's environment variables -- never in the app, never
        -   in git.
        -   - CORS is wide open (`cors()`) because the app calls this from a Capacitor WebView origin
            -   that isn't a normal https origin.
            -   - There's a basic in-memory per-IP rate limit (20 requests/minute) so a leaked/decompiled
                -   APK build can't be used to run up your Anthropic bill unbounded. It resets on restart --
                -     swap in Redis or similar before this handles real traffic.
                - - Anthropic model responses are treated as plain text and JSON-parsed by the app; the
                  -   server does not execute or evaluate anything from the response.
                  -   
