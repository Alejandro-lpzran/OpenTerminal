# Deploying to Vercel

OpenTerminal is two services:

| Service | Where it runs | Why |
|---|---|---|
| `web/` (Next.js) | **Vercel** | The browser only talks to `web`; its `/api/*` route proxies to the API server-side and attaches the API key. |
| `server/` (Express) | **A host with a persistent disk** (Railway, Render, Fly.io, a VPS, …) | Portfolios live in a SQLite file, and the API is a long-running process with in-memory caches and rate limits. Vercel functions have a read-only, ephemeral filesystem, so the API can't run there as-is. |

Deploy the API first, because the web app needs its URL.

## 1. Generate a shared API key

```sh
openssl rand -hex 24
```

Use this same value for `API_KEY` on both services. It never reaches the browser.

## 2. Deploy the API

Use the existing Dockerfile. Build context: **repo root**. Dockerfile path: **`server/Dockerfile`**.

Attach a persistent volume mounted at **`/app/data`**. Without it, portfolios are wiped on every redeploy.

Environment variables:

| Variable | Value |
|---|---|
| `API_KEY` | The key from step 1. **Required.** Without it, the API generates its own key, which the web app can't read. |
| `API_HOST` | `0.0.0.0`. Required so the platform can reach the container (the default only listens on localhost). |
| `WEB_ORIGIN` | Your Vercel URL, e.g. `https://openterminal.vercel.app` |
| `ANTHROPIC_API_KEY` | Optional. Turns on the AI assistant. |
| `SEC_EDGAR_CONTACT` | Optional but recommended. SEC asks for a contact email in the User-Agent. |

`PORT` is read automatically if your platform injects it. Otherwise the API listens on `4000` (or `API_PORT`).

Leave `TRUST_PROXY` **unset**. The API is publicly reachable, so anyone could send a forged `X-Forwarded-For` header and get around the per-IP rate limits. With it unset, every request that comes through Vercel shares one rate-limit bucket (240 market requests/min and 10 AI requests/min in total). That's fine for personal use.

Check it with `curl https://<your-api-host>/api/status`. It should return `{"ok":true,...}`.

## 3. Deploy the web app to Vercel

1. In Vercel, choose **Add New → Project** and import your fork.
2. Set **Root Directory** to `web`. Leave **"Include files outside the root directory"** on (the default). `web/vercel.json` installs dependencies from the repo root, so the shared lockfile and its security overrides apply.
3. Add the environment variables:

   | Variable | Value |
   |---|---|
   | `API_URL` | Your API's public URL with no trailing path, e.g. `https://openterminal-api.up.railway.app` |
   | `API_KEY` | The same key as the API |

4. Deploy.

If either variable is missing, every `/api/*` request returns a 500 that names the missing variable. If the API is down, requests return a 502 `API server unreachable`.

Vercel's CLI works too: `cd web && vercel` (then `vercel --prod`). Set the env vars with `vercel env add`.

## Local and Docker setups

Nothing changes. `npm run dev` and `docker compose up` still need no configuration.
