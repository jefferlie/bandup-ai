import { apiRequest, ApiError } from "@/lib/apiClient";

export interface UserSettings {
  profile: {
    name: string;
    email: string;
    avatarUrl: string;
    phone: string;
    timezone: string;
  };
  studyPreferences: {
    targetBand: number;
    currentBand: number | null;
    examDate: string;
    primaryExam: "ielts" | "sat";
    targetSatScore: number | null;
    studyHoursPerWeek: number;
    focusSkills: Array<"listening" | "reading" | "writing" | "speaking">;
    preferredStudyTime: "morning" | "afternoon" | "evening" | "flexible";
    discoverySource:
      | "instagram"
      | "youtube"
      | "tiktok"
      | "friend"
      | "google"
      | "school"
      | "other";
  };
  security: {
    twoFactorEnabled: boolean;
  };
  notifications: {
    emailAlerts: boolean;
    studyReminders: boolean;
    productUpdates: boolean;
  };
}

const LOCAL_SETTINGS_KEY = "bandup_local_settings";
const ENABLE_LOCAL_FALLBACK =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK !== "false";

const defaultSettings: UserSettings = {
  profile: {
    name: "Student",
    email: "student@example.com",
    avatarUrl: "/avatars/avatar_1.png",
    phone: "",
    timezone: "Asia/Almaty",
  },
  studyPreferences: {
    targetBand: 7.5,
    currentBand: null,
    examDate: "",
    primaryExam: "ielts",
    targetSatScore: null,
    studyHoursPerWeek: 6,
    focusSkills: ["reading", "writing"],
    preferredStudyTime: "flexible",
    discoverySource: "other",
  },
  security: {
    twoFactorEnabled: false,
  },
  notifications: {
    emailAlerts: true,
    studyReminders: true,
    productUpdates: false,
  },
};

const toNumber = (value: unknown, fallback: number, min?: number, max?: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  let next = parsed;
  if (typeof min === "number") {
    next = Math.max(min, next);
  }
  if (typeof max === "number") {
    next = Math.min(max, next);
  }
  return Number(next);
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
};

const normalizeSettings = (
  raw: Partial<UserSettings> | null | undefined,
  emailHint?: string
): UserSettings => {
  const profile = raw?.profile ?? {};
  const study = raw?.studyPreferences ?? {};
  const security = raw?.security ?? {};
  const notifications = raw?.notifications ?? {};
  const primaryExam = study.primaryExam === "sat" ? "sat" : "ielts";
  const preferredStudyTime =
    study.preferredStudyTime === "morning" ||
    study.preferredStudyTime === "afternoon" ||
    study.preferredStudyTime === "evening"
      ? study.preferredStudyTime
      : "flexible";
  const discoverySource =
    study.discoverySource === "instagram" ||
    study.discoverySource === "youtube" ||
    study.discoverySource === "tiktok" ||
    study.discoverySource === "friend" ||
    study.discoverySource === "google" ||
    study.discoverySource === "school"
      ? study.discoverySource
      : "other";
  const focusSkills = Array.isArray(study.focusSkills)
    ? study.focusSkills.filter(
        (skill): skill is "listening" | "reading" | "writing" | "speaking" =>
          skill === "listening" ||
          skill === "reading" ||
          skill === "writing" ||
          skill === "speaking"
      )
    : defaultSettings.studyPreferences.focusSkills;

  const satValue =
    typeof study.targetSatScore === "number" && Number.isFinite(study.targetSatScore)
      ? Math.max(400, Math.min(1600, Math.round(study.targetSatScore)))
      : null;
  const currentBandValue =
    typeof study.currentBand === "number" && Number.isFinite(study.currentBand)
      ? toNumber(study.currentBand, 0, 0, 9)
      : null;

  return {
    profile: {
      name:
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name
          : defaultSettings.profile.name,
      email:
        typeof profile.email === "string" && profile.email.trim()
          ? profile.email
          : emailHint || defaultSettings.profile.email,
      avatarUrl:
        typeof profile.avatarUrl === "string" && profile.avatarUrl.trim()
          ? profile.avatarUrl
          : defaultSettings.profile.avatarUrl,
      phone: typeof profile.phone === "string" ? profile.phone : "",
      timezone:
        typeof profile.timezone === "string" && profile.timezone.trim()
          ? profile.timezone
          : defaultSettings.profile.timezone,
    },
    studyPreferences: {
      targetBand: toNumber(study.targetBand, defaultSettings.studyPreferences.targetBand, 0, 9),
      currentBand: currentBandValue,
      examDate: typeof study.examDate === "string" ? study.examDate : "",
      primaryExam,
      targetSatScore: satValue,
      studyHoursPerWeek: Math.round(
        toNumber(
          study.studyHoursPerWeek,
          defaultSettings.studyPreferences.studyHoursPerWeek,
          1,
          40
        )
      ),
      focusSkills,
      preferredStudyTime,
      discoverySource,
    },
    security: {
      twoFactorEnabled: toBoolean(
        security.twoFactorEnabled,
        defaultSettings.security.twoFactorEnabled
      ),
    },
    notifications: {
      emailAlerts: toBoolean(notifications.emailAlerts, defaultSettings.notifications.emailAlerts),
      studyReminders: toBoolean(
        notifications.studyReminders,
        defaultSettings.notifications.studyReminders
      ),
      productUpdates: toBoolean(
        notifications.productUpdates,
        defaultSettings.notifications.productUpdates
      ),
    },
  };
};

const buildEmailQuery = (email?: string) => (email ? `?email=${encodeURIComponent(email)}` : "");

const readLocalSettings = (emailHint?: string): UserSettings => {
  const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
  if (!raw) {
    return normalizeSettings(defaultSettings, emailHint);
  }
  try {
    return normalizeSettings(JSON.parse(raw) as Partial<UserSettings>, emailHint);
  } catch {
    return normalizeSettings(defaultSettings, emailHint);
  }
};

const writeLocalSettings = (settings: UserSettings) => {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
};

export const settingsService = {
  fetchSettings: async (email?: string): Promise<UserSettings> => {
    const query = buildEmailQuery(email);
    try {
      const response = await apiRequest<Partial<UserSettings>>(`/api/settings/${query}`);
      const normalized = normalizeSettings(response, email);
      writeLocalSettings(normalized);
      return normalized;
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return readLocalSettings(email);
      }
      throw error;
    }
  },

  updateSettings: async (settings: UserSettings, email?: string): Promise<UserSettings> => {
    const query = buildEmailQuery(email);
    const normalizedPayload = normalizeSettings(settings, email);
    try {
      const updated = await apiRequest<Partial<UserSettings>>(`/api/settings/${query}`, {
        method: "PUT",
        body: normalizedPayload,
      });
      const normalized = normalizeSettings(updated, email);
      writeLocalSettings(normalized);
      return normalized;
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        writeLocalSettings(normalizedPayload);
        return normalizedPayload;
      }
      throw error;
    }
  },
};
