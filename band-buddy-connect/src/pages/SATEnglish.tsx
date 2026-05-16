import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/DashboardLayout";
import ApiErrorState from "../components/ApiErrorState";
import { satService, type SATQuestion } from "../services/satService";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const parsePage = (v: string | null) => Math.max(1, parseInt(v || "1") || 1);

const QuestionCard = ({ question: q, index }: { question: SATQuestion; index: number }) => {
  const [revealed, setRevealed] = useState(false);
  const choices = Object.entries(q.choices || {});

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0 w-8">Q{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[q.difficulty] ?? ""}`}>
              {q.difficulty}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              {q.domain}
            </span>
          </div>

          {q.paragraph && (
            <p className="text-sm text-muted-foreground mb-3 italic border-l-2 border-border pl-3 leading-relaxed">
              {q.paragraph}
            </p>
          )}

          <p className="text-sm text-foreground leading-relaxed">{q.question_text}</p>

          {q.visual_svg && (
            <div
              className="mt-3 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: q.visual_svg }}
            />
          )}

          {choices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {choices.map(([letter, text]) => (
                <div
                  key={letter}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border transition-colors ${
                    revealed && letter === q.correct_answer
                      ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-600"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  <span className="font-semibold shrink-0">{letter}.</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setRevealed(!revealed)}
              className="self-start text-xs font-medium text-primary hover:underline"
            >
              {revealed ? "Hide Answer" : "Show Answer"}
            </button>
            {revealed && q.explanation && (
              <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SATEnglish = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get("page"));
  const difficulty = searchParams.get("difficulty") || "";
  const domain = searchParams.get("domain") || "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sat-english", page, difficulty, domain],
    queryFn: () =>
      satService.fetchQuestions({
        section: "english",
        difficulty: (difficulty as "Easy" | "Medium" | "Hard") || undefined,
        domain: domain || undefined,
        limit: 20,
        offset: (page - 1) * 20,
      }),
  });

  const { data: domainsData } = useQuery({
    queryKey: ["sat-domains"],
    queryFn: satService.fetchDomains,
  });

  const englishDomains = (domainsData?.domains ?? [])
    .filter((d) => d.section === "english")
    .map((d) => d.domain);

  const updateParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  };

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-foreground">SAT English</h1>
          <p className="text-muted-foreground">
            {data
              ? `${data.pagination.total.toLocaleString()} questions across all English domains`
              : "Practice English questions for the SAT"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={difficulty}
            onChange={(e) => updateParam("difficulty", e.target.value || null)}
            className="h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm"
          >
            <option value="">All Difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={domain}
            onChange={(e) => updateParam("domain", e.target.value || null)}
            className="h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm"
          >
            <option value="">All Domains</option>
            {englishDomains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {(difficulty || domain) && (
            <button
              onClick={() => setSearchParams({})}
              className="h-9 px-3 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        )}

        {error && (
          <ApiErrorState
            title="Failed to load questions"
            message="Could not fetch SAT English questions."
            onRetry={() => void refetch()}
          />
        )}

        {data && data.questions.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            No questions match the current filters.
          </div>
        )}

        {data && data.questions.length > 0 && (
          <div className="flex flex-col gap-4">
            {data.questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={(page - 1) * 20 + i + 1} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => updateParam("page", String(page - 1))}
              className="h-9 px-4 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-accent transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => updateParam("page", String(page + 1))}
              className="h-9 px-4 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SATEnglish;
