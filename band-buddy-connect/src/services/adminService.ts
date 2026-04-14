import { apiRequest } from "@/lib/apiClient";

export interface AdminStats {
  totalUsers: number;
  activeCourses: number;
  newReports: number;
  mediaFiles: number;
  activeUsers: number;
  newRegistrations: number;
  avgStudyHours: number;
  activeSubscriptions: number;
  totalRevenue: number;
  totalPayments: number;
}

export interface AdminUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  status: "active" | "blocked" | "pending";
  subscription_status: string;
  stripe_price_id?: string | null;
  current_period_end?: string | null;
  created_at?: string;
}

export interface AdminSubscription {
  id: string | number;
  user_id: number;
  email: string;
  full_name: string;
  status: string;
  stripe_price_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  created_at?: string;
}

export interface AdminPayment {
  id: string | number;
  user_id: number;
  email: string;
  full_name: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  description?: string | null;
  created_at?: string;
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
  subscriptions: AdminSubscription[];
  payments: AdminPayment[];
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
    activeSubscriptions: 0,
    totalRevenue: 0,
    totalPayments: 0,
  },
  users: [],
  subscriptions: [],
  payments: [],
  reports: [],
  media: [],
  settings: {
    autoModeration: false,
    emailNotifications: false,
    pushNotifications: false,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeAdminOverview = (incoming: any): AdminOverviewData => ({
  stats: {
    totalUsers: incoming?.stats?.totalUsers ?? incoming?.stats?.total_users ?? 0,
    activeCourses: incoming?.stats?.activeCourses ?? 0,
    newReports: incoming?.stats?.newReports ?? 0,
    mediaFiles: incoming?.stats?.mediaFiles ?? 0,
    activeUsers: incoming?.stats?.activeUsers ?? incoming?.stats?.active_users ?? 0,
    newRegistrations: incoming?.stats?.newRegistrations ?? 0,
    avgStudyHours: incoming?.stats?.avgStudyHours ?? 0,
    activeSubscriptions: incoming?.stats?.activeSubscriptions ?? incoming?.stats?.active_subscriptions ?? 0,
    totalRevenue: incoming?.stats?.totalRevenue ?? incoming?.stats?.total_revenue ?? 0,
    totalPayments: incoming?.stats?.totalPayments ?? incoming?.stats?.total_payments ?? 0,
  },
  users: (incoming?.users ?? []).map((u: any, i: number) => ({
    id: u.id ?? i,
    name: u.full_name ?? u.name ?? "Unknown",
    email: u.email ?? "",
    role: u.role ?? "student",
    is_admin: Boolean(u.is_admin),
    status: u.subscription_status === "active" ? "active" : "active",
    subscription_status: u.subscription_status ?? "inactive",
    stripe_price_id: u.stripe_price_id ?? null,
    current_period_end: u.current_period_end ?? null,
    created_at: u.created_at ?? "",
  })),
  subscriptions: (incoming?.subscriptions ?? []).map((s: any, i: number) => ({
    id: s.id ?? i,
    user_id: s.user_id,
    email: s.email ?? "",
    full_name: s.full_name ?? "",
    status: s.status ?? "inactive",
    stripe_price_id: s.stripe_price_id ?? null,
    stripe_subscription_id: s.stripe_subscription_id ?? null,
    current_period_start: s.current_period_start ?? null,
    current_period_end: s.current_period_end ?? null,
    cancel_at_period_end: Boolean(s.cancel_at_period_end),
    created_at: s.created_at ?? "",
  })),
  payments: (incoming?.payments ?? []).map((p: any, i: number) => ({
    id: p.id ?? i,
    user_id: p.user_id,
    email: p.email ?? "",
    full_name: p.full_name ?? "",
    amount: p.amount ?? 0,
    currency: p.currency ?? "kzt",
    status: p.status ?? "",
    payment_type: p.payment_type ?? "",
    description: p.description ?? null,
    created_at: p.created_at ?? "",
  })),
  reports: (incoming?.reports ?? []).map((r: any, i: number) => ({
    id: r.id ?? String(i),
    title: r.title ?? "Report",
    fromEmail: r.fromEmail ?? r.from_email ?? "",
    description: r.description ?? "",
    status: r.status ?? "new",
  })),
  media: (incoming?.media ?? []).map((m: any, i: number) => ({
    id: m.id ?? String(i),
    fileName: m.fileName ?? m.file_name ?? "file",
    sizeLabel: m.sizeLabel ?? m.size_label ?? "0 KB",
  })),
  settings: {
    autoModeration: Boolean(incoming?.settings?.autoModeration),
    emailNotifications: Boolean(incoming?.settings?.emailNotifications),
    pushNotifications: Boolean(incoming?.settings?.pushNotifications),
  },
});

export const adminService = {
  fetchOverview: async (): Promise<AdminOverviewData> => {
    const response = await apiRequest<AdminOverviewData>("/api/admin/overview");
    return normalizeAdminOverview(response ?? emptyAdminOverview);
  },

  deleteUser: async (userId: string | number): Promise<void> => {
    await apiRequest(`/api/admin/users/${userId}`, { method: "DELETE" });
  },

  updateUser: async (
    userId: string | number,
    data: { is_admin?: boolean; role?: string }
  ): Promise<void> => {
    await apiRequest(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
  },
};
