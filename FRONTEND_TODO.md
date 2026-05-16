# Frontend TODO — BandUp AI

_Last updated: QA pass (session 2). Ordered by priority._

---

## 1. Auth — Breaking Changes (Fix First)

### What changed
The backend now returns a proper serialized user object with an `id` field. The password hash is **no longer included** in the response.

### New login/register response shape
```json
{
  "token": "uuid-string",
  "user": {
    "id": 42,
    "name": "Aigerim",
    "email": "aigerim@example.com",
    "role": "student",
    "isAdmin": false,
    "createdAt": "2026-05-16T01:00:00"
  }
}
```

### Action items
- [ ] Update `normalizeUser()` in `useAuth.tsx` — `id` is now a number, map it as `String(rawUser.id)`
- [ ] Store `user.id` in `localStorage` so payment/settings screens can use it
- [ ] Add `POST /auth/logout` call in `logout()` function (sends `Authorization: Bearer <token>` header so the session is invalidated server-side)

---

## 2. Payments — API Contract Changed

### Old (broken) endpoints removed/changed

| Old | New | Notes |
|---|---|---|
| `POST /payments/create-checkout-session` with `{price_id, user_id}` | Same path, body is `{price_id}` only | `user_id` extracted from token |
| `POST /payments/create-subscription` with `{user_id, price_id}` | Same path, body is `{price_id}` only | Auth required |
| `GET /payments/subscription-status/{user_id}` | `GET /payments/subscription-status` | No path param; uses token |
| `POST /payments/cancel-subscription/{user_id}` | `POST /payments/cancel-subscription` | No path param; uses token |
| `GET /payments/history/{user_id}` | `GET /payments/history` | No path param; uses token |

**All payment endpoints now require `Authorization: Bearer <token>` header.** The frontend already sends this header by default via `apiClient.ts` (`withAuth: true`).

### New field in subscription-status response
```json
{
  "status": "active",
  "hasFullAccess": true,
  "subscription": { ... }
}
```
Use `hasFullAccess` to gate premium content — it's `true` if active subscription OR promo code redeemed.

### Action items
- [ ] Remove `user_id` from all payment API call bodies
- [ ] Update `PricingPage.tsx` — clicking a paid plan should call `POST /payments/create-checkout-session` with `{price_id: "price_XXXX"}` and redirect to `checkout_url`
- [ ] Add subscription status display in Settings page (fetch `GET /payments/subscription-status`)
- [ ] Add payment history display (fetch `GET /payments/history`)

---

## 3. Promo Code — New Feature

### Endpoint
```
POST /api/promo/redeem
Authorization: Bearer <token>
Content-Type: application/json

{ "code": "bird-grain-ocean" }
```

**Success (200)**
```json
{ "success": true, "message": "Promo code applied. You now have full permanent access to all materials." }
```

**Already redeemed (409)**
```json
{ "detail": "Promo code already redeemed for this account" }
```

**Wrong code (400)**
```json
{ "detail": "Invalid promo code" }
```

### Status check
```
GET /api/promo/status
Authorization: Bearer <token>

{ "hasFullAccess": true, "hasPromoAccess": true }
```

### Action items
- [ ] Add a "Promo Code" input + "Redeem" button somewhere in Settings or Pricing page
- [ ] On success, update the UI to show full-access state (re-fetch promo status or subscription status)
- [ ] On 409, show "Already redeemed" message
- [ ] On 400, show "Invalid code" message

---

## 4. SAT — New Endpoints (SAT section doesn't exist on frontend yet)

### Available endpoints

#### `GET /api/sat/questions`
```
Query params:
  section      string   "math" | "english" | "practice_test"
  domain       string   e.g. "Algebra", "Craft and Structure"
  difficulty   string   "Easy" | "Medium" | "Hard"
  limit        int      default 20, max 100
  offset       int      default 0

Response:
{
  "questions": [
    {
      "id": "sat-q-001",
      "section": "math",
      "domain": "Algebra",
      "difficulty": "Medium",
      "question_text": "If 3x + 7 = 22, what is x?",
      "paragraph": null,
      "choices": { "A": "3", "B": "5", "C": "7", "D": "9" },
      "correct_answer": "B",
      "explanation": "...",
      "visual_type": null,
      "visual_svg": null
    }
  ],
  "pagination": { "total": 2588, "limit": 20, "offset": 0, "totalPages": 130, "page": 1 }
}
```

#### `GET /api/sat/questions/random`
```
Query params:
  section      string   optional
  difficulty   string   optional
  count        int      default 10, max 50

Response: { "questions": [...], "count": 10 }
```

#### `GET /api/sat/questions/{question_id}`
Single question by ID.

#### `GET /api/sat/domains`
```json
{ "domains": [{ "section": "math", "domain": "Algebra", "count": 150 }, ...] }
```

#### `GET /api/sat/stats`
```json
{
  "total": 2588,
  "bySection": { "math": 1031, "english": 1443, "practice_test": 114 },
  "byDifficulty": { "Easy": 389, "Medium": 1443, "Hard": 642 }
}
```

### Notes on SAT question data
- `choices` is a JSON object `{"A": "...", "B": "...", "C": "...", "D": "..."}` — parse it client-side
- `question_text` and `explanation` may contain LaTeX (`\( ... \)`) — render with **KaTeX** or **MathJax**
- `visual_svg` contains inline SVG when present — render directly via `dangerouslySetInnerHTML`

### Action items
- [ ] Create `src/services/satService.ts` with typed wrappers for all SAT endpoints
- [ ] Create SAT practice pages (similar to IELTS practice pages)
- [ ] Add SAT section to sidebar/navigation
- [ ] Add LaTeX renderer (KaTeX recommended: `npm install katex`)
- [ ] Handle `visual_svg` — display inline when not null

---

## 5. IELTS Materials — New Dynamic Endpoints

The backend now serves IELTS content directly from the SQLite database (Cambridge books 4–20, 10 324 writing essays, 293 speaking questions).

### Key endpoints

#### `GET /api/ielts/materials/books`
```json
{ "books": [{ "id": 1, "book_label": "Cambridge IELTS 17", "book_number": 17 }, ...] }
```

#### `GET /api/ielts/materials/reading/passages`
```
Query: book_label, book_number, test_number, passage_number, limit, offset
Response: { "passages": [{ "id", "book_label", "test_number", "passage_number", "title" }] }
```

#### `GET /api/ielts/materials/reading/passages/{passage_id}`
Full passage text — only fetch when user opens a test.

#### `GET /api/ielts/materials/reading/questions`
```
Query: book_label, test_number, passage_number
Response: { "questions": [{ "question_number", "question_text", "question_type", "choices", "correct_answer" }] }
```

#### `GET /api/ielts/materials/writing/tasks`
```
Query: task_type (2), min_band (e.g. 7.0), limit, offset
Response: { "tasks": [{ "id", "task_type", "prompt", "band_score" }] }
```

#### `GET /api/ielts/materials/writing/tasks/{task_id}`
Full writing task with `essay` and `evaluation` fields.

#### `GET /api/ielts/materials/speaking/questions`
```
Query: part (1|2|3), topic, limit, offset
Response: { "questions": [{ "id", "part", "topic", "question", "cue_card", "answer" }] }
```

#### `GET /api/ielts/materials/listening/scripts`
```
Query: book_label, test_number, section_number
Response: { "scripts": [{ "section_number", "title", "script_text" }] }
```

### Action items
- [ ] Create `src/services/materialsService.ts`
- [ ] Update test library pages (TestLibraryReading, TestLibraryListening, etc.) to load from DB instead of static lists
- [ ] Add book selector / filter UI (books Cambridge 4–20)
- [ ] Writing sample viewer — show essay + evaluation from `GET /api/ielts/materials/writing/tasks/{id}`
- [ ] Speaking practice — load random questions by part from DB

---

## 6. Practice History — User-Scoped

### What changed
Practice attempts are now recorded under the **logged-in user's ID** instead of a shared guest account.

### Existing endpoint (unchanged)
```
GET /api/ielts/practice/{mode}/attempts?limit=10
Authorization: Bearer <token>
```

The `Authorization` header is already sent by the frontend. No URL changes needed.

### Action items
- [ ] Verify `practiceService.fetchAttemptHistory()` passes auth header (it already uses `apiRequest` with `withAuth: true` — should work)
- [ ] Confirm Dashboard shows per-user attempts after login

---

## 7. Dashboard — Email Param (Works But Fragile)

Currently the dashboard endpoint accepts `?email=...` as a query param. This still works, but it's fragile (anyone can spoof another user's email).

**Current:** `GET /api/dashboard?email=user@example.com`

### Action items
- [ ] When calling `dashboardService`, pass the logged-in user's email from `user.email` (available in `useAuth`)
- [ ] Long-term: migrate to token-based dashboard (backend change needed)

---

## 8. Settings — Email Param (Same Issue)

**Current:** `GET /api/settings/?email=...` and `PUT /api/settings/?email=...`

### Action items
- [ ] Pass `user.email` from auth context when calling settings endpoints
- [ ] Long-term: migrate to token-based settings (backend change needed)

---

## 9. Auth — Missing Logout Call

`logout()` in `useAuth.tsx` only clears `localStorage`. The session token remains valid on the backend until the DB is cleared.

### Action items
- [ ] Add `apiRequest('/auth/logout', { method: 'POST' })` inside the `logout()` function before clearing `localStorage`

---

## 10. Admin Panel — User Data Now Serialized

The `GET /admin/users/{user_id}` response now returns serialized datetime strings (ISO format) instead of raw `datetime` objects. The frontend `adminService` should handle this without changes since it was already treating them as strings.

---

## Broken Frontend↔Backend Contracts Found in Phase 1

| Contract | Status | Fix |
|---|---|---|
| `user.id` missing from login response | **Fixed** — `id` now returned | Update `normalizeUser()` in `useAuth.tsx` |
| `user.password` returned in login response | **Fixed** — password no longer returned | No frontend change needed |
| Payment endpoints required `user_id` in body | **Fixed** — extracted from token | Remove `user_id` from payment call bodies |
| Practice attempts all credited to guest | **Fixed** — uses token-authenticated user | No frontend change; just ensure auth header is sent |
| `attempts` table missing (silent DB failure) | **Fixed** — table created on startup | No frontend change |
| Webhook signature not verified | **Fixed** — `stripe.Webhook.construct_event()` | No frontend change |
| Admin auth accepted any token | **Fixed** — validates token belongs to admin | No frontend change |
| `GET /payments/subscription-status/{user_id}` | **Changed** — now `GET /payments/subscription-status` | Update call in frontend |
| `POST /payments/cancel-subscription/{user_id}` | **Changed** — now `POST /payments/cancel-subscription` | Update call in frontend |
| `GET /payments/history/{user_id}` | **Changed** — now `GET /payments/history` | Update call in frontend |

---

## New Dependencies to Install (Frontend)

```bash
npm install katex          # LaTeX rendering for SAT math questions
npm install @types/katex   # TypeScript types
```

---

## 11. Rate Limiting — Handle 429 Responses

Two endpoints are now rate-limited. The frontend should catch `429` and display a friendly message instead of a generic error.

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 requests per 15 minutes per IP |
| `POST /api/promo/redeem` | 5 requests per hour per IP |

**429 response body from slowapi:**
```json
{ "error": "Rate limit exceeded: 10 per 1 hour" }
```

### Action items
- [ ] In `useAuth.tsx` `login()`: catch `ApiError` with `status === 429` → show "Too many login attempts. Try again in a few minutes."
- [ ] In the promo redeem handler: catch 429 → show "Too many attempts. Try again later."

---

## 12. Health Endpoint

```
GET /api/health

{
  "status": "ok",
  "db": "connected",
  "sqlite": "accessible",
  "uptime": 123.4
}
```

Use this for deployment health checks and as a dev smoke-test to confirm the backend is running before showing the login form.

### Action items
- [ ] Optionally: call `GET /api/health` on app load; if `db !== "connected"` show a maintenance banner

---

## 13. Practice History — User-Scoped (QA Fix)

The `GET /api/ielts/practice/{mode}/attempts` endpoint previously returned ALL users' attempts. It now returns only the **authenticated user's** attempts. No URL change — just ensure the `Authorization` header is sent (already done via `apiClient.ts` defaults).

---

## 14. Bug Fix Session — Endpoint Changes (Session 3)

### Promo endpoint parameter fix
`POST /api/promo/redeem` was crashing with 500. Fixed — body parameter renamed internally. No API contract change.

### SAT section — no paywall
SAT content is free for all logged-in users. `SAT_REQUIRES_SUBSCRIPTION=false` (env flag, default off). Frontend paywall removed from `/sat/math` and `/sat/english`.

### IELTS materials — pagination added

**Writing tasks** (`GET /api/ielts/materials/writing/tasks`) — response now includes:
```json
{ "tasks": [...], "count": 20, "total": 10324, "totalPages": 517 }
```
- Default limit raised from 10 → 20, max raised from 50 → 100
- New `?random=true` param for random ordering (default is stable `ORDER BY id`)

**Speaking questions** (`GET /api/ielts/materials/speaking/questions`) — response now includes:
```json
{ "questions": [...], "count": 20, "total": 293, "totalPages": 15 }
```
- New `?random=true` param; default is stable `ORDER BY part, id`

**Reading passages** (`GET /api/ielts/materials/reading/passages`) — response now includes:
```json
{ "passages": [...], "count": 20, "total": 456, "totalPages": 23 }
```

### Action items (updated)
- [x] `POST /api/promo/redeem` — fixed, no longer returns 500
- [x] TestLibraryWriting / TestLibrarySpeaking already use `pagination.totalPages` from response
- [ ] Update reading passages UI to use `totalPages` from response

---

## 15. AI Chat Assistant ✅ Completed

### Backend
- `POST /api/chat/message` added to `backend/app/api/ai/main.py`
- Requires `Authorization: Bearer <token>` (uses `Depends(get_current_user)`)
- Request: `{ "message": "string", "conversation_history": [{ "role": "user"|"assistant", "content": "string" }] }`
- Response: `{ "reply": "string" }`
- Uses **Gemini 2.0 Flash** via `google.generativeai`
- System prompt: BandUp AI tutor persona (IELTS + SAT focus)
- Env var: `GEMINI_API_KEY` (added to `.env.example`)

### Frontend
- `src/components/ChatAssistant.tsx` — floating button (bottom-right) + chat window
- Injected into `DashboardLayout.tsx` — visible on all dashboard/authenticated pages
- **Not** visible on landing page, login, or register (those don't use DashboardLayout)
- Features: message history, typing indicator, error state, mobile-responsive, dark-mode compatible
- Sends auth token automatically via `apiRequest` (same pattern as all other API calls)
