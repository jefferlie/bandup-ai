import type { DashboardData } from "./dashboardService";
import { apiRequest } from "@/lib/apiClient";

export type SkillMode = "listening" | "reading" | "writing" | "speaking";
export type SessionStatus = "planned" | "completed" | "missed";
export type SessionSource = "manual" | "autoplan" | "catchup" | "quick";

export interface StudySession {
  id: string;
  mode: SkillMode;
  title: string;
  date: string; // YYYY-MM-DD in local timezone
  startTime: string; // HH:mm in local timezone
  durationMinutes: number;
  status: SessionStatus;
  source: SessionSource;
  testId?: string;
  createdAt: string; // ISO
}

export interface WeekDayItem {
  date: Date;
  dateKey: string;
  shortLabel: string;
  dayNumber: string;
}

type SessionCreateInput = Partial<StudySession> &
  Pick<StudySession, "mode" | "date"> & { startTime?: string; source?: SessionSource };
type SessionPatchInput = Partial<Omit<StudySession, "id">>;

const STORAGE_KEY = "bandup_schedule_sessions_v1";
const ENABLE_LOCAL_FALLBACK =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK !== "false";

const DEFAULT_DURATION_BY_MODE: Record<SkillMode, number> = {
  listening: 20,
  reading: 25,
  writing: 35,
  speaking: 20,
};

const FALLBACK_TODAY_PLAN: Array<Pick<StudySession, "mode" | "durationMinutes">> = [
  { mode: "reading", durationMinutes: 20 },
  { mode: "writing", durationMinutes: 30 },
  { mode: "speaking", durationMinutes: 15 },
];

const MODE_LABEL: Record<SkillMode, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

const MODE_TITLE: Record<SkillMode, string> = {
  listening: "Listening Focus Session",
  reading: "Reading Focus Session",
  writing: "Writing Focus Session",
  speaking: "Speaking Focus Session",
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toTimeLabel = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const parseLocalDateTime = (session: Pick<StudySession, "date" | "startTime">) => {
  const [year, month, day] = session.date.split("-").map(Number);
  const [hours, minutes] = session.startTime.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
};

const sortSessions = (sessions: StudySession[]) =>
  [...sessions].sort((a, b) => parseLocalDateTime(a).getTime() - parseLocalDateTime(b).getTime());

const safeNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.round(value));
};

const toValidMode = (value: unknown): SkillMode | null => {
  if (
    value === "listening" ||
    value === "reading" ||
    value === "writing" ||
    value === "speaking"
  ) {
    return value;
  }
  return null;
};

const toValidStatus = (value: unknown): SessionStatus =>
  value === "completed" || value === "missed" ? value : "planned";

const toValidSource = (value: unknown): SessionSource =>
  value === "autoplan" || value === "catchup" || value === "quick" ? value : "manual";

const normalizeSession = (raw: unknown): StudySession | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<StudySession>;
  const mode = toValidMode(candidate.mode);
  if (!mode || !candidate.date || !candidate.startTime) {
    return null;
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id
      : `${mode}-${candidate.date}-${candidate.startTime}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    mode,
    title:
      typeof candidate.title === "string" && candidate.title.trim().length > 0
        ? candidate.title
        : MODE_TITLE[mode],
    date: candidate.date,
    startTime: candidate.startTime,
    durationMinutes: safeNumber(candidate.durationMinutes, DEFAULT_DURATION_BY_MODE[mode]),
    status: toValidStatus(candidate.status),
    source: toValidSource(candidate.source),
    testId: typeof candidate.testId === "string" ? candidate.testId : undefined,
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
  };
};

const readRaw = (): StudySession[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeSession(item))
      .filter((item): item is StudySession => item !== null);
  } catch {
    return [];
  }
};

const saveRaw = (sessions: StudySession[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortSessions(sessions)));
};

const withMissedRefresh = (sessions: StudySession[], now: Date = new Date()): StudySession[] => {
  let changed = false;
  const next = sessions.map((session) => {
    if (session.status !== "planned") {
      return session;
    }

    const startsAt = parseLocalDateTime(session);
    const endsAt = new Date(startsAt.getTime() + session.durationMinutes * 60 * 1000);

    if (endsAt.getTime() < now.getTime()) {
      changed = true;
      return {
        ...session,
        status: "missed" as const,
      };
    }
    return session;
  });

  if (changed) {
    saveRaw(next);
  }
  return next;
};

const modeOrder: SkillMode[] = ["listening", "reading", "writing", "speaking"];

const scoreByMode = (progress: DashboardData["progress"] | undefined): Record<SkillMode, number> => ({
  listening: progress?.listeningScore ?? 0,
  reading: progress?.readingScore ?? 0,
  writing: progress?.writingScore ?? 0,
  speaking: progress?.speakingScore ?? 0,
});

const getWeakModes = (progress: DashboardData["progress"] | undefined): SkillMode[] => {
  const scores = scoreByMode(progress);
  return [...modeOrder].sort((a, b) => {
    const diff = scores[a] - scores[b];
    if (diff !== 0) {
      return diff;
    }
    return modeOrder.indexOf(a) - modeOrder.indexOf(b);
  });
};

const getDefaultStartTime = (mode: SkillMode, dateKey: string): string => {
  const baseTimes: Record<SkillMode, string> = {
    listening: "09:00",
    reading: "12:00",
    writing: "18:00",
    speaking: "20:00",
  };

  const now = new Date();
  if (toDateKey(now) !== dateKey) {
    return baseTimes[mode];
  }

  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  rounded.setHours(rounded.getHours() + 1);
  return toTimeLabel(rounded);
};

const buildSession = (partial: SessionCreateInput): StudySession => {
  const mode = partial.mode;
  return {
    id: partial.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    title: partial.title || MODE_TITLE[mode],
    date: partial.date,
    startTime: partial.startTime || getDefaultStartTime(mode, partial.date),
    durationMinutes: safeNumber(partial.durationMinutes, DEFAULT_DURATION_BY_MODE[mode]),
    status: partial.status || "planned",
    source: partial.source || "manual",
    testId: partial.testId,
    createdAt: partial.createdAt || new Date().toISOString(),
  };
};

const toUtcCalendarDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const toMonthShort = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

const buildEmailQuery = (email?: string) => (email ? `?email=${encodeURIComponent(email)}` : "");

const toRemoteSessionPayload = (session: StudySession) => ({
  id: session.id,
  mode: session.mode,
  title: session.title,
  date: session.date,
  startTime: session.startTime,
  durationMinutes: session.durationMinutes,
  status: session.status,
  source: session.source,
  testId: session.testId ?? null,
  createdAt: session.createdAt,
});

const normalizeRemoteList = (payload: unknown): StudySession[] =>
  Array.isArray(payload)
    ? payload
        .map((item) => normalizeSession(item))
        .filter((item): item is StudySession => item !== null)
    : [];

const normalizeRemoteSessionOrThrow = (payload: unknown): StudySession => {
  const normalized = normalizeSession(payload);
  if (!normalized) {
    throw new Error("Schedule API returned invalid session payload.");
  }
  return normalized;
};

const upsertLocalSession = (session: StudySession): StudySession[] => {
  const sessions = scheduleService
    .listSessions()
    .filter((item) => item.id !== session.id);
  const next = sortSessions([...sessions, session]);
  saveRaw(next);
  return next;
};

const removeLocalSession = (sessionId: string): StudySession[] => {
  const next = scheduleService.listSessions().filter((session) => session.id !== sessionId);
  saveRaw(next);
  return next;
};

export const scheduleService = {
  getStorageKey: () => STORAGE_KEY,

  listSessions: (): StudySession[] => withMissedRefresh(sortSessions(readRaw())),

  replaceSessions: (sessions: StudySession[]) => {
    saveRaw(sortSessions(sessions));
  },

  addSession: (input: SessionCreateInput): StudySession => {
    const sessions = scheduleService.listSessions();
    const nextSession = buildSession(input);
    const next = sortSessions([...sessions, nextSession]);
    saveRaw(next);
    return nextSession;
  },

  removeSession: (sessionId: string) => {
    const sessions = scheduleService.listSessions().filter((session) => session.id !== sessionId);
    saveRaw(sessions);
  },

  setStatus: (sessionId: string, status: SessionStatus) => {
    const sessions = scheduleService.listSessions().map((session) =>
      session.id === sessionId ? { ...session, status } : session
    );
    saveRaw(sessions);
  },

  updateSession: (sessionId: string, patch: Partial<StudySession>) => {
    const sessions = scheduleService.listSessions().map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        ...patch,
        id: session.id,
      };
    });
    saveRaw(sessions);
  },

  getTodaySessions: (sessions: StudySession[], day: Date = new Date()): StudySession[] => {
    const dateKey = toDateKey(day);
    return sortSessions(sessions).filter((session) => session.date === dateKey);
  },

  getUpcomingSessions: (sessions: StudySession[], limit = 3, from = new Date()): StudySession[] =>
    sortSessions(sessions)
      .filter((session) => session.status === "planned")
      .filter((session) => parseLocalDateTime(session).getTime() >= from.getTime())
      .slice(0, limit),

  getMissedSessions: (sessions: StudySession[]) =>
    sortSessions(sessions).filter((session) => session.status === "missed"),

  startOfWeek: (date: Date = new Date()) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday-start week
    next.setDate(next.getDate() + diff);
    next.setHours(0, 0, 0, 0);
    return next;
  },

  getWeekDays: (weekStart: Date): WeekDayItem[] =>
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        date,
        dateKey: toDateKey(date),
        shortLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: String(date.getDate()),
      };
    }),

  getSessionsByDate: (sessions: StudySession[]): Record<string, StudySession[]> =>
    sortSessions(sessions).reduce<Record<string, StudySession[]>>((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {}),

  getWeakestMode: (progress: DashboardData["progress"] | undefined): SkillMode =>
    getWeakModes(progress)[0] || "reading",

  createTodayPlan: (progress: DashboardData["progress"] | undefined): StudySession[] => {
    const existing = scheduleService.listSessions();
    const today = new Date();
    const todayKey = toDateKey(today);
    const hasToday = existing.some((session) => session.date === todayKey);
    if (hasToday) {
      return scheduleService.getTodaySessions(existing, today);
    }

    const weakModes = getWeakModes(progress);
    const fallbackModes = FALLBACK_TODAY_PLAN.map((item) => item.mode);
    const rankedModes = [...new Set([...weakModes, ...fallbackModes])].slice(0, 3);
    const startTimes = ["09:00", "14:00", "19:00"];

    const created = rankedModes.map((mode, index) =>
      buildSession({
        mode,
        date: todayKey,
        startTime: startTimes[index] || getDefaultStartTime(mode, todayKey),
        durationMinutes:
          FALLBACK_TODAY_PLAN.find((item) => item.mode === mode)?.durationMinutes ||
          DEFAULT_DURATION_BY_MODE[mode],
        source: "autoplan",
      })
    );

    saveRaw(sortSessions([...existing, ...created]));
    return created;
  },

  applyAutoPlan: (
    progress: DashboardData["progress"] | undefined,
    options?: { examDate?: string | null; targetBand?: number | null; replaceFuture?: boolean }
  ) => {
    const sessions = scheduleService.listSessions();
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const examDate = options?.examDate ? new Date(options.examDate) : null;
    const msInDay = 24 * 60 * 60 * 1000;
    const daysUntilExam = examDate
      ? Math.max(1, Math.floor((examDate.getTime() - startDay.getTime()) / msInDay))
      : 14;
    const horizon = Math.min(21, Math.max(7, daysUntilExam));

    const weakModes = getWeakModes(progress);
    const plannedExisting = options?.replaceFuture
      ? sessions.filter((session) => parseLocalDateTime(session).getTime() < startDay.getTime())
      : sessions;

    const generated: StudySession[] = [];
    let modeCursor = 0;

    for (let dayIndex = 0; dayIndex < horizon; dayIndex += 1) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + dayIndex);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const sessionsPerDay = isWeekend ? 1 : 2;
      const slots = sessionsPerDay === 1 ? ["11:00"] : ["12:00", "19:00"];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const mode = weakModes[modeCursor % weakModes.length];
        modeCursor += 1;
        generated.push(
          buildSession({
            mode,
            date: toDateKey(day),
            startTime: slots[slotIndex],
            durationMinutes: DEFAULT_DURATION_BY_MODE[mode],
            source: "autoplan",
            title: `${MODE_LABEL[mode]} Practice`,
          })
        );
      }
    }

    saveRaw(sortSessions([...plannedExisting, ...generated]));
    return generated;
  },

  applyCatchUpPlan: (maxSessions = 2) => {
    const sessions = scheduleService.listSessions();
    const missed = scheduleService.getMissedSessions(sessions)
      .filter((session) => session.status === "missed")
      .slice(-maxSessions);

    if (missed.length === 0) {
      return [] as StudySession[];
    }

    const now = new Date();
    const created: StudySession[] = missed.map((session, index) => {
      const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      nextDate.setDate(nextDate.getDate() + index);
      return buildSession({
        mode: session.mode,
        date: toDateKey(nextDate),
        startTime: index === 0 ? getDefaultStartTime(session.mode, toDateKey(nextDate)) : "20:00",
        durationMinutes: session.durationMinutes,
        source: "catchup",
        title: `${MODE_LABEL[session.mode]} Catch-up`,
      });
    });

    saveRaw(sortSessions([...sessions, ...created]));
    return created;
  },

  getModeLabel: (mode: SkillMode) => MODE_LABEL[mode],

  getModeDuration: (mode: SkillMode) => DEFAULT_DURATION_BY_MODE[mode],

  formatDayMeta: (day: Date) =>
    `${toMonthShort(day)} ${day.getDate()}, ${day.toLocaleDateString("en-US", { weekday: "short" })}`,

  toDateKey,

  getSessionRoute: (session: StudySession) => {
    const libraryRoutes: Record<SkillMode, string> = {
      listening: "/tests/listening",
      reading: "/tests/reading",
      writing: "/tests/writing",
      speaking: "/tests/speaking",
    };

    const practiceRoutes: Record<SkillMode, string> = {
      listening: "/practice/listening",
      reading: "/practice/reading",
      writing: "/practice/writing",
      speaking: "/practice/speaking",
    };

    if (session.testId) {
      return `${practiceRoutes[session.mode]}?testId=${encodeURIComponent(session.testId)}`;
    }

    return libraryRoutes[session.mode];
  },

  exportToIcs: (sessions: StudySession[]) => {
    const entries = sortSessions(sessions).filter((session) => session.status !== "missed");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BandUp//Study Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    entries.forEach((session) => {
      const start = parseLocalDateTime(session);
      const end = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${session.id}@bandup.local`);
      lines.push(`DTSTAMP:${toUtcCalendarDate(new Date())}`);
      lines.push(`DTSTART:${toUtcCalendarDate(start)}`);
      lines.push(`DTEND:${toUtcCalendarDate(end)}`);
      lines.push(`SUMMARY:BandUp - ${MODE_LABEL[session.mode]} Session`);
      lines.push(
        `DESCRIPTION:BandUp study session (${session.durationMinutes} minutes). Source: ${session.source}.`
      );
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  },

  fetchSessions: async (email?: string): Promise<StudySession[]> => {
    const query = buildEmailQuery(email);
    try {
      const payload = await apiRequest<unknown[]>(`/api/schedule/${query}`);
      const normalized = normalizeRemoteList(payload);
      saveRaw(normalized);
      return sortSessions(normalized);
    } catch {
      if (ENABLE_LOCAL_FALLBACK) {
        return scheduleService.listSessions();
      }
      throw new Error("Failed to fetch schedule sessions.");
    }
  },

  createSessionRemote: async (
    input: SessionCreateInput,
    email?: string
  ): Promise<StudySession> => {
    const query = buildEmailQuery(email);
    const draft = buildSession(input);

    try {
      const response = await apiRequest<unknown>(`/api/schedule/${query}`, {
        method: "POST",
        body: toRemoteSessionPayload(draft),
      });
      const normalized = normalizeRemoteSessionOrThrow(response);
      upsertLocalSession(normalized);
      return normalized;
    } catch {
      if (ENABLE_LOCAL_FALLBACK) {
        return scheduleService.addSession(input);
      }
      throw new Error("Failed to create schedule session.");
    }
  },

  updateSessionRemote: async (
    sessionId: string,
    patch: SessionPatchInput,
    email?: string
  ): Promise<StudySession> => {
    const query = buildEmailQuery(email);
    const payload = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );

    try {
      const response = await apiRequest<unknown>(
        `/api/schedule/${encodeURIComponent(sessionId)}${query}`,
        {
          method: "PATCH",
          body: payload,
        }
      );
      const normalized = normalizeRemoteSessionOrThrow(response);
      upsertLocalSession(normalized);
      return normalized;
    } catch {
      if (ENABLE_LOCAL_FALLBACK) {
        scheduleService.updateSession(sessionId, patch);
        const local = scheduleService.listSessions().find((session) => session.id === sessionId);
        if (!local) {
          throw new Error("Schedule session not found.");
        }
        return local;
      }
      throw new Error("Failed to update schedule session.");
    }
  },

  deleteSessionRemote: async (sessionId: string, email?: string): Promise<void> => {
    const query = buildEmailQuery(email);

    try {
      await apiRequest<unknown>(`/api/schedule/${encodeURIComponent(sessionId)}${query}`, {
        method: "DELETE",
      });
      removeLocalSession(sessionId);
    } catch {
      if (ENABLE_LOCAL_FALLBACK) {
        removeLocalSession(sessionId);
        return;
      }
      throw new Error("Failed to delete schedule session.");
    }
  },

  replaceSessionsRemote: async (
    sessions: StudySession[],
    email?: string
  ): Promise<StudySession[]> => {
    const query = buildEmailQuery(email);
    const payload = sortSessions(sessions).map((session) => toRemoteSessionPayload(session));

    try {
      const response = await apiRequest<unknown[]>(`/api/schedule/${query}`, {
        method: "PUT",
        body: payload,
      });
      const normalized = normalizeRemoteList(response);
      saveRaw(normalized);
      return sortSessions(normalized);
    } catch {
      if (ENABLE_LOCAL_FALLBACK) {
        saveRaw(sessions);
        return sortSessions(sessions);
      }
      throw new Error("Failed to save schedule sessions.");
    }
  },
};
