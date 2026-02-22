import { apiRequest } from "@/lib/apiClient";

export interface AdminStats {
  totalUsers: number;
  activeCourses: number;
  newReports: number;
  mediaFiles: number;
  activeUsers: number;
  newRegistrations: number;
  avgStudyHours: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "blocked" | "pending";
}

export interface AdminReport {
  id: string;
  title: string;
  fromEmail: string;
  description: string;
  status: "new" | "in_progress" | "resolved";
}

export interface AdminMediaItem {
  id: string;
  fileName: string;
  sizeLabel: string;
}

export interface AdminSettings {
  autoModeration: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface AdminOverviewData {
  stats: AdminStats;
  users: AdminUser[];
  reports: AdminReport[];
  media: AdminMediaItem[];
  settings: AdminSettings;
}

export const emptyAdminOverview: AdminOverviewData = {
  stats: {
    totalUsers: 0,
    activeCourses: 0,
    newReports: 0,
    mediaFiles: 0,
    activeUsers: 0,
    newRegistrations: 0,
    avgStudyHours: 0,
  },
  users: [],
  reports: [],
  media: [],
  settings: {
    autoModeration: false,
    emailNotifications: false,
    pushNotifications: false,
  },
};

const normalizeAdminOverview = (
  incoming: Partial<AdminOverviewData> | null | undefined
): AdminOverviewData => ({
  stats: {
    totalUsers: incoming?.stats?.totalUsers ?? 0,
    activeCourses: incoming?.stats?.activeCourses ?? 0,
    newReports: incoming?.stats?.newReports ?? 0,
    mediaFiles: incoming?.stats?.mediaFiles ?? 0,
    activeUsers: incoming?.stats?.activeUsers ?? 0,
    newRegistrations: incoming?.stats?.newRegistrations ?? 0,
    avgStudyHours: incoming?.stats?.avgStudyHours ?? 0,
  },
  users:
    incoming?.users?.map((user, index) => ({
      id: user.id || String(index + 1),
      name: user.name || "Unknown",
      email: user.email || "",
      role: user.role || "student",
      status: user.status || "active",
    })) || [],
  reports:
    incoming?.reports?.map((report, index) => ({
      id: report.id || String(index + 1),
      title: report.title || "Report",
      fromEmail: report.fromEmail || "",
      description: report.description || "",
      status: report.status || "new",
    })) || [],
  media:
    incoming?.media?.map((item, index) => ({
      id: item.id || String(index + 1),
      fileName: item.fileName || "file",
      sizeLabel: item.sizeLabel || "0 KB",
    })) || [],
  settings: {
    autoModeration: Boolean(incoming?.settings?.autoModeration),
    emailNotifications: Boolean(incoming?.settings?.emailNotifications),
    pushNotifications: Boolean(incoming?.settings?.pushNotifications),
  },
});

export const adminService = {
  fetchOverview: async (): Promise<AdminOverviewData> => {
    const response = await apiRequest<Partial<AdminOverviewData>>(
      "/api/admin/overview"
    );
    return normalizeAdminOverview(response || emptyAdminOverview);
  },
};
