# Backend Handoff Checklist (Frontend Ready)

## 1) Test Library endpoints (required)
Implement:
- `GET /api/tests/reading`
- `GET /api/tests/listening`

Supported query params:
- `page` (number)
- `limit` (number)
- `search` (string)
- `questionType` (string)
- `length` (string)
- `examType` (string: `academic` | `general training`)

Response shape:
```json
{
  "tests": [
    {
      "id": "r1",
      "title": "Cambridge IELTS 20 Test 1",
      "subtitle": "Academic • Passage 1",
      "type": "Matching Headings",
      "badges": [
        {
          "label": "Academic",
          "bg": "bg-blue-100 dark:bg-blue-900/30",
          "text": "text-blue-800 dark:text-blue-300"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 9,
    "total": 124,
    "totalPages": 14
  }
}
```

## 2) Practice endpoints (required)
Implement all modes with identical submit/history behavior:
- `GET /api/practice/reading/:testId`
- `POST /api/practice/reading/:attemptId/answers`
- `GET /api/practice/reading/attempts?limit=5`
- `GET /api/practice/listening/:testId`
- `POST /api/practice/listening/:attemptId/answers`
- `GET /api/practice/listening/attempts?limit=5`
- `GET /api/practice/speaking/:testId`
- `POST /api/practice/speaking/:attemptId/answers`
- `GET /api/practice/speaking/attempts?limit=5`
- `GET /api/practice/writing/:testId`
- `POST /api/practice/writing/:attemptId/answers`
- `GET /api/practice/writing/attempts?limit=5`

Submit request:
```json
{
  "answers": {
    "q1": "A",
    "q2": "some text"
  }
}
```

Submit response:
```json
{
  "attemptId": "att_001",
  "scoreLabel": "31/40",
  "status": "submitted",
  "feedback": "Optional feedback"
}
```

## 3) Settings endpoints (required)
Implement:
- `GET /api/settings`
- `PUT /api/settings`

Use same shape as in `DATA_INTEGRATION_GUIDE.md` section 3.15.

## 4) Listening audio requirements (required)
For `GET /api/practice/listening/:testId`:
- return valid `audioUrl`
- ensure browser can fetch it (CORS)
- return proper `Content-Type` (`audio/mpeg`, `audio/webm`, etc.)

## 5) Frontend run against real backend (required)
Frontend env:
- `VITE_API_BASE_URL=http://<your-backend-host>`
- `VITE_ENABLE_LOCAL_FALLBACK=false`

Then run and smoke test:
1. `/tests/reading` (filters + page switching)
2. `/tests/listening` (filters + page switching)
3. `/practice/reading`
4. `/practice/listening` (audio playback + progress + seek)
5. `/practice/speaking`
6. `/practice/speaking-writing`
7. `/settings`

## 6) Optional next step
If you want server-side storage of speaking audio, add an upload endpoint (multipart) and return media URL/transcription.
