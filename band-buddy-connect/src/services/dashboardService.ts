import { apiRequest } from "@/lib/apiClient";

export interface DashboardAchievement {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  completed: boolean;
  progress?: {
    current: number;
    target: number;
  };
}

export interface DashboardData {
  userProfile: {
    targetBand: number | null;
    examDate: string | null;
  };
  stats: {
    totalTestsCompleted: number;
    averageBandScore: number;
    currentLearningStreak: number;
  };
  progress: {
    baselineScore: number | null;
    listeningScore: number;
    readingScore: number;
    writingScore: number;
    speakingScore: number;
    targetScore: number;
  };
  recentActivity: {
    id: string;
    testId?: string;
    type: "listening" | "reading" | "writing" | "speaking";
    title: string;
    timeLabel: string;
    score: string;
    status: "completed" | "pending";
  }[];
  upcomingClasses: {
    id: string;
    dateMonth: string;
    dateDay: string;
    title: string;
    timeAndLocation: string;
  }[];
  achievements: DashboardAchievement[];
}

const emptyDashboardData: DashboardData = {
  userProfile: {
    targetBand: null,
    examDate: null,
  },
  stats: {
    totalTestsCompleted: 0,
    averageBandScore: 0,
    currentLearningStreak: 0,
  },
  progress: {
    baselineScore: null,
    listeningScore: 0,
    readingScore: 0,
    writingScore: 0,
    speakingScore: 0,
    targetScore: 0,
  },
  recentActivity: [],
  upcomingClasses: [],
  achievements: [],
};

const normalizeDashboardData = (
  incoming: Partial<DashboardData> | null | undefined
): DashboardData => ({
  userProfile: {
    targetBand: incoming?.userProfile?.targetBand ?? null,
    examDate: incoming?.userProfile?.examDate ?? null,
  },
  stats: {
    totalTestsCompleted: incoming?.stats?.totalTestsCompleted ?? 0,
    averageBandScore: incoming?.stats?.averageBandScore ?? 0,
    currentLearningStreak: incoming?.stats?.currentLearningStreak ?? 0,
  },
  progress: {
    baselineScore: incoming?.progress?.baselineScore ?? null,
    listeningScore: incoming?.progress?.listeningScore ?? 0,
    readingScore: incoming?.progress?.readingScore ?? 0,
    writingScore: incoming?.progress?.writingScore ?? 0,
    speakingScore: incoming?.progress?.speakingScore ?? 0,
    targetScore: incoming?.progress?.targetScore ?? 0,
  },
  recentActivity: incoming?.recentActivity ?? [],
  upcomingClasses: incoming?.upcomingClasses ?? [],
  achievements: Array.isArray(incoming?.achievements)
    ? incoming.achievements.map((achievement, index) => ({
      id: achievement?.id || `achievement_${index + 1}`,
      title: achievement?.title || "Achievement",
      description: achievement?.description || undefined,
      icon: achievement?.icon || undefined,
      completed: Boolean(achievement?.completed),
      progress:
        achievement?.progress &&
          typeof achievement.progress.current === "number" &&
          typeof achievement.progress.target === "number"
          ? {
            current: achievement.progress.current,
            target: achievement.progress.target,
          }
          : undefined,
    }))
    : [],
});

export const dashboardService = {
  fetchDashboardData: async (email?: string): Promise<DashboardData> => {
    const url = email ? `/api/dashboard?email=${encodeURIComponent(email)}` : "/api/dashboard";
    const response = await apiRequest<Partial<DashboardData>>(url);
    return normalizeDashboardData(response || emptyDashboardData);
  },
};
