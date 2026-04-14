import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "../components/Header";
import {
  Eye,
  EyeOff,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminService } from "../services/adminService";
import ApiErrorState from "../components/ApiErrorState";

type TabType = "dashboard" | "users" | "subscriptions" | "payments" | "settings";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Месячный",
  yearly: "Годовой",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-yellow-100 text-yellow-800",
  succeeded: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatKZT(amountTiyin: number) {
  const tenge = amountTiyin / 100;
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(tenge);
}

const AdminPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, login, logout, isLoading } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const filteredUsers = useMemo(() => {
    const list = adminOverview?.users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [adminOverview?.users, search]);

  const filteredSubs = useMemo(() => {
    const list = adminOverview?.subscriptions ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [adminOverview?.subscriptions, search]);

  const filteredPayments = useMemo(() => {
    const list = adminOverview?.payments ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [adminOverview?.payments, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await login(loginForm.email, loginForm.password);
    if (!result.success) {
      setError(result.error || "Неверный email или пароль");
    }
  };

  const handleDeleteUser = async (userId: string | number) => {
    if (!confirm("Удалить пользователя?")) return;
    setActionLoading(String(userId));
    try {
      await adminService.deleteUser(userId);
      await queryClient.invalidateQueries({ queryKey: ["adminOverview"] });
    } catch {
      alert("Ошибка при удалении");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: string | number, isAdmin: boolean) => {
    setActionLoading(String(userId) + "_admin");
    try {
      await adminService.updateUser(userId, { is_admin: !isAdmin });
      await queryClient.invalidateQueries({ queryKey: ["adminOverview"] });
    } catch {
      alert("Ошибка при обновлении");
    } finally {
      setActionLoading(null);
    }
  };

  const renderTabContent = () => {
    const stats = adminOverview?.stats;

    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Дашборд</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Всего пользователей" value={stats?.totalUsers ?? 0} icon={<Users className="h-8 w-8 text-primary" />} />
              <StatCard label="Активных подписок" value={stats?.activeSubscriptions ?? 0} icon={<CreditCard className="h-8 w-8 text-green-500" />} />
              <StatCard label="Платежей (успешных)" value={stats?.totalPayments ?? 0} icon={<BarChart3 className="h-8 w-8 text-primary" />} />
              <StatCard label="Общая выручка" value={formatKZT(stats?.totalRevenue ?? 0)} icon={<CreditCard className="h-8 w-8 text-yellow-500" />} />
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-4">Последние пользователи</h3>
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Имя</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Подписка</th>
                    <th className="text-left p-2">Дата регистрации</th>
                  </tr>
                </thead>
                <tbody>
                  {(adminOverview?.users ?? []).slice(0, 5).map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-2">{u.name}</td>
                      <td className="p-2">{u.email}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.subscription_status] ?? "bg-gray-100"}`}>
                          {u.subscription_status}
                        </span>
                      </td>
                      <td className="p-2">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Управление пользователями</h2>
              <button
                onClick={() => void refetch()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
              >
                <RefreshCw size={14} /> Обновить
              </button>
            </div>
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или email..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                />
              </div>
              <div className="overflow-x-auto">
                {filteredUsers.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Пользователи не найдены.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-3">ID</th>
                        <th className="text-left p-3">Имя</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Роль</th>
                        <th className="text-left p-3">Подписка</th>
                        <th className="text-left p-3">До</th>
                        <th className="text-left p-3">Админ</th>
                        <th className="text-left p-3">Дата рег.</th>
                        <th className="text-left p-3">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-t border-border hover:bg-muted/20">
                          <td className="p-3 text-muted-foreground">{u.id}</td>
                          <td className="p-3 font-medium">{u.name}</td>
                          <td className="p-3">{u.email}</td>
                          <td className="p-3">{u.role}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.subscription_status] ?? "bg-gray-100"}`}>
                              {u.subscription_status}
                            </span>
                          </td>
                          <td className="p-3">{formatDate(u.current_period_end)}</td>
                          <td className="p-3">
                            {u.is_admin ? (
                              <span className="text-xs text-green-600 font-semibold">Да</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Нет</span>
                            )}
                          </td>
                          <td className="p-3">{formatDate(u.created_at)}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => void handleToggleAdmin(u.id, u.is_admin)}
                                disabled={actionLoading === String(u.id) + "_admin"}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title={u.is_admin ? "Снять права админа" : "Назначить админом"}
                              >
                                <ShieldCheck size={15} className={u.is_admin ? "text-green-600" : ""} />
                              </button>
                              <button
                                onClick={() => void handleDeleteUser(u.id)}
                                disabled={actionLoading === String(u.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                                title="Удалить пользователя"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
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

      case "subscriptions":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Подписки пользователей</h2>
              <button
                onClick={() => void refetch()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
              >
                <RefreshCw size={14} /> Обновить
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">Активных</p>
                <p className="text-2xl font-bold text-green-800">
                  {(adminOverview?.subscriptions ?? []).filter((s) => s.status === "active").length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">Отменённых</p>
                <p className="text-2xl font-bold text-red-800">
                  {(adminOverview?.subscriptions ?? []).filter((s) => s.status === "cancelled").length}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Неактивных</p>
                <p className="text-2xl font-bold text-gray-800">
                  {(adminOverview?.subscriptions ?? []).filter((s) => s.status === "inactive").length}
                </p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или email..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                />
              </div>
              <div className="overflow-x-auto">
                {filteredSubs.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Подписки не найдены.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-3">Пользователь</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Тариф</th>
                        <th className="text-left p-3">Статус</th>
                        <th className="text-left p-3">Начало</th>
                        <th className="text-left p-3">Конец</th>
                        <th className="text-left p-3">Отмена</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                          <td className="p-3 font-medium">{s.full_name}</td>
                          <td className="p-3">{s.email}</td>
                          <td className="p-3">
                            {PLAN_LABELS[s.stripe_price_id ?? ""] ?? s.stripe_price_id ?? "—"}
                          </td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100"}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3">{formatDate(s.current_period_start)}</td>
                          <td className="p-3">{formatDate(s.current_period_end)}</td>
                          <td className="p-3">
                            {s.cancel_at_period_end ? (
                              <span className="text-xs text-red-600">Да</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Нет</span>
                            )}
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

      case "payments":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">История платежей</h2>
              <button
                onClick={() => void refetch()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
              >
                <RefreshCw size={14} /> Обновить
              </button>
            </div>
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или email..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                />
              </div>
              <div className="overflow-x-auto">
                {filteredPayments.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Платежи не найдены.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-3">Пользователь</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Сумма</th>
                        <th className="text-left p-3">Статус</th>
                        <th className="text-left p-3">Тип</th>
                        <th className="text-left p-3">Описание</th>
                        <th className="text-left p-3">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                          <td className="p-3 font-medium">{p.full_name}</td>
                          <td className="p-3">{p.email}</td>
                          <td className="p-3 font-semibold">{formatKZT(p.amount)}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100"}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3">{p.payment_type}</td>
                          <td className="p-3 text-muted-foreground text-xs max-w-[180px] truncate">{p.description ?? "—"}</td>
                          <td className="p-3">{formatDate(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Настройки платформы</h2>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-4">Общие настройки</h3>
              <div className="space-y-3">
                <SettingRow label="Автомодерация комментариев" checked={Boolean(adminOverview?.settings.autoModeration)} />
                <SettingRow label="Email-уведомления" checked={Boolean(adminOverview?.settings.emailNotifications)} />
                <SettingRow label="Push-уведомления" checked={Boolean(adminOverview?.settings.pushNotifications)} />
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
          <p className="text-muted-foreground">Загрузка...</p>
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
              <h1 className="text-3xl font-bold text-foreground mb-2">Вход в панель</h1>
              <p className="text-muted-foreground">Войдите как администратор</p>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div>
                <label htmlFor="admin-login" className="block text-sm font-medium mb-2">Admin Email</label>
                <input
                  type="text"
                  id="admin-login"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  className="w-full h-12 px-4 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium mb-2">Пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="admin-password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    className="w-full h-12 px-4 pr-12 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Введите пароль"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
              )}
              <button type="submit" className="btn-primary w-full">Войти в панель</button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" className="btn-secondary" onClick={() => navigate("/")}>На главную</button>
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
        <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Админ-панель</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <nav className="p-4 space-y-1 flex-1">
            {(
              [
                { id: "dashboard", label: "Дашборд", icon: <BarChart3 size={18} /> },
                { id: "users", label: "Пользователи", icon: <Users size={18} /> },
                { id: "subscriptions", label: "Подписки", icon: <CreditCard size={18} /> },
                { id: "payments", label: "Платежи", icon: <CreditCard size={18} /> },
                { id: "settings", label: "Настройки", icon: <Settings size={18} /> },
              ] as { id: TabType; label: string; icon: React.ReactNode }[]
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm ${
                  activeTab === item.id ? "bg-primary text-white" : "hover:bg-muted"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted text-red-600"
            >
              <LogOut size={18} /> Выйти
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6">
          {overviewError && (
            <div className="mb-6">
              <ApiErrorState
                compact
                title="Не удалось загрузить данные"
                message="Проверьте endpoint `/api/admin/overview`."
                onRetry={() => { void refetch(); }}
              />
            </div>
          )}
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function SettingRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm">{label}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${checked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {checked ? "Вкл" : "Выкл"}
      </span>
    </div>
  );
}

export default AdminPage;
