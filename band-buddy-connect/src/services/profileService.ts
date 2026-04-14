import { apiRequest } from "@/lib/apiClient";

export interface ProfileProgressItem {
  subject: string;
  completed: number;
  total: number;
  lastActivity: string;
}

export interface ProfileAchievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  earned: boolean;
}

export interface ProfileSummaryData {
  studyHoursLastMonth: number;
  progress: ProfileProgressItem[];
  achievements: ProfileAchievement[];
}

export const emptyProfileSummary: ProfileSummaryData = {
  studyHoursLastMonth: 0,
  progress: [],
  achievements: [],
};

const normalizeProfileSummary = (
  incoming: Partial<ProfileSummaryData> | null | undefined
): ProfileSummaryData => ({
  studyHoursLastMonth: incoming?.studyHoursLastMonth ?? 0,
  progress:
    incoming?.progress?.map((item) => ({
      subject: item.subject || "Unknown",
      completed: item.completed ?? 0,
      total: item.total ?? 0,
      lastActivity: item.lastActivity || "No activity yet",
    })) || [],
  achievements:
    incoming?.achievements?.map((item, index) => ({
      id: item.id || String(index + 1),
      title: item.title || "Achievement",
      description: item.description || "",
      icon: item.icon || "🏆",
      earned: Boolean(item.earned),
    })) || [],
});

export const profileService = {
  fetchSummary: async (): Promise<ProfileSummaryData> => {
    const response = await apiRequest<Partial<ProfileSummaryData>>(
      "/api/profile/summary"
    );
    return normalizeProfileSummary(response || emptyProfileSummary);
  },
};
