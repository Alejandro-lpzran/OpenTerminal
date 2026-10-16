# Deploying to Vercel (free)

OpenTerminal runs as **two Vercel projects** from the same repo. Both fit Vercel's free Hobby plan:

| Project | Root Directory | What it is |
|---|---|---|
| API | `server` | The Express API. It runs as one Vercel Function. It's stateless: it only fetches and caches public market data. |
| Web | `web` | The Next.js app. The browser only talks to this project. Its `/api/*` route forwards requests to the API project on the server side. |

No database is needed. Each visitor's workspace layout, watchlist and portfolios are saved in their own browser (`localStorage`).

Each project's `vercel.json` installs dependencies from the repo root, so the shared lockfile and its security overrides apply. Keep **"Include files outside the root directory"** turned on in both projects (it's the default).

## 1. Deploy the API

1. In Vercel, choose **Add New → Project**, import your fork, and set **Root Directory** to `server`. Vercel detects Express.
2. Deploy. You don't need any environment variables.
3. Check it: `https://<api-project>.vercel.app/api/status` should return `{"ok":true,...}`.

Optional environment variable:

| Variable | Value |
|---|---|
| `SEC_EDGAR_CONTACT` | A contact email. SEC asks for one in the User-Agent of requests to its insider-trading data. |

## 2. Deploy the web app

1. **Add New → Project** again, import the same fork, and set **Root Directory** to `web`.
2. Add one environment variable:

   | Variable | Value |
   |---|---|
   | `API_URL` | The API project's URL from step 1, e.g. `https://openterminal-api.vercel.app` |

3. Deploy.

If `API_URL` is missing, every `/api/*` request returns a 500 that names the missing variable. If the API is down, requests return a 502 `API server unreachable`.

## The AI assistant

The assistant is hidden by default because Anthropic API calls are billed. Its code is still in place. To turn it on:

- On the **API** project, set `ANTHROPIC_API_KEY` and an `API_KEY` (any long random string, e.g. from `openssl rand -hex 24`).
- On the **web** project, set the same `API_KEY` and `NEXT_PUBLIC_AI_ENABLED=1`, then redeploy. This variable is read at build time.

## Limits to know about

- **Shared rate limit.** The API allows 240 market-data requests and 10 AI requests per minute. It can't tell visitors apart through the web proxy, so all visitors share that budget, and each Vercel instance counts separately. That's plenty for a demo.
- **Some data sources may block cloud servers.** A few free sources rate-limit or block datacenter IPs. Every endpoint falls back to other sources, but if a widget stays empty on Vercel while it works locally, that's the likely reason.
- **Caches are per instance.** The API's in-memory cache resets when Vercel starts a fresh instance, so the first request after idle time is slower.

## Local and Docker setups

Nothing changes. `npm run dev` and `docker compose up` still work with no configuration.
