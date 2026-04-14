import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/DashboardLayout";
import { testService, type TestListFilters } from "../services/testService";
import ApiErrorState from "../components/ApiErrorState";

const PAGE_SIZE = 15;

const QUESTION_TYPE_OPTIONS = [
  { value: "all", label: "All Parts" },
  { value: "part 1", label: "Part 1" },
  { value: "part 2", label: "Part 2" },
  { value: "part 3", label: "Part 3" },
  { value: "part 4", label: "Part 4" },
];

const LENGTH_OPTIONS = [
  { value: "any", label: "Any Length" },
  { value: "full test", label: "Full Test (40 mins)" },
  { value: "short practice", label: "Short Practice (10 mins)" },
  { value: "section only", label: "Section Only" },
];

const EXAM_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "academic", label: "Academic" },
  { value: "general training", label: "General Training" },
];

const parsePage = (value: string | null) => {
  const numeric = Number.parseInt(value || "1", 10);
  if (Number.isNaN(numeric) || numeric < 1) {
    return 1;
  }
  return numeric;
};

const sanitizeChoice = (value: string | null, allowed: string[], fallback: string) =>
  value && allowed.includes(value) ? value : fallback;

const buildPageNumbers = (page: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const TestLibraryListening = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get("page"));
  const activeSearch = searchParams.get("search") || "";
  const activeQuestionType = sanitizeChoice(
    searchParams.get("questionType"),
    QUESTION_TYPE_OPTIONS.map((option) => option.value),
    "all"
  );
  const activeLength = sanitizeChoice(
    searchParams.get("length"),
    LENGTH_OPTIONS.map((option) => option.value),
    "any"
  );
  const activeExamType = sanitizeChoice(
    searchParams.get("examType"),
    EXAM_TYPE_OPTIONS.map((option) => option.value),
    "all"
  );

  const [draftSearch, setDraftSearch] = useState(activeSearch);

  useEffect(() => {
    setDraftSearch(activeSearch);
  }, [activeSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (draftSearch !== activeSearch) {
        updateParams({ search: draftSearch.trim() || null }, { resetPage: true });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [draftSearch, activeSearch, searchParams]);

  const queryFilters: TestListFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: activeSearch || undefined,
      questionType: activeQuestionType !== "all" ? activeQuestionType : undefined,
      length: activeLength !== "any" ? activeLength : undefined,
      examType: activeExamType !== "all" ? activeExamType : undefined,
    }),
    [page, activeSearch, activeQuestionType, activeLength, activeExamType]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["listeningTests", queryFilters],
    queryFn: () => testService.fetchListeningTests(queryFilters),
  });

  const updateParams = (
    updates: Record<string, string | undefined | null>,
    options?: { resetPage?: boolean }
  ) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    if (options?.resetPage) {
      next.set("page", "1");
    }

    setSearchParams(next);
  };

  const resetFilters = () => {
    setDraftSearch("");
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    next.delete("questionType");
    next.delete("length");
    next.delete("examType");
    next.set("page", "1");
    setSearchParams(next);
  };

  const pagination = data?.pagination;
  const tests = data?.tests || [];
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.total || tests.length;
  const pageNumbers = buildPageNumbers(page, totalPages);

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    updateParams({ page: String(clamped) });
  };

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              IELTS Listening Test Collection
            </h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
              Explore IELTS Listening tests. Search, filters, and pagination are now wired to
              backend query params.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-72 flex-shrink-0">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sticky top-0">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <span className="material-symbols-outlined text-primary">filter_list</span>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filters</h2>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <input
                      value={draftSearch}
                      onChange={(event) => setDraftSearch(event.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Search terms..."
                      type="text"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                      search
                    </span>
                  </div>
                </div>

                {activeLength !== "full test" && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Filter By Part
                    </label>
                    <select
                      value={activeQuestionType}
                      onChange={(event) => updateParams({ questionType: event.target.value === "all" ? null : event.target.value }, { resetPage: true })}
                      className="w-full py-2.5 pl-3 pr-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    >
                      {QUESTION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Filter By Length
                  </label>
                  <select
                    value={activeLength}
                    onChange={(event) => {
                      const newLength = event.target.value === "any" ? null : event.target.value;
                      const updates: Record<string, string | null> = { length: newLength };
                      if (newLength === "full test") updates.questionType = null;
                      updateParams(updates, { resetPage: true });
                    }}
                    className="w-full py-2.5 pl-3 pr-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    {LENGTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={resetFilters}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex flex-wrap gap-3 mb-6">
                {EXAM_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateParams({ examType: option.value === "all" ? null : option.value }, { resetPage: true })}
                    className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors ${activeExamType === option.value
                      ? "border-primary bg-blue-50 text-primary dark:bg-blue-900/30 dark:border-primary dark:text-blue-300"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mb-8 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-xl overflow-hidden shadow-lg relative text-white">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <span className="material-symbols-outlined" style={{ fontSize: "140px" }}>
                    school
                  </span>
                </div>
                <div className="p-8 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <div className="inline-block bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded mb-3 uppercase tracking-wider">
                      Recommended
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Cambridge IELTS 20 Academic Listening Test 4</h3>
                    <p className="text-blue-200 mb-4 max-w-lg">
                      Full Test Experience
                    </p>
                    <div className="flex items-center gap-4 text-sm text-blue-200">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">school</span> Academic
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">schedule</span> Full Test (40 mins)
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/practice/listening?testId=l1"
                    className="bg-white text-primary hover:bg-slate-100 px-6 py-3 rounded-lg font-bold shadow-md transition-transform hover:scale-105 whitespace-nowrap"
                  >
                    Start Mock Test
                  </Link>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {totalItems} tests found • page {page}/{totalPages}
                </span>
                {isFetching && !isLoading ? <span>Updating...</span> : null}
              </div>

              {isLoading ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <ApiErrorState
                  compact
                  title="Failed to load listening tests"
                  message="Check endpoint `/api/tests/listening` and query params support (page, limit, search, questionType, length, examType)."
                  onRetry={() => {
                    void refetch();
                  }}
                />
              ) : tests.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {tests.map((test) => (
                    <div
                      key={test.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col h-full group mt-3"
                    >
                      <div className="absolute -top-3 left-4">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                          {test.type}
                        </span>
                      </div>
                      <div className="mt-2 flex-grow">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight mb-3 group-hover:text-primary transition-colors">
                          {test.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                          {test.subtitle}
                        </p>

                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          {test.badges.map((badge, index) => (
                            <span
                              key={index}
                              className={`px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Link
                        to={`/practice/listening?testId=${test.id}`}
                        className="w-full mt-auto bg-primary hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-center"
                      >
                        Take Test
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                  Nothing found. Adjust filters and try again.
                </div>
              )}

              <div className="mt-10 flex justify-center pb-8">
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>

                  {pageNumbers[0] > 1 ? (
                    <>
                      <button
                        onClick={() => goToPage(1)}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        1
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700">
                        ...
                      </span>
                    </>
                  ) : null}

                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      onClick={() => goToPage(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 dark:ring-slate-700 ${pageNumber === page
                        ? "z-10 bg-primary text-white"
                        : "text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  {pageNumbers[pageNumbers.length - 1] < totalPages ? (
                    <>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700">
                        ...
                      </span>
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {totalPages}
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TestLibraryListening;
