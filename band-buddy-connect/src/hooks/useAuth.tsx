import { useState, useEffect, createContext, useContext } from "react";
import { apiRequest } from "@/lib/apiClient";

interface User {
  id?: string;
  name: string;
  email: string;
  role?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface RegisterOnboardingPayload {
  primaryExam: "ielts" | "sat";
  targetIeltsScore: number | null;
  currentIeltsScore: number | null;
  targetExamDate: string | null;
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
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    onboarding?: RegisterOnboardingPayload
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };

  const normalizeUser = (rawUser: Record<string, unknown>): User => {
    const role = String(rawUser.role || "student");
    return {
      id: rawUser.id ? String(rawUser.id) : undefined,
      name: String(rawUser.name || "Student"),
      email: String(rawUser.email || ""),
      role,
      isAdmin: Boolean(rawUser.isAdmin) || role === "admin",
      createdAt: rawUser.createdAt ? String(rawUser.createdAt) : undefined,
    };
  };
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);
  const login = async (email: string, password: string) => {
    try {
      const res = await apiRequest<{ token?: string; user?: Record<string, unknown> }>(
        "/auth/login",
        {
          method: "POST",
          withAuth: false,
          body: {
            email,
            password,
          },
        }
      );

      const { token, user } = res;

      if (!token || !user) {
        return { success: false, error: "Invalid server response" };
      }

      const normalizedUser = normalizeUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err, "Login failed"),
      };
    }
  };
  const register = async (
    name: string,
    email: string,
    password: string,
    onboarding?: RegisterOnboardingPayload
  ) => {
    try {
      const res = await apiRequest<{ token?: string; user?: Record<string, unknown> }>(
        "/auth/register",
        {
          method: "POST",
          withAuth: false,
          body: {
            name,
            email,
            password,
            onboarding,
          },
        }
      );

      const { token, user } = res;

      if (!token || !user) {
        return { success: false, error: "Invalid server response" };
      }

      const normalizedUser = normalizeUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      if (onboarding) {
        const targetBand = onboarding.targetIeltsScore;
        const examDate = onboarding.targetExamDate;
        if (typeof targetBand === "number" && Number.isFinite(targetBand)) {
          localStorage.setItem("targetBand", String(targetBand));
        } else {
          localStorage.removeItem("targetBand");
        }
        if (typeof examDate === "string" && examDate) {
          localStorage.setItem("examDate", examDate);
        } else {
          localStorage.removeItem("examDate");
        }
      }
      setUser(normalizedUser);

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err, "Registration failed"),
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
