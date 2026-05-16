import { apiRequest } from "@/lib/apiClient";

export interface SATQuestion {
  id: string;
  section: "math" | "english" | "practice_test";
  domain: string;
  difficulty: "Easy" | "Medium" | "Hard";
  question_text: string;
  paragraph: string | null;
  choices: Record<string, string>;
  correct_answer: string;
  explanation: string;
  visual_type: string | null;
  visual_svg: string | null;
}

export interface SATPagination {
  total: number;
  limit: number;
  offset: number;
  totalPages: number;
  page: number;
}

export interface SATQuestionsResponse {
  questions: SATQuestion[];
  pagination: SATPagination;
}

export interface SATDomain {
  section: string;
  domain: string;
  count: number;
}

export interface SATStats {
  total: number;
  bySection: Record<string, number>;
  byDifficulty: Record<string, number>;
}

export interface SATFilters {
  section?: "math" | "english" | "practice_test";
  domain?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  limit?: number;
  offset?: number;
}

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

const fetchQuestions = (filters: SATFilters = {}): Promise<SATQuestionsResponse> =>
  apiRequest<SATQuestionsResponse>(
    `/api/sat/questions${buildQuery(filters as Record<string, string | number | undefined>)}`
  );

const fetchRandomQuestions = (
  section?: string,
  count = 10
): Promise<{ questions: SATQuestion[]; count: number }> =>
  apiRequest(`/api/sat/questions/random${buildQuery({ section, count })}`);

const fetchQuestion = (id: string): Promise<SATQuestion> =>
  apiRequest(`/api/sat/questions/${encodeURIComponent(id)}`);

const fetchDomains = (): Promise<{ domains: SATDomain[] }> =>
  apiRequest("/api/sat/domains");

const fetchStats = (): Promise<SATStats> =>
  apiRequest("/api/sat/stats");

export const satService = {
  fetchQuestions,
  fetchRandomQuestions,
  fetchQuestion,
  fetchDomains,
  fetchStats,
};
