import { ApiError, apiRequest } from "@/lib/apiClient";

export interface TestItem {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  badges: { label: string; bg: string; text: string }[];
}

export interface TestListFilters {
  page?: number;
  limit?: number;
  search?: string;
  questionType?: string;
  length?: string;
  examType?: string;
}

export interface TestListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TestListResult {
  tests: TestItem[];
  pagination: TestListPagination;
}

type TestMode = "reading" | "listening" | "writing" | "speaking";

type RawTestsResponse =
  | Partial<TestItem>[]
  | {
    tests: Partial<TestItem>[];
    pagination?: Partial<TestListPagination>;
  };

const defaultBadges = [
  {
    label: "Uncategorized",
    bg: "bg-slate-100 dark:bg-slate-700",
    text: "text-slate-700 dark:text-slate-300",
  },
];

const normalizeTests = (tests: Partial<TestItem>[] | null | undefined): TestItem[] =>
  (tests || []).map((test, index) => ({
    id: test.id || `test-${index + 1}`,
    title: test.title || "Untitled test",
    subtitle: test.subtitle || "",
    type: test.type || "Unknown",
    badges: test.badges && test.badges.length > 0 ? test.badges : defaultBadges,
  }));

const ENABLE_LOCAL_FALLBACK =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK !== "false";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 9;

const toPositiveInt = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.trunc(parsed));
    }
  }
  return fallback;
};

const normalizeFilterValue = (value: string | undefined, fallback: string) =>
  value && value.trim().length > 0 ? value.trim() : fallback;

const normalizeFilters = (filters: TestListFilters): Required<TestListFilters> => ({
  page: toPositiveInt(filters.page, DEFAULT_PAGE),
  limit: toPositiveInt(filters.limit, DEFAULT_LIMIT),
  search: normalizeFilterValue(filters.search, ""),
  questionType: normalizeFilterValue(filters.questionType, ""),
  length: normalizeFilterValue(filters.length, ""),
  examType: normalizeFilterValue(filters.examType, ""),
});

const buildQueryString = (filters: Required<TestListFilters>) => {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));

  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.questionType) {
    params.set("questionType", filters.questionType);
  }
  if (filters.length) {
    params.set("length", filters.length);
  }
  if (filters.examType) {
    params.set("examType", filters.examType);
  }

  return params.toString();
};

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenMatches = (content: string, filter: string) =>
  normalizeToken(content).includes(normalizeToken(filter));

const matchesFilters = (test: TestItem, filters: Required<TestListFilters>) => {
  if (filters.search) {
    const fullText = `${test.title} ${test.subtitle}`;
    if (!tokenMatches(fullText, filters.search)) {
      return false;
    }
  }

  if (filters.questionType) {
    if (!tokenMatches(test.type, filters.questionType)) {
      return false;
    }
  }

  if (filters.length) {
    const badgeLabels = test.badges.map((badge) => badge.label).join(" ");
    if (!tokenMatches(badgeLabels, filters.length)) {
      return false;
    }
  }

  if (filters.examType) {
    const badgeLabels = test.badges.map((badge) => badge.label).join(" ");
    const fullText = `${test.title} ${test.subtitle} ${badgeLabels}`;
    if (!tokenMatches(fullText, filters.examType)) {
      return false;
    }
  }

  return true;
};

const paginate = (tests: TestItem[], page: number, limit: number): TestListResult => {
  const total = tests.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const sliced = tests.slice(start, start + limit);

  return {
    tests: sliced,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
};

const applyClientFiltersAndPagination = (
  tests: TestItem[],
  filters: Required<TestListFilters>
): TestListResult => {
  const filtered = tests.filter((test) => matchesFilters(test, filters));
  return paginate(filtered, filters.page, filters.limit);
};

const normalizeResponse = (
  response: RawTestsResponse,
  filters: Required<TestListFilters>
): TestListResult => {
  if (Array.isArray(response)) {
    return applyClientFiltersAndPagination(normalizeTests(response), filters);
  }

  const tests = normalizeTests(response.tests);

  if (!response.pagination) {
    return applyClientFiltersAndPagination(tests, filters);
  }

  const page = toPositiveInt(response.pagination.page, filters.page);
  const limit = toPositiveInt(response.pagination.limit, filters.limit);
  const total = toPositiveInt(response.pagination.total, tests.length);
  const totalPages = toPositiveInt(
    response.pagination.totalPages,
    Math.max(1, Math.ceil(total / limit))
  );

  return {
    tests,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const buildBadge = (label: string, tone: "blue" | "green" | "amber"): TestItem["badges"][number] => {
  if (tone === "green") {
    return {
      label,
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-800 dark:text-green-300",
    };
  }
  if (tone === "amber") {
    return {
      label,
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-800 dark:text-amber-300",
    };
  }
  return {
    label,
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-800 dark:text-blue-300",
  };
};

const FALLBACK_READING_TYPES = [
  "Multiple Choice",
  "True/False/Not Given",
  "Matching Headings",
  "Sentence Completion",
  "Summary Completion",
];

const FALLBACK_LISTENING_TYPES = [
  "Multiple Choice",
  "Matching",
  "Plan/Map/Diagram Labelling",
  "Form/Note/Table Completion",
];

const FALLBACK_READING_LENGTHS = [
  "Full Test (60 mins)",
  "One Passage (20 mins)",
  "Quick Practice (10 mins)",
];

const FALLBACK_LISTENING_LENGTHS = [
  "Full Test (40 mins)",
  "Short Practice (10 mins)",
  "Section Only",
];

const FALLBACK_WRITING_TYPES = [
  "Task 1 & Task 2",
  "Task 1 (Graph/Letter)",
  "Task 2 (Essay)",
];

const FALLBACK_WRITING_LENGTHS = [
  "Full Test (60 mins)",
  "Task 1 Only (20 mins)",
  "Task 2 Only (40 mins)",
];

const FALLBACK_SPEAKING_TYPES = [
  "Full Interview",
  "Part 1 (Intro)",
  "Part 2 (Cue Card)",
  "Part 3 (Discussion)",
];

const FALLBACK_SPEAKING_LENGTHS = [
  "Full Test (15 mins)",
  "Quick Practice (5 mins)",
];

const buildFallbackTests = (mode: TestMode): TestItem[] => {
  const isReading = mode === "reading";
  const isListening = mode === "listening";
  const isWriting = mode === "writing";

  const count = isReading ? 24 : isListening ? 18 : isWriting ? 12 : 15;

  const types = isReading
    ? FALLBACK_READING_TYPES
    : isListening
      ? FALLBACK_LISTENING_TYPES
      : isWriting
        ? FALLBACK_WRITING_TYPES
        : FALLBACK_SPEAKING_TYPES;

  const lengths = isReading
    ? FALLBACK_READING_LENGTHS
    : isListening
      ? FALLBACK_LISTENING_LENGTHS
      : isWriting
        ? FALLBACK_WRITING_LENGTHS
        : FALLBACK_SPEAKING_LENGTHS;

  const titlesPrefix =
    mode.charAt(0).toUpperCase() + mode.slice(1);

  return Array.from({ length: count }, (_, index) => {
    const examType = index % 2 === 0 ? "Academic" : "General Training";
    const questionType = types[index % types.length];
    const lengthLabel = lengths[index % lengths.length];
    const testNumber = index + 1;

    return {
      id: `${mode}-fallback-${testNumber}`,
      title: `${titlesPrefix} Mock Test #${testNumber}`,
      subtitle: `${examType} • ${questionType}`,
      type: questionType,
      badges: [
        buildBadge(examType, "blue"),
        buildBadge(lengthLabel, "green"),
        buildBadge(testNumber % 3 === 0 ? "Hard" : "Medium", "amber"),
      ],
    };
  });
};

const fetchTests = async (
  mode: TestMode,
  filters: TestListFilters = {}
): Promise<TestListResult> => {
  const normalizedFilters = normalizeFilters(filters);
  const query = buildQueryString(normalizedFilters);

  try {
    const response = await apiRequest<RawTestsResponse>(
      `/api/ielts/tests/${mode}?${query}`
    );
    return normalizeResponse(response, normalizedFilters);
  } catch (error) {
    if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
      const fallbackTests = buildFallbackTests(mode);
      return applyClientFiltersAndPagination(fallbackTests, normalizedFilters);
    }
    throw error;
  }
};

export const testService = {
  fetchReadingTests: async (filters: TestListFilters = {}): Promise<TestListResult> =>
    fetchTests("reading", filters),

  fetchListeningTests: async (filters: TestListFilters = {}): Promise<TestListResult> =>
    fetchTests("listening", filters),

  fetchWritingTests: async (filters: TestListFilters = {}): Promise<TestListResult> =>
    fetchTests("writing", filters),

  fetchSpeakingTests: async (filters: TestListFilters = {}): Promise<TestListResult> =>
    fetchTests("speaking", filters),
};
