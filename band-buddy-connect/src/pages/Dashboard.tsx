import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { dashboardService } from "../services/dashboardService";
import { settingsService } from "../services/settingsService";
import ApiErrorState from "../components/ApiErrorState";
import { scheduleService, type SkillMode, type StudySession } from "../services/scheduleService";

const PRACTICE_ROUTE_BY_TYPE = {
  listening: "/practice/listening",
  reading: "/practice/reading",
  writing: "/practice/writing",
  speaking: "/practice/speaking",
} as const;

const ACHIEVEMENTS_COLLAPSED_LIMIT = 3;
const SCHEDULE_TABS = ["today", "week"] as const;

const SKILL_META: Record<
  SkillMode,
  { label: string; icon: string; progressColor: string; iconTone: string; cardTone: string }
> = {
  listening: {
    label: "Listening",
    icon: "headphones",
    progressColor: "bg-primary",
    iconTone: "text-primary",
    cardTone: "bg-blue-50 dark:bg-blue-900/20",
  },
  reading: {
    label: "Reading",
    icon: "menu_book",
    progressColor: "bg-accent-green",
    iconTone: "text-accent-green",
    cardTone: "bg-green-50 dark:bg-green-900/20",
  },
  writing: {
    label: "Writing",
    icon: "edit",
    progressColor: "bg-accent-purple",
    iconTone: "text-accent-purple",
    cardTone: "bg-purple-50 dark:bg-purple-900/20",
  },
  speaking: {
    label: "Speaking",
    icon: "mic",
    progressColor: "bg-indigo-500",
    iconTone: "text-indigo-500",
    cardTone: "bg-indigo-50 dark:bg-indigo-900/20",
  },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAvatarBroken, setIsAvatarBroken] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [activeScheduleTab, setActiveScheduleTab] = useState<(typeof SCHEDULE_TABS)[number]>("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleSessions, setScheduleSessions] = useState<StudySession[]>([]);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    mode: SkillMode;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
  } | null>(null);
  const [newSessionDraft, setNewSessionDraft] = useState({
    mode: "reading" as SkillMode,
    title: "",
    date: scheduleService.toDateKey(new Date()),
    startTime: "18:00",
    durationMinutes: scheduleService.getModeDuration("reading"),
  });

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardData', user?.email],
    queryFn: () => dashboardService.fetchDashboardData(user?.email)
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.email],
    queryFn: () => settingsService.fetchSettings(user?.email),
    enabled: !!user,
  });

  const avatarUrl = settings?.profile.avatarUrl;

  const refreshSchedule = async () => {
    const sessions = await scheduleService.fetchSessions(user?.email);
    setScheduleSessions(sessions);
  };

  useEffect(() => {
    setIsAvatarBroken(false);
  }, [avatarUrl]);

  useEffect(() => {
    void refreshSchedule();
  }, [user?.email]);

  const initials = useMemo(() => {
    const source = (user?.name || settings?.profile.name || "").trim();
    if (!source) {
      return "EC";
    }

    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }, [settings?.profile.name, user?.name]);

  const showProfileImage = Boolean(avatarUrl) && !isAvatarBroken;

  const todaySessions = useMemo(
    () => scheduleService.getTodaySessions(scheduleSessions),
    [scheduleSessions]
  );
  const upcomingSessions = useMemo(
    () => scheduleService.getUpcomingSessions(scheduleSessions, 4),
    [scheduleSessions]
  );
  const missedSessions = useMemo(
    () => scheduleService.getMissedSessions(scheduleSessions),
    [scheduleSessions]
  );
  const nextScheduledSession = upcomingSessions[0];

  const weekStart = useMemo(() => {
    const base = scheduleService.startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);
  const weekDays = useMemo(() => scheduleService.getWeekDays(weekStart), [weekStart]);
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 2) {
      return "";
    }
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.shortLabel} ${first.dayNumber} - ${last.shortLabel} ${last.dayNumber}`;
  }, [weekDays]);
  const sessionsByDate = useMemo(
    () => scheduleService.getSessionsByDate(scheduleSessions),
    [scheduleSessions]
  );
  const weakestSkill = useMemo(
    () => scheduleService.getWeakestMode(dashboard?.progress),
    [dashboard?.progress]
  );

  const resumeUrl = useMemo(() => {
    if (nextScheduledSession) {
      return scheduleService.getSessionRoute(nextScheduledSession);
    }

    const recent = dashboard?.recentActivity?.[0];
    if (!recent) {
      return "/tests/reading";
    }

    const basePath = PRACTICE_ROUTE_BY_TYPE[recent.type];
    if (!basePath) {
      return "/tests/reading";
    }

    if (recent.testId) {
      return `${basePath}?testId=${encodeURIComponent(recent.testId)}`;
    }

    return basePath;
  }, [dashboard?.recentActivity, nextScheduledSession]);

  const achievements = dashboard?.achievements ?? [];
  const completedAchievements = achievements.filter((achievement) => achievement.completed).length;
  const orderedAchievements = useMemo(
    () => [...achievements].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [achievements]
  );
  const visibleAchievements = showAllAchievements
    ? orderedAchievements
    : orderedAchievements.slice(0, ACHIEVEMENTS_COLLAPSED_LIMIT);

  const progressCards: Array<{ mode: SkillMode; value: number }> = [
    { mode: "listening", value: dashboard?.progress.listeningScore || 0 },
    { mode: "reading", value: dashboard?.progress.readingScore || 0 },
    { mode: "writing", value: dashboard?.progress.writingScore || 0 },
    { mode: "speaking", value: dashboard?.progress.speakingScore || 0 },
  ];

  const syncSessions = async (nextSessions: StudySession[]) => {
    const synced = await scheduleService.replaceSessionsRemote(nextSessions, user?.email);
    setScheduleSessions(synced);
    return synced;
  };

  const runScheduleMutation = async (mutate: () => void) => {
    scheduleService.replaceSessions(scheduleSessions);
    mutate();
    const localNext = scheduleService.listSessions();
    return syncSessions(localNext);
  };

  const runPointSessionMutation = async (mutate: () => Promise<unknown>) => {
    await mutate();
    setScheduleSessions(scheduleService.listSessions());
  };

  const addQuickSession = async (mode: SkillMode, dateKey?: string) => {
    await runPointSessionMutation(() =>
      scheduleService.createSessionRemote(
        {
        mode,
        date: dateKey || scheduleService.toDateKey(new Date()),
        source: "quick",
        durationMinutes: scheduleService.getModeDuration(mode),
        title: `${scheduleService.getModeLabel(mode)} Quick Session`,
        },
        user?.email
      )
    );
  };

  const handlePlanSkill = (mode: SkillMode) => {
    void addQuickSession(mode);
    setActiveScheduleTab("today");
    setIsScheduleOpen(true);
  };

  const handleEnsureTodayPlan = async () => {
    await runScheduleMutation(() => {
      scheduleService.createTodayPlan(dashboard?.progress);
    });
    setActiveScheduleTab("today");
  };

  const handleAutoPlan = async () => {
    await runScheduleMutation(() => {
      scheduleService.applyAutoPlan(dashboard?.progress, {
        examDate:
          localStorage.getItem("examDate") || dashboard?.userProfile?.examDate || null,
        targetBand:
          Number(localStorage.getItem("targetBand")) || dashboard?.userProfile?.targetBand || null,
        replaceFuture: true,
      });
    });
    setActiveScheduleTab("week");
  };

  const handleCatchUpPlan = async () => {
    await runScheduleMutation(() => {
      scheduleService.applyCatchUpPlan(2);
    });
    setActiveScheduleTab("today");
  };

  const handleExportIcs = () => {
    const content = scheduleService.exportToIcs(scheduleSessions);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bandup-study-plan.ics";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const toggleSessionStatus = async (session: StudySession) => {
    const nextStatus = session.status === "completed" ? "planned" : "completed";
    await runPointSessionMutation(() =>
      scheduleService.updateSessionRemote(session.id, { status: nextStatus }, user?.email)
    );
  };

  const removeSession = async (sessionId: string) => {
    await runPointSessionMutation(() =>
      scheduleService.deleteSessionRemote(sessionId, user?.email)
    );
  };

  const moveSessionToDate = async (sessionId: string, nextDateKey: string) => {
    await runPointSessionMutation(() =>
      scheduleService.updateSessionRemote(
        sessionId,
        {
        date: nextDateKey,
        status: "planned",
        source: "manual",
        },
        user?.email
      )
    );
  };

  const openEditor = (session: StudySession) => {
    setEditingSessionId(session.id);
    setEditDraft({
      mode: session.mode,
      title: session.title,
      date: session.date,
      startTime: session.startTime,
      durationMinutes: session.durationMinutes,
    });
  };

  const saveEditor = async () => {
    if (!editingSessionId || !editDraft) {
      return;
    }
    const duration = Math.max(5, Math.round(editDraft.durationMinutes || 0));
    await runPointSessionMutation(() =>
      scheduleService.updateSessionRemote(
        editingSessionId,
        {
        mode: editDraft.mode,
        title: editDraft.title.trim() || `${scheduleService.getModeLabel(editDraft.mode)} Session`,
        date: editDraft.date,
        startTime: editDraft.startTime,
        durationMinutes: duration,
        },
        user?.email
      )
    );
    setEditingSessionId(null);
    setEditDraft(null);
  };

  const createManualSession = async () => {
    const duration = Math.max(5, Math.round(newSessionDraft.durationMinutes || 0));
    await runPointSessionMutation(() =>
      scheduleService.createSessionRemote(
        {
        mode: newSessionDraft.mode,
        title:
          newSessionDraft.title.trim() ||
          `${scheduleService.getModeLabel(newSessionDraft.mode)} Session`,
        date: newSessionDraft.date,
        startTime: newSessionDraft.startTime,
        durationMinutes: duration,
        source: "manual",
        },
        user?.email
      )
    );
    setNewSessionDraft((prev) => ({
      ...prev,
      title: "",
    }));
  };

  const formatSessionTime = (session: StudySession) =>
    `${session.startTime} • ${session.durationMinutes} min`;

  const formatSessionDay = (session: StudySession) => {
    const [year, month, day] = session.date.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return scheduleService.formatDayMeta(date);
  };

  const formatAchievementValue = (value: number) => (
    Number.isInteger(value) ? value.toString() : value.toFixed(1)
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-10 relative">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            {showProfileImage ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-14 h-14 rounded-full object-cover shadow-lg border-2 border-white dark:border-slate-800"
                onError={() => setIsAvatarBroken(true)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20 border-2 border-white dark:border-slate-800">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back, {user?.name || "Student"}!</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Target Band: <span className="font-semibold text-primary">{localStorage.getItem('targetBand') || dashboard?.userProfile?.targetBand || 'N/A'}</span> • Exam Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{localStorage.getItem('examDate') || dashboard?.userProfile?.examDate || 'Not set'}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.instagram.com/bandup_ai?igsh=MTN2Z2o1Ym5jNmhuYw==" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors">
              <i className="fa-brands fa-instagram text-xl"></i>
            </a>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button
              onClick={() => setIsScheduleOpen(true)}
              className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-lg font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-slate-400">calendar_today</span>
              Schedule
              {todaySessions.filter((session) => session.status === "planned").length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-primary dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                  {todaySessions.filter((session) => session.status === "planned").length}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate(resumeUrl)}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all transform hover:translate-y-[-1px]"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              {nextScheduledSession ? "Start Planned Session" : "Resume Practice"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6">
            <ApiErrorState
              compact
              title="Failed to load dashboard"
              message="Check endpoint `/api/dashboard`."
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                  <span className="material-symbols-outlined text-2xl">library_books</span>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{dashboard?.stats.totalTestsCompleted || 0}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Tests Completed</p>
              </div>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-accent-green">
                  <span className="material-symbols-outlined text-2xl">analytics</span>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{dashboard?.stats.averageBandScore || 0}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Average Band Score</p>
              </div>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-accent-purple">
                  <span className="material-symbols-outlined text-2xl">local_fire_department</span>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">{dashboard?.stats.currentLearningStreak || 0} <span className="text-lg font-medium text-slate-400">days</span></h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Current Learning Streak</p>
              </div>
              <div className="mt-4 flex gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < (dashboard?.stats.currentLearningStreak || 0) ? 'bg-accent-purple' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 lg:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-50/50 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">school</span>
                    Current Progress
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Based on diagnostic test (Baseline: {dashboard?.progress.baselineScore || 'N/A'})</p>
                </div>
                {dashboard?.progress.baselineScore && (
                  <span className="text-xs font-medium text-primary bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                    AI Analysis Active
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {progressCards.map((card) => {
                  const meta = SKILL_META[card.mode];
                  return (
                    <div
                      key={card.mode}
                      className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-100 dark:border-slate-700 shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                          <span
                            className={`material-symbols-outlined text-lg ${meta.iconTone}`}
                          >
                            {meta.icon}
                          </span>
                          {meta.label}
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {card.value}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                        <div
                          className={`${meta.progressColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${(card.value / 9) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Target: {dashboard?.progress.targetScore || "N/A"}
                        </p>
                        <button
                          onClick={() => handlePlanSkill(card.mode)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${meta.cardTone} ${meta.iconTone} border-slate-200 dark:border-slate-700 hover:brightness-95`}
                        >
                          Plan this skill
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  onClick={() => handlePlanSkill(weakestSkill)}
                  className="text-sm font-medium text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
                >
                  Plan weakest skill <span className="material-symbols-outlined text-sm">auto_awesome</span>
                </button>
                <button
                  onClick={() => setIsScheduleOpen(true)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                  Open planner <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </section>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                  dashboard.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === 'listening' ? 'bg-blue-100 dark:bg-blue-900/30 text-primary' :
                          activity.type === 'reading' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                            activity.type === 'writing' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                              'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                          }`}>
                          <span className="material-symbols-outlined">
                            {activity.type === 'listening' ? 'headphones' :
                              activity.type === 'reading' ? 'menu_book' :
                                activity.type === 'writing' ? 'edit' : 'mic'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{activity.title}</p>
                          <p className="text-xs text-slate-500">{activity.timeLabel}</p>
                        </div>
                      </div>
                      {activity.status === 'completed' ? (
                        <span className="text-sm font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded">{activity.score}</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded">{activity.score}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-slate-500 text-sm">No recent activity yet. Start a test to see history here!</div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Achievements</h2>
                <span className="text-lg font-bold text-slate-400">
                  {`${completedAchievements}/${achievements.length}`}
                </span>
              </div>
              {achievements.length > 0 && (
                <div className="mb-5">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${achievements.length > 0 ? (completedAchievements / achievements.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {achievements.length > 0 ? (
                  visibleAchievements.map((achievement) => {
                    const hasProgress = Boolean(achievement.progress && achievement.progress.target > 0);
                    const progressPercent = hasProgress
                      ? Math.max(
                        0,
                        Math.min(100, (achievement.progress!.current / achievement.progress!.target) * 100)
                      )
                      : 0;
                    const progressLabel = hasProgress
                      ? `${formatAchievementValue(achievement.progress!.current)}/${formatAchievementValue(achievement.progress!.target)}`
                      : null;

                    return (
                      <div
                        key={achievement.id}
                        className={`rounded-lg border p-3 transition-colors ${achievement.completed
                            ? "border-primary/25 bg-blue-50/50 dark:bg-blue-900/10"
                            : "border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${achievement.completed
                              ? "bg-primary text-white"
                              : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">
                              {achievement.completed ? "check" : achievement.icon || "military_tech"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-semibold ${achievement.completed ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200"
                                }`}>
                                {achievement.title}
                              </span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${achievement.completed
                                  ? "bg-primary/10 text-primary"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                                }`}>
                                {achievement.completed ? "Unlocked" : "In progress"}
                              </span>
                            </div>
                            {showAllAchievements && achievement.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{achievement.description}</p>
                            )}
                            {hasProgress && (
                              <div className="mt-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Progress</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300">{progressLabel}</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${achievement.completed ? "bg-primary" : "bg-slate-400 dark:bg-slate-500"}`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-slate-500 text-sm">No achievements available yet.</div>
                )}
              </div>
              {orderedAchievements.length > ACHIEVEMENTS_COLLAPSED_LIMIT && (
                <button
                  onClick={() => setShowAllAchievements((prev) => !prev)}
                  className="mt-4 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  {showAllAchievements
                    ? "Show less"
                    : `Show all (${orderedAchievements.length})`}
                  <span className="material-symbols-outlined text-base">
                    {showAllAchievements ? "expand_less" : "expand_more"}
                  </span>
                </button>
              )}
            </div>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-500">Up Next</h3>
                <button
                  onClick={() => setIsScheduleOpen(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Open Planner
                </button>
              </div>
              <div className="space-y-4">
                {upcomingSessions.length > 0 ? (
                  upcomingSessions.slice(0, 3).map((session) => {
                    const [year, month, day] = session.date.split("-").map(Number);
                    const date = new Date(year, (month || 1) - 1, day || 1);
                    const monthLabel = date
                      .toLocaleDateString("en-US", { month: "short" })
                      .toUpperCase();
                    const modeMeta = SKILL_META[session.mode];

                    return (
                      <div key={session.id} className="flex gap-4 items-start">
                        <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-2 w-14 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">{monthLabel}</span>
                          <span className="text-xl font-bold text-slate-900 dark:text-white">
                            {day}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1">
                            {scheduleService.getModeLabel(session.mode)} Session
                          </h4>
                          <p className="text-xs text-slate-500 mb-2">
                            {session.startTime} • {session.durationMinutes} min
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(scheduleService.getSessionRoute(session))}
                              className="px-3 py-1 text-xs font-medium text-primary border border-primary/30 rounded hover:bg-primary/5 transition-colors"
                            >
                              Start
                            </button>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${modeMeta.cardTone} ${modeMeta.iconTone}`}
                            >
                              {modeMeta.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-slate-500 text-sm">
                    No planned sessions yet. Create a Today plan to fill this section.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {isScheduleOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm p-4 sm:p-6">
            <div className="mx-auto h-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Study Planner
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Build your day and week plan, then launch sessions from here.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsScheduleOpen(false)}
                    className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      void handleEnsureTodayPlan();
                    }}
                    className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">today</span>
                    Create Today Plan
                  </button>
                  <button
                    onClick={() => {
                      void handleAutoPlan();
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Auto-plan to Exam Date
                  </button>
                  <button
                    onClick={handleExportIcs}
                    disabled={scheduleSessions.length === 0}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    Export .ics
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {SCHEDULE_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveScheduleTab(tab)}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${activeScheduleTab === tab
                        ? "bg-primary text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                    >
                      {tab === "today" ? "Today Plan" : "Week Planner"}
                    </button>
                  ))}
                </div>

                {missedSessions.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      You missed {missedSessions.length} session{missedSessions.length > 1 ? "s" : ""}. Create a catch-up plan?
                    </p>
                    <button
                      onClick={() => {
                        void handleCatchUpPlan();
                      }}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      Add catch-up sessions
                    </button>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Add Session
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <select
                      value={newSessionDraft.mode}
                      onChange={(event) => {
                        const mode = event.target.value as SkillMode;
                        setNewSessionDraft((prev) => ({
                          ...prev,
                          mode,
                          durationMinutes: scheduleService.getModeDuration(mode),
                        }));
                      }}
                      className="md:col-span-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      {(["listening", "reading", "writing", "speaking"] as SkillMode[]).map((mode) => (
                        <option key={mode} value={mode}>
                          {scheduleService.getModeLabel(mode)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newSessionDraft.title}
                      onChange={(event) =>
                        setNewSessionDraft((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Title (optional)"
                      className="md:col-span-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                    <input
                      type="date"
                      value={newSessionDraft.date}
                      onChange={(event) =>
                        setNewSessionDraft((prev) => ({ ...prev, date: event.target.value }))
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                    <input
                      type="time"
                      value={newSessionDraft.startTime}
                      onChange={(event) =>
                        setNewSessionDraft((prev) => ({ ...prev, startTime: event.target.value }))
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={newSessionDraft.durationMinutes}
                        onChange={(event) =>
                          setNewSessionDraft((prev) => ({
                            ...prev,
                            durationMinutes: Number(event.target.value) || prev.durationMinutes,
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                      />
                      <button
                        onClick={() => {
                          void createManualSession();
                        }}
                        className="px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {editDraft && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-900/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Edit Session
                      </p>
                      <button
                        onClick={() => {
                          setEditingSessionId(null);
                          setEditDraft(null);
                        }}
                        className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                      <select
                        value={editDraft.mode}
                        onChange={(event) =>
                          setEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mode: event.target.value as SkillMode,
                                }
                              : prev
                          )
                        }
                        className="md:col-span-1 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        {(["listening", "reading", "writing", "speaking"] as SkillMode[]).map((mode) => (
                          <option key={mode} value={mode}>
                            {scheduleService.getModeLabel(mode)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={editDraft.title}
                        onChange={(event) =>
                          setEditDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                        }
                        className="md:col-span-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                      />
                      <input
                        type="date"
                        value={editDraft.date}
                        onChange={(event) =>
                          setEditDraft((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                        }
                        className="rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                      />
                      <input
                        type="time"
                        value={editDraft.startTime}
                        onChange={(event) =>
                          setEditDraft((prev) => (prev ? { ...prev, startTime: event.target.value } : prev))
                        }
                        className="rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={editDraft.durationMinutes}
                          onChange={(event) =>
                            setEditDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    durationMinutes:
                                      Number(event.target.value) || prev.durationMinutes,
                                  }
                                : prev
                            )
                          }
                          className="w-full rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                        />
                        <button
                          onClick={() => {
                            void saveEditor();
                          }}
                          disabled={!editingSessionId}
                          className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/60 dark:bg-slate-950/30">
                {activeScheduleTab === "today" ? (
                  todaySessions.length > 0 ? (
                    <div className="space-y-3">
                      {todaySessions.map((session) => {
                        const meta = SKILL_META[session.mode];
                        const statusTone =
                          session.status === "completed"
                            ? "bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300"
                            : session.status === "missed"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300";

                        return (
                          <div
                            key={session.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.cardTone}`}
                              >
                                <span className={`material-symbols-outlined ${meta.iconTone}`}>
                                  {meta.icon}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {session.title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatSessionDay(session)} • {formatSessionTime(session)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusTone}`}>
                                {session.status === "planned"
                                  ? "Planned"
                                  : session.status === "completed"
                                    ? "Completed"
                                    : "Missed"}
                              </span>
                              <button
                                onClick={() => navigate(scheduleService.getSessionRoute(session))}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                              >
                                Start
                              </button>
                              <button
                                onClick={() => openEditor(session)}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  void toggleSessionStatus(session);
                                }}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                {session.status === "completed" ? "Mark planned" : "Mark done"}
                              </button>
                              <button
                                onClick={() => {
                                  void removeSession(session.id);
                                }}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        No sessions for today
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Generate a quick 2-3 session plan in one click.
                      </p>
                      <button
                        onClick={() => {
                          void handleEnsureTodayPlan();
                        }}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
                      >
                        Create Today Plan
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => setWeekOffset((prev) => prev - 1)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Previous week
                      </button>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {weekRangeLabel}
                      </p>
                      <button
                        onClick={() => setWeekOffset((prev) => prev + 1)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Next week
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                      {weekDays.map((day) => {
                        const daySessions = sessionsByDate[day.dateKey] || [];
                        return (
                          <div
                            key={day.dateKey}
                            onDragOver={(event) => {
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const droppedId =
                                event.dataTransfer.getData("text/plain") || draggedSessionId;
                              if (!droppedId) {
                                return;
                              }
                              setDraggedSessionId(null);
                              if (day.dateKey !== scheduleSessions.find((s) => s.id === droppedId)?.date) {
                                void moveSessionToDate(droppedId, day.dateKey);
                              }
                            }}
                            className={`rounded-xl border bg-white dark:bg-slate-900 p-3 min-h-[180px] flex flex-col transition-colors ${draggedSessionId
                              ? "border-dashed border-blue-300 dark:border-blue-800"
                              : "border-slate-200 dark:border-slate-700"
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                {day.shortLabel}
                              </p>
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {day.dayNumber}
                              </span>
                            </div>
                            <div className="space-y-2 flex-1">
                              {daySessions.length > 0 ? (
                                daySessions.map((session) => {
                                  const meta = SKILL_META[session.mode];
                                  return (
                                    <div
                                      key={session.id}
                                      draggable
                                      onDragStart={(event) => {
                                        setDraggedSessionId(session.id);
                                        event.dataTransfer.effectAllowed = "move";
                                        event.dataTransfer.setData("text/plain", session.id);
                                      }}
                                      onDragEnd={() => setDraggedSessionId(null)}
                                      className={`rounded-lg border px-2 py-2 text-xs ${session.status === "completed"
                                        ? "border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20"
                                        : session.status === "missed"
                                          ? "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20"
                                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                                        }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`font-semibold ${meta.iconTone}`}>
                                          {session.startTime}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => openEditor(session)}
                                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                          >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              void removeSession(session.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500"
                                          >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                          </button>
                                        </div>
                                      </div>
                                      <p className="mt-0.5 text-slate-700 dark:text-slate-200">
                                        {scheduleService.getModeLabel(session.mode)}
                                      </p>
                                      <p className="text-[10px] text-slate-500">
                                        {session.durationMinutes} min
                                      </p>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-slate-400">No sessions</p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                void addQuickSession(weakestSkill, day.dateKey);
                              }}
                              className="mt-2 w-full text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 rounded-md py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              + Add {scheduleService.getModeLabel(weakestSkill)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
