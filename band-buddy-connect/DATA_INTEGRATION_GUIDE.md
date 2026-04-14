# Frontend <> Backend Integration Guide

## 1. Environment

- `VITE_API_BASE_URL` (default: `http://127.0.0.1:5000`)
- `VITE_AI_API_BASE_URL` (default: `http://127.0.0.1:8000`)
- `VITE_ENABLE_LOCAL_FALLBACK`
  - `true`/unset in dev: frontend works without backend via local fallback.
  - `false`: only real API responses.

## 2. Already connected (contract-first)

### Auth
- `POST /login`
- `POST /register`
- Files: `src/hooks/useAuth.tsx`

### Dashboard
- `GET /api/dashboard`
- Files: `src/services/dashboardService.ts`, `src/pages/Dashboard.tsx`

### Test Library
- `GET /api/tests/reading`
- `GET /api/tests/listening`
- Files: `src/services/testService.ts`, `src/pages/TestLibraryReading.tsx`, `src/pages/TestLibraryListening.tsx`

### Practice Flow (Reading / Listening / Speaking / Writing)
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
- Files: `src/services/practiceService.ts`, `src/pages/PracticeReading.tsx`, `src/pages/PracticeListening.tsx`, `src/pages/PracticeSpeaking.tsx`, `src/pages/PracticeSpeakingWriting.tsx`

### Profile
- `GET /api/profile/summary`
- Files: `src/services/profileService.ts`, `src/pages/ProfilePage.tsx`

### Admin
- `GET /api/admin/overview`
- Files: `src/services/adminService.ts`, `src/pages/AdminPage.tsx`

### Settings
- `GET /api/settings`
- `PUT /api/settings`
- Files: `src/services/settingsService.ts`, `src/pages/Settings.tsx`

### Marketing content (optional CMS/API)
- `GET /api/content/home`
- `GET /api/content/ai-info`
- Files: `src/services/contentService.ts`, `src/pages/HomePage.tsx`, `src/pages/AIInfoPage.tsx`

### AI chat/speaking
- `POST /api/chat`
- `POST /api/speaking/audio`
- File: `src/components/ChatWindow.tsx`

## 3. Core contracts

### 3.1 `POST /login` and `POST /register`
Response:
```json
{
  "token": "jwt-or-session-token",
  "user": {
    "id": "u_1",
    "name": "Ernar",
    "email": "user@example.com",
    "role": "student",
    "isAdmin": false,
    "createdAt": "2026-02-20T12:00:00Z"
  }
}
```

### 3.2 `GET /api/dashboard`
```json
{
  "userProfile": {
    "targetBand": 7.5,
    "examDate": "2026-06-15"
  },
  "stats": {
    "totalTestsCompleted": 24,
    "averageBandScore": 6.8,
    "currentLearningStreak": 5
  },
  "progress": {
    "baselineScore": 5.5,
    "listeningScore": 6.5,
    "readingScore": 7.0,
    "writingScore": 6.0,
    "speakingScore": 6.5,
    "targetScore": 7.5
  },
  "recentActivity": [],
  "upcomingClasses": [],
  "achievements": []
}
```

### 3.3 `GET /api/tests/reading` and `GET /api/tests/listening`
Query params:
- `page` (number, default `1`)
- `limit` (number, default `9`)
- `search` (string, optional)
- `questionType` (string, optional)
- `length` (string, optional)
- `examType` (string, optional; expected values: `academic`, `general training`)

Preferred response:
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
        },
        {
          "label": "Full Test (60 mins)",
          "bg": "bg-green-100 dark:bg-green-900/30",
          "text": "text-green-800 dark:text-green-300"
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
Legacy fallback response (`[]`) is also supported by frontend, but without server-side pagination.

### 3.4 `GET /api/practice/reading/:testId`
```json
{
  "attemptId": "att_r_001",
  "testId": "r1",
  "title": "Reading Practice Test",
  "instruction": "Read and answer",
  "durationSeconds": 3600,
  "passageTitle": "Title",
  "passageSections": [
    {
      "id": "A",
      "heading": "A",
      "text": "..."
    }
  ],
  "questions": [
    {
      "id": "q1",
      "prompt": "Question text",
      "type": "single-choice",
      "options": ["A", "B", "C", "D"]
    }
  ]
}
```

### 3.5 `POST /api/practice/reading/:attemptId/answers`
Request:
```json
{
  "answers": {
    "q1": "A",
    "q2": "some text"
  }
}
```
Response:
```json
{
  "attemptId": "att_r_001",
  "scoreLabel": "31/40",
  "status": "submitted",
  "feedback": "Optional feedback"
}
```

### 3.6 `GET /api/practice/listening/:testId`
```json
{
  "attemptId": "att_l_001",
  "testId": "l1",
  "title": "Listening Practice Test",
  "instruction": "Listen and answer",
  "durationSeconds": 2400,
  "audioUrl": "https://.../audio.mp3",
  "audioDurationLabel": "8:02",
  "notesTitle": "Section title",
  "questions": [
    {
      "id": "q1",
      "prompt": "Fill in the blank",
      "type": "short-text",
      "placeholder": "ONE WORD"
    }
  ]
}
```

### 3.7 `POST /api/practice/listening/:attemptId/answers`
Request/response shape: same as reading submit.

### 3.8 `GET /api/practice/speaking/:testId`
```json
{
  "attemptId": "att_s_001",
  "testId": "s1",
  "title": "Speaking Practice Test",
  "instruction": "Prepare and answer each part",
  "durationSeconds": 900,
  "parts": [
    {
      "id": "part1",
      "title": "Part 1",
      "desc": "Introduction & Interview",
      "prompt": "Tell me about your hometown.",
      "bulletPoints": ["point 1", "point 2"],
      "prepSeconds": 30,
      "speakSeconds": 90
    }
  ],
  "tips": ["Tip 1", "Tip 2"]
}
```

### 3.9 `POST /api/practice/speaking/:attemptId/answers`
Request/response shape: same as reading submit.

### 3.10 `GET /api/practice/writing/:testId`
```json
{
  "attemptId": "att_w_001",
  "testId": "w1",
  "title": "Writing Practice Test",
  "instruction": "Write Task 1 and Task 2 answers",
  "durationSeconds": 3600,
  "tasks": [
    {
      "id": "task1",
      "title": "Task 1",
      "desc": "Graph Description",
      "promptTitle": "Line graph report",
      "question": "Task text...",
      "minWords": 150
    }
  ],
  "tips": ["Tip 1", "Tip 2"]
}
```

### 3.11 `POST /api/practice/writing/:attemptId/answers`
Request/response shape: same as reading submit.

### 3.12 `GET /api/practice/{mode}/attempts?limit=5`
```json
[
  {
    "id": "h_1",
    "mode": "reading",
    "testId": "r1",
    "testTitle": "Reading Practice Test",
    "submittedAt": "2026-02-20T12:00:00Z",
    "scoreLabel": "31/40",
    "status": "reviewed"
  }
]
```

### 3.13 `GET /api/profile/summary`
```json
{
  "studyHoursLastMonth": 18,
  "progress": [
    {
      "subject": "Writing",
      "completed": 8,
      "total": 12,
      "lastActivity": "2026-02-19"
    }
  ],
  "achievements": [
    {
      "id": "p1",
      "title": "First Lesson",
      "description": "Completed your first lesson",
      "icon": "🎯",
      "earned": true
    }
  ]
}
```

### 3.14 `GET /api/admin/overview`
```json
{
  "stats": {
    "totalUsers": 320,
    "activeCourses": 12,
    "newReports": 3,
    "mediaFiles": 90,
    "activeUsers": 147,
    "newRegistrations": 11,
    "avgStudyHours": 2.7
  },
  "users": [],
  "reports": [],
  "media": [],
  "settings": {
    "autoModeration": true,
    "emailNotifications": true,
    "pushNotifications": false
  }
}
```

### 3.15 `GET /api/settings` and `PUT /api/settings`
```json
{
  "profile": {
    "name": "Ernar",
    "email": "user@example.com",
    "avatarUrl": "/avatars/avatar_1.png",
    "phone": "+7701...",
    "timezone": "Asia/Almaty"
  },
  "studyPreferences": {
    "targetBand": 7.5,
    "examDate": "2026-06-15"
  },
  "security": {
    "twoFactorEnabled": false
  },
  "notifications": {
    "emailAlerts": true,
    "studyReminders": true,
    "productUpdates": false
  }
}
```

### 3.16 Content endpoints (optional)
- `GET /api/content/home` -> `HomePageContent` shape from `src/services/contentService.ts`
- `GET /api/content/ai-info` -> `AIInfoContent` shape from `src/services/contentService.ts`

## 4. Critical backend fixes (current repo status)

- Do not return `password` in user response.
- For failed login, use `401/403`, not `201`.
- Remove hardcoded DSN/keys, use only `.env`.
- Add unique constraint/index on `users.email`.
- Remove/isolate test-stub entrypoints (`main_ernar.py` and similar).

## 5. Remaining frontend tasks

- Run end-to-end checks for all screens against real backend with `VITE_ENABLE_LOCAL_FALLBACK=false`.
- Optionally add speaking audio upload to server via separate endpoint (`multipart/form-data`) instead of local `blob:` URLs.

## 6. Step-by-step backend instructions

1. Implement `GET /api/tests/reading` and `GET /api/tests/listening` with query params:
   - `page`, `limit`, `search`, `questionType`, `length`, `examType`.
2. Return format `{ tests, pagination }`:
   - `pagination.total` and `pagination.totalPages` are required for correct frontend pagination.
3. Implement practice endpoints (if not ready yet):
   - `GET /api/practice/{reading|listening|speaking|writing}/:testId`
   - `POST /api/practice/{reading|listening|speaking|writing}/:attemptId/answers`
   - `GET /api/practice/{reading|listening|speaking|writing}/attempts?limit=5`
4. For listening audio:
   - return a valid `audioUrl` (browser-accessible with correct CORS),
   - provide correct `Content-Type` when possible (`audio/mpeg`, `audio/webm`, ...).
5. For settings:
   - support `GET /api/settings` and `PUT /api/settings` with the shape in section `3.15`.
6. Integration check:
   - run frontend with `VITE_ENABLE_LOCAL_FALLBACK=false`,
   - manually test pages `/tests/reading`, `/tests/listening`, `/practice/*`, `/settings`,
   - verify there are no `4xx/5xx` errors in DevTools and data renders without fallback.
