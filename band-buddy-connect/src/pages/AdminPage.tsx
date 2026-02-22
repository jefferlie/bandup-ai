import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import {
  Eye,
  EyeOff,
  Users,
  FileText,
  BarChart3,
  Flag,
  Image,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminService } from "../services/adminService";
import ApiErrorState from "../components/ApiErrorState";

type TabType =
  | "dashboard"
  | "users"
  | "progress"
  | "reports"
  | "media"
  | "settings";

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, login, logout, isLoading } = useAuth();
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [search, setSearch] = useState("");

  const {
    data: adminOverview,
    isLoading: isOverviewLoading,
    error: overviewError,
    refetch,
  } = useQuery({
    queryKey: ["adminOverview"],
    queryFn: adminService.fetchOverview,
    enabled: Boolean(user?.isAdmin),
  });

  useEffect(() => {
    if (!isLoading && user && !user.isAdmin) {
      navigate("/dashboard");
    }
  }, [user, isLoading, navigate]);

  const filteredUsers = useMemo(() => {
    if (!adminOverview?.users.length) {
      return [];
    }
    const value = search.trim().toLowerCase();
    if (!value) {
      return adminOverview.users;
    }
    return adminOverview.users.filter(
      (u) => u.name.toLowerCase().includes(value) || u.email.toLowerCase().includes(value)
    );
  }, [adminOverview?.users, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await login(loginForm.email, loginForm.password);
    if (!result.success) {
      setError(result.error || "Invalid email or password");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const renderTabContent = () => {
    const stats = adminOverview?.stats;

    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Courses</p>
                    <p className="text-2xl font-bold">{stats?.activeCourses ?? 0}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">New Reports</p>
                    <p className="text-2xl font-bold">{stats?.newReports ?? 0}</p>
                  </div>
                  <Flag className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Media Files</p>
                    <p className="text-2xl font-bold">{stats?.mediaFiles ?? 0}</p>
                  </div>
                  <Image className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
            </div>
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full px-3 py-2 border border-input rounded-lg"
                />
              </div>
              <div className="overflow-x-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    No users found.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Role</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">{item.email}</td>
                          <td className="p-3">{item.role}</td>
                          <td className="p-3">
                            <span className="rounded-full border px-2 py-1 text-xs">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );

      case "progress":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Progress Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-4">User Activity</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Active Users</span>
                    <span className="font-semibold">{stats?.activeUsers ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>New Registrations</span>
                    <span className="font-semibold">{stats?.newRegistrations ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Study Time</span>
                    <span className="font-semibold">
                      {stats?.avgStudyHours ?? 0} hours
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "reports":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Reports</h2>
            <div className="space-y-4">
              {adminOverview?.reports.length ? (
                adminOverview.reports.map((report) => (
                  <div key={report.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{report.title}</h3>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                        {report.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      From: {report.fromEmail}
                    </p>
                    <p className="mb-3">{report.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No reports yet.
                </p>
              )}
            </div>
          </div>
        );

      case "media":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Media Management</h2>
            </div>
            {adminOverview?.media.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {adminOverview.media.map((item) => (
                  <div key={item.id} className="bg-card border border-border rounded-lg p-2">
                    <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-center">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground text-center">
                      {item.sizeLabel}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No media files available.</p>
            )}
          </div>
        );

      case "settings":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Platform Settings</h2>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-4">General Settings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Comment Auto-Moderation</span>
                    <input
                      type="checkbox"
                      checked={Boolean(adminOverview?.settings.autoModeration)}
                      readOnly
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-4">Notifications</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Email Notifications</span>
                    <input
                      type="checkbox"
                      checked={Boolean(adminOverview?.settings.emailNotifications)}
                      readOnly
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Push Notifications</span>
                    <input
                      type="checkbox"
                      checked={Boolean(adminOverview?.settings.pushNotifications)}
                      readOnly
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading || (user?.isAdmin && isOverviewLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header showAuth={false} />

        <main className="max-w-md mx-auto px-4 py-16">
          <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Admin Login
              </h1>
              <p className="text-muted-foreground">Sign in to the admin panel</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="admin-login" className="block text-sm font-medium text-foreground mb-2">
                  Admin Email
                </label>
                <input
                  type="text"
                  id="admin-login"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  required
                  className="w-full h-12 px-4 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-foreground mb-2">
                  Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="admin-password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    required
                    className="w-full h-12 px-4 pr-12 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full">
                Log In to Admin Panel
              </button>
            </form>

            <div className="mt-6 text-center">
              <button type="button" className="btn-secondary" onClick={() => navigate("/")}>
                Back to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header showAuth={false} />

      <div className="flex">
        <aside className="w-64 bg-card border-r border-border min-h-screen">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Admin Panel</h2>
          </div>
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "dashboard" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "users" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <Users size={18} />
              Users
            </button>
            <button
              onClick={() => setActiveTab("progress")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "progress" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <BarChart3 size={18} />
              Progress
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "reports" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <Flag size={18} />
              Reports
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "media" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <Image size={18} />
              Media Files
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "settings" ? "bg-primary text-white" : "hover:bg-muted"
              }`}
            >
              <Settings size={18} />
              Settings
            </button>
          </nav>
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted text-red-600"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6">
          {overviewError && (
            <div className="mb-6">
              <ApiErrorState
                compact
                title="Failed to load admin data"
                message="Check endpoint `/api/admin/overview`."
                onRetry={() => {
                  void refetch();
                }}
              />
            </div>
          )}
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
