# CLAUDE.md — BandUp AI session context

## Project overview

IELTS + SAT prep platform.

- **Frontend**: `band-buddy-connect/` — React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Backend**: `backend/` — FastAPI, Python 3.13, asyncpg/PostgreSQL, uses **`uv`** (never bare `pip`/`python`)
- **AI**: Google Gemini 2.0 Flash (new SDK: `google.genai`, *not* deprecated `google.generativeai`)
- **Payments**: Stripe
- **Materials**: SQLite — Cambridge IELTS 4–20, 2500+ SAT questions

Legacy code lives in `band-buddy-connect-old/` (do not modify; reference only).

---

## Domains / Deployment

| Env | Frontend | Backend |
|---|---|---|
| Dev | `http://127.0.0.1:8080` (vite) | `http://127.0.0.1:5000` (uvicorn) |
| Prod | `https://bandup-ai.com` | `https://backend.bandup-ai.com` |

Deploy target: **Raspberry Pi** running nginx + uvicorn + PostgreSQL.

Use `./start.sh` (dev) or `./start.sh --prod` (build frontend, install nginx configs, start backend).

---

## Key conventions

- **Always use `uv run`, `uv add`** — never bare `pip install` or `python …`
- Backend is started from `backend/app/` directory: `uv run uvicorn main:app …`
- Backend env loaded from `backend/.env` (recently fixed — previously read from frontend `.env` by mistake)
- Auth pattern: Bearer token (UUID) in `Authorization` header, validated by `api/deps.py:get_current_user`
- DB tables auto-created via `CREATE TABLE IF NOT EXISTS` in `Users_DB.initialize()` — **no alembic**

---

## Recent work (most recent first)

### Production deploy setup (commit `a5714a0`, hotfix `6802cf8`)
- Added `FRONTEND_URL` config var (separate from `BASE_URL`)
- Fixed Stripe redirect URLs in `payments.py` — were pointing to backend domain
- Fixed 8 admin routes in `admin/admin.py` returning `(dict, 500)` tuples (FastAPI silently treated these as 200 OK)
- Added `SecurityHeadersMiddleware` (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
- Restricted CORS `allow_headers` from `["*"]` to explicit list
- Disabled `/docs` and `/redoc` in production
- Created `nginx/bandup-ai.com.conf` and `nginx/backend.bandup-ai.com.conf`
- Created `band-buddy-connect/.env.production` with `VITE_API_BASE_URL=https://backend.bandup-ai.com`
- Updated `start.sh` with `--prod` flag and absolute `LOG_DIR` path
- Removed bogus `alembic upgrade head` step (project doesn't use alembic)

### AI chat assistant (earlier in session)
- Backend endpoint: `POST /api/chat/message` in `backend/app/api/ai/main.py`
  - Uses `google.genai` (new SDK), NOT `google.generativeai`
  - Requires auth via `Depends(get_current_user)`
  - Reads `GEMINI_API_KEY` from `backend/.env`
- Frontend has TWO entry points:
  - **Floating widget**: `src/components/ChatAssistant.tsx` — injected in `DashboardLayout.tsx`, visible on all authenticated pages (aria-label `"Open AI assistant"`)
  - **Dedicated page**: `src/pages/AIChatPage.tsx` at route `/ai-chat` — 6 subject tabs with per-tab history
- Sidebar link added under "AI ASSISTANT" section (uses `Languages` lucide icon — was originally `Spellcheck` which doesn't exist)

### Payments / billing UI
- `pages/PricingPage.tsx` — calls `POST /payments/create-checkout-session` with `{price_id}` and redirects to Stripe `checkout_url`
- `pages/Settings.tsx` — fetches `/payments/subscription-status` and `/payments/history`, displays in Subscription card

### Audit infrastructure
- `band-buddy-connect/audit.mjs` — playwright visual audit, checks all pages in light/dark × desktop/mobile, verifies floating chat button present on authenticated pages and absent on public pages

---

## Known gotchas

1. **Port collision on dev machine**: A Docker container was sometimes seen on port 8000 (accepting TCP but resetting HTTP). Pi deployment won't have this.

2. **`google.generativeai` is deprecated** — only use `google.genai` for new code. Old endpoints (essay/speaking evaluation) in `ai/main.py` still use the old SDK; haven't been migrated because they're separate features and currently work.

3. **Module-level DB pool pattern** (`users = Users_DB(DSN)` at top of multiple route files) — each route does `await users.initialize()` then `await users.close()`. Fragile because `close()` destroys the pool. Not fixed yet; flagged but works in practice because `initialize()` is idempotent and creates a new pool.

4. **Tokens never expire** — UUID sessions persist until explicit logout. Future improvement.

5. **`band-buddy-connect-old/`** is the legacy project — used as a reference for porting features. Don't modify it.

6. **Vite proxy default** in dev mode is `http://127.0.0.1:5000`. Override with `VITE_DEV_PROXY_TARGET` env var if backend is elsewhere.

---

## Outstanding from `FRONTEND_TODO.md`

- [ ] Update reading passages UI to use `totalPages` from API response
- [ ] Optional: health check banner on app load
- [ ] Long-term: migrate dashboard/settings from `?email=` query param to token-based auth

---

## Quick commands

```bash
# Dev mode (Vite + uvicorn, hot reload)
./start.sh

# Production deploy (build frontend, install nginx, reload)
./start.sh --prod

# Custom ports
./start.sh --port-backend 8000 --port-frontend 3000

# Visual audit (requires both servers running)
cd band-buddy-connect && node audit.mjs

# TypeScript check
cd band-buddy-connect && npx tsc --noEmit

# Backend tests
cd backend && uv run pytest tests/ -v

# Manual SSL setup (first prod deploy only)
sudo certbot --nginx -d bandup-ai.com -d www.bandup-ai.com
sudo certbot --nginx -d backend.bandup-ai.com
```

---

## Required `backend/.env` keys

```
IS_ON_PROD=true                                  # prod only
BASE_URL=https://backend.bandup-ai.com           # prod
FRONTEND_URL=https://bandup-ai.com               # prod — used for Stripe redirects
ALLOWED_ORIGINS=https://bandup-ai.com,https://www.bandup-ai.com   # prod CORS allowlist

DATABASE_URL=postgresql://fisuan:1337@localhost:5432/bandup_db
GEMINI_API_KEY=AIza...                           # required for AI chat
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
PROMO_CODE=bird-grain-ocean
SAT_REQUIRES_SUBSCRIPTION=false
```
