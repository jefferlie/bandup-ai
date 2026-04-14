import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import ApiErrorState from "../components/ApiErrorState";
import { settingsService, type UserSettings } from "../services/settingsService";

const Settings = () => {
  const { user } = useAuth();
  const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState<UserSettings | null>(null);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["settings", user?.email],
    queryFn: () => settingsService.fetchSettings(user?.email),
    enabled: !!user,
  });

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        profile: {
          ...data.profile,
          name: user?.name || data.profile.name,
          email: user?.email || data.profile.email,
        },
      });
      localStorage.setItem("targetBand", String(data.studyPreferences.targetBand || ""));
      if (data.studyPreferences.examDate) {
        localStorage.setItem("examDate", data.studyPreferences.examDate);
      } else {
        localStorage.removeItem("examDate");
      }
    }
  }, [data, user?.email, user?.name]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UserSettings) =>
      settingsService.updateSettings(payload, user?.email),
    onSuccess: (updated) => {
      setForm(updated);
      localStorage.setItem(
        "targetBand",
        String(updated.studyPreferences.targetBand || "")
      );
      if (updated.studyPreferences.examDate) {
        localStorage.setItem("examDate", updated.studyPreferences.examDate);
      } else {
        localStorage.removeItem("examDate");
      }
      setStatusMessage("Settings saved.");
    },
    onError: (updateError) => {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Failed to save settings.";
      setStatusMessage(message);
    },
  });

  const availableAvatars = useMemo(
    () => [
      "/avatars/avatar_1.png",
      "/avatars/avatar_2.png",
      "/avatars/avatar_3.png",
      "/avatars/avatar_4.png",
    ],
    []
  );

  const setFormValue = <K extends keyof UserSettings>(
    section: K,
    value: UserSettings[K]
  ) => {
    setForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [section]: value,
      };
    });
  };

  if (isLoading || !form) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Account Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your profile details, study goals, and security preferences.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ApiErrorState
              compact
              title="Failed to load settings"
              message="Check endpoint `/api/settings` or local fallback."
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">
                Personal Information
              </h2>

              <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => setIsSelectingAvatar(true)}
                >
                  <img
                    alt="Profile Avatar"
                    className="h-24 w-24 rounded-full object-cover border-4 border-slate-50 dark:border-slate-800"
                    src={form.profile.avatarUrl}
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="material-symbols-outlined text-white">
                      photo_camera
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-center sm:text-left">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {form.profile.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Student ID: #{user?.id || "N/A"}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center sm:justify-start">
                    <button
                      onClick={() => setIsSelectingAvatar(!isSelectingAvatar)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Change Avatar
                    </button>
                  </div>
                </div>
              </div>

              {isSelectingAvatar && (
                <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    Choose an Avatar
                  </h4>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {availableAvatars.map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt={`Avatar option ${idx + 1}`}
                        className={`w-16 h-16 rounded-full cursor-pointer border-2 transition-all ${
                          form.profile.avatarUrl === src
                            ? "border-primary shadow-md scale-110"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        onClick={() => {
                          setFormValue("profile", {
                            ...form.profile,
                            avatarUrl: src,
                          });
                          setIsSelectingAvatar(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    className="rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    type="text"
                    value={form.profile.name}
                    onChange={(e) =>
                      setFormValue("profile", {
                        ...form.profile,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    className="rounded-lg border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                    readOnly
                    type="email"
                    value={form.profile.email}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <input
                    className="rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    type="tel"
                    value={form.profile.phone}
                    onChange={(e) =>
                      setFormValue("profile", {
                        ...form.profile,
                        phone: e.target.value,
                      })
                    }
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Timezone
                  </label>
                  <select
                    value={form.profile.timezone}
                    onChange={(e) =>
                      setFormValue("profile", {
                        ...form.profile,
                        timezone: e.target.value,
                      })
                    }
                    className="rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Asia/Almaty">Asia/Almaty</option>
                    <option value="Asia/Astana">Asia/Astana</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">
                Study Preferences
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Target IELTS Score
                  </label>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    max={9}
                    min={0}
                    step={0.5}
                    type="number"
                    value={form.studyPreferences.targetBand}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        targetBand: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Current IELTS Score
                  </label>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    max={9}
                    min={0}
                    step={0.5}
                    type="number"
                    value={form.studyPreferences.currentBand ?? ""}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        currentBand: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Primary Exam
                  </label>
                  <select
                    value={form.studyPreferences.primaryExam}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        primaryExam: e.target.value === "sat" ? "sat" : "ielts",
                      })
                    }
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="ielts">IELTS</option>
                    <option value="sat">SAT</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Target Exam Date
                  </label>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    type="date"
                    value={form.studyPreferences.examDate || ""}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        examDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Target SAT Score
                  </label>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    max={1600}
                    min={400}
                    step={10}
                    type="number"
                    value={form.studyPreferences.targetSatScore ?? ""}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        targetSatScore: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="1200"
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Study Hours Per Week
                  </label>
                  <input
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    max={40}
                    min={1}
                    step={1}
                    type="number"
                    value={form.studyPreferences.studyHoursPerWeek}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        studyHoursPerWeek: Number(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Weekly study load for auto-planning and reminders.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Preferred Study Time
                  </label>
                  <select
                    value={form.studyPreferences.preferredStudyTime}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        preferredStudyTime:
                          e.target.value === "morning" ||
                          e.target.value === "afternoon" ||
                          e.target.value === "evening"
                            ? e.target.value
                            : "flexible",
                      })
                    }
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="flexible">Flexible</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Focus Skills
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        "listening",
                        "reading",
                        "writing",
                        "speaking",
                      ] as const
                    ).map((skill) => {
                      const checked = form.studyPreferences.focusSkills.includes(skill);
                      return (
                        <label
                          key={skill}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextSkills = e.target.checked
                                ? [...form.studyPreferences.focusSkills, skill]
                                : form.studyPreferences.focusSkills.filter((item) => item !== skill);
                              setFormValue("studyPreferences", {
                                ...form.studyPreferences,
                                focusSkills: Array.from(new Set(nextSkills)),
                              });
                            }}
                          />
                          <span className="capitalize">{skill}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Used for personalization, schedule hints, and recommendations.
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    How did you hear about BandUp?
                  </label>
                  <select
                    value={form.studyPreferences.discoverySource}
                    onChange={(e) =>
                      setFormValue("studyPreferences", {
                        ...form.studyPreferences,
                        discoverySource:
                          e.target.value === "instagram" ||
                          e.target.value === "youtube" ||
                          e.target.value === "tiktok" ||
                          e.target.value === "friend" ||
                          e.target.value === "google" ||
                          e.target.value === "school"
                            ? e.target.value
                            : "other",
                      })
                    }
                    className="w-full rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="friend">Friend</option>
                    <option value="google">Google Search</option>
                    <option value="school">School / Teacher</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">
                Account Security
              </h2>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      New Password
                    </label>
                    <input
                      className="rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="••••••••"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Confirm New Password
                    </label>
                    <input
                      className="rounded-lg border-slate-200 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="••••••••"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-red-600">Passwords do not match.</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Two-Factor Authentication
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Secure your account with 2FA.
                    </span>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      className="peer sr-only"
                      type="checkbox"
                      checked={form.security.twoFactorEnabled}
                      onChange={(e) =>
                        setFormValue("security", {
                          twoFactorEnabled: e.target.checked,
                        })
                      }
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                Notifications
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Email Alerts
                  </span>
                  <input
                    type="checkbox"
                    checked={form.notifications.emailAlerts}
                    onChange={(e) =>
                      setFormValue("notifications", {
                        ...form.notifications,
                        emailAlerts: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Study Reminders
                  </span>
                  <input
                    type="checkbox"
                    checked={form.notifications.studyReminders}
                    onChange={(e) =>
                      setFormValue("notifications", {
                        ...form.notifications,
                        studyReminders: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Product Updates
                  </span>
                  <input
                    type="checkbox"
                    checked={form.notifications.productUpdates}
                    onChange={(e) =>
                      setFormValue("notifications", {
                        ...form.notifications,
                        productUpdates: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 rounded-xl shadow-sm flex items-center justify-between gap-4">
          <span className="text-sm text-slate-500">{statusMessage}</span>
          <button
            onClick={() => {
              if (newPassword && newPassword !== confirmPassword) {
                setStatusMessage("Passwords do not match.");
                return;
              }
              updateMutation.mutate(form);
            }}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
