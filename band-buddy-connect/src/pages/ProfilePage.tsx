import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import { Award, BookOpen, Clock, Edit, Save, Target, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { profileService } from "../services/profileService";
import ApiErrorState from "../components/ApiErrorState";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const {
    data: profileSummary,
    isLoading: isProfileLoading,
    error: profileError,
    refetch,
  } = useQuery({
    queryKey: ["profileSummary"],
    queryFn: profileService.fetchSummary,
    enabled: !!user,
  });

  const progress = profileSummary?.progress || [];
  const achievements = profileSummary?.achievements || [];

  const totalCompleted = progress.reduce((sum, item) => sum + item.completed, 0);
  const totalAvailable = progress.reduce((sum, item) => sum + item.total, 0);
  const overallProgress =
    totalAvailable > 0 ? Math.round((totalCompleted / totalAvailable) * 100) : 0;

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
    if (user) {
      setEditName(user.name);
    }
  }, [user, isLoading, navigate]);

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(user?.name || "");
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header showAuth={true} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {profileError && (
          <div className="mb-6">
            <ApiErrorState
              compact
              title="Failed to load profile"
              message="Check endpoint `/api/profile/summary`."
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-2xl font-bold bg-background border border-input rounded px-2 py-1"
                    />
                    <button
                      onClick={handleSave}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {user.name}
                    </h1>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                )}
                <p className="text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  Member since{" "}
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
            <div className="text-right">
              {isProfileLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <>
                  <div className="text-3xl font-bold text-primary">
                    {overallProgress}%
                  </div>
                  <p className="text-sm text-muted-foreground">Overall progress</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-2xl font-bold text-blue-500">
                {totalCompleted}
              </span>
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Lessons Completed
            </h3>
            <p className="text-sm text-muted-foreground">
              Out of {totalAvailable} available
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-2xl font-bold text-green-500">
                {profileSummary?.studyHoursLastMonth ?? 0}
              </span>
            </div>
            <h3 className="font-semibold text-foreground mb-1">Study Hours</h3>
            <p className="text-sm text-muted-foreground">Over the last month</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-500" />
              </div>
              <span className="text-2xl font-bold text-yellow-500">
                {achievements.filter((a) => a.earned).length}
              </span>
            </div>
            <h3 className="font-semibold text-foreground mb-1">Achievements</h3>
            <p className="text-sm text-muted-foreground">
              Out of {achievements.length} available
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Subject Progress
          </h2>
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No progress data yet.
            </p>
          ) : (
            <div className="space-y-4">
              {progress.map((item) => (
                <div key={item.subject} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{item.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        Last activity: {item.lastActivity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-foreground">
                      {item.completed}/{item.total}
                    </div>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${
                            item.total > 0 ? (item.completed / item.total) * 100 : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Achievements</h2>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No achievements yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border ${
                    achievement.earned
                      ? "bg-green-50 border-green-200"
                      : "bg-muted border-border opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{achievement.icon || "🏆"}</div>
                    <div>
                      <h3 className="font-medium text-foreground">
                        {achievement.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
