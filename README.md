# BandUp AI

IELTS and SAT preparation platform with AI-powered study assistance, practice tests, and learning materials.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.13, SQLAlchemy, PostgreSQL |
| AI | Google Gemini 2.0 Flash |
| Payments | Stripe |
| Materials | SQLite (Cambridge IELTS books 4–20, 2 500+ SAT questions) |

---

## Project Structure

```
bandup-ai/
├── backend/          # FastAPI app
│   ├── app/
│   │   ├── api/      # Route handlers (auth, ielts, sat, ai, payments, promo, admin)
│   │   ├── core/     # Config, settings
│   │   └── db/       # DB functions and materials layer
│   ├── tests/        # pytest test suite
│   └── scripts/      # seed.py and other utilities
└── band-buddy-connect/   # React frontend
    └── src/
        ├── pages/    # Route-level page components
        ├── components/  # Shared UI (Sidebar, DashboardLayout, ChatAssistant, ...)
        ├── hooks/    # useAuth and other custom hooks
        └── services/ # API client wrappers
```

---

## Local Development

### Prerequisites

- Python 3.13+, [`uv`](https://github.com/astral-sh/uv)
- Node.js 20+, npm
- PostgreSQL running locally
- Gemini API key (for AI chat and essay evaluation)
- Stripe account (optional — for payments)

### 1. Backend

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env

# Install dependencies and run migrations
uv run alembic upgrade head

# Start the server
cd app
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`.  
Interactive docs: `http://127.0.0.1:8000/docs`

**Environment variables** (see `backend/.env.example`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google AI Studio key for chat + evaluation |
| `STRIPE_SECRET_KEY` | Payments only | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Payments only | Stripe webhook signing secret |
| `STRIPE_MONTHLY_PRICE_ID` | Payments only | Stripe price ID for monthly plan |
| `STRIPE_YEARLY_PRICE_ID` | Payments only | Stripe price ID for yearly plan |
| `PROMO_CODE` | No | Promo code string (default: `bird-grain-ocean`) |
| `SAT_REQUIRES_SUBSCRIPTION` | No | Gate SAT behind paywall (`false` by default) |

### 2. Frontend

```bash
cd band-buddy-connect

npm install

# Start dev server (proxies /api and /auth to backend)
VITE_DEV_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

Frontend runs at `http://127.0.0.1:8080`.

### 3. Materials databases

IELTS and SAT content is served from two SQLite files. Place them at:

```
backend/materials/ielts.db   # Cambridge IELTS 4–20, writing essays, speaking questions
backend/materials/sat.db     # 2 500+ SAT Math and English questions
```

Override paths via `IELTS_DB_PATH` / `SAT_DB_PATH` in `.env` if needed.

---

## Running Tests

```bash
cd backend
uv run pytest tests/ -v
```

---

## Key Features

- **IELTS practice** — Listening, Reading, Writing, Speaking with real Cambridge test content
- **SAT practice** — Math and English question banks with difficulty filters and domain breakdowns
- **AI Study Assistant** — Gemini-powered chat with subject-specific tutoring (IELTS + SAT)
- **Floating chat widget** — accessible from every authenticated page via `DashboardLayout`
- **Dedicated AI chat page** (`/ai-chat`) — full-page interface with per-subject conversation history
- **Subscription payments** — Stripe checkout (monthly / yearly plans)
- **Promo codes** — one-time full-access grants
- **Admin panel** — user and subscription management

## API Health Check

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","db":"connected","sqlite":"accessible","uptime":42.0}
```
