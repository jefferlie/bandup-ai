import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import logo from "../assets/logo.png";
import { TextHighlighter } from "../components/TextHighlighter";
import { ModeToggle } from "../components/mode-toggle";
import ApiErrorState from "../components/ApiErrorState";
import { practiceService } from "../services/practiceService";

const PracticeReading = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("testId") || "reading-default";

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionResult, setSubmissionResult] = useState<any | null>(null); // Type accurately later
  const [testMode, setTestMode] = useState<"practice" | "timed" | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [currentPart, setCurrentPart] = useState(1);
  const isTestInProgress = hasStarted && !submissionResult;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const pendingLeaveAction = React.useRef<(() => void) | null>(null);
  const autoSaveKey = `bandup_reading_partial_${testId}`;
  const [savedSession, setSavedSession] = useState<{ answers: Record<string, string>, elapsedSeconds: number, testMode: "practice" | "timed" } | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  React.useEffect(() => {
    if (!testId || hasStarted) return;
    const rawSaved = localStorage.getItem(autoSaveKey);
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (parsed && typeof parsed.elapsedSeconds === 'number') {
          setSavedSession(parsed);
          setShowRestorePrompt(true);
        }
      } catch (e) {
        console.error("Failed to parse saved reading session", e);
      }
    }
  }, [testId, autoSaveKey, hasStarted]);
  React.useEffect(() => {
    if (isTestInProgress && !showRestorePrompt) {
      const dataToSave = {
        answers,
        elapsedSeconds,
        testMode
      };
      localStorage.setItem(autoSaveKey, JSON.stringify(dataToSave));
    }
  }, [answers, elapsedSeconds, isTestInProgress, testMode, autoSaveKey, showRestorePrompt]);

  const handleRestore = () => {
    if (savedSession) {
      setAnswers(savedSession.answers || {});
      setElapsedSeconds(savedSession.elapsedSeconds || 0);
      setTestMode(savedSession.testMode || "practice");
      setHasStarted(true);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscard = () => {
    localStorage.removeItem(autoSaveKey);
    setSavedSession(null);
    setShowRestorePrompt(false);
  };

  const requestLeave = React.useCallback((action: () => void) => {
    if (isTestInProgress) {
      pendingLeaveAction.current = action;
      setShowExitConfirm(true);
    } else {
      action();
    }
  }, [isTestInProgress]);

  const confirmLeave = React.useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current?.();
    pendingLeaveAction.current = null;
  }, []);

  const cancelLeave = React.useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current = null;
    window.history.pushState(null, "", window.location.href);
  }, []);

  React.useEffect(() => {
    if (!isTestInProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isTestInProgress]);

  React.useEffect(() => {
    if (!isTestInProgress) return;
    const onPopState = () => {
      requestLeave(() => window.history.back());
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isTestInProgress, requestLeave]);

  const {
    data: test,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["practiceReadingTest", testId],
    queryFn: () => practiceService.fetchReadingTest(testId),
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["practiceHistory", "reading"],
    queryFn: () => practiceService.fetchAttemptHistory("reading", 5),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!test) {
        throw new Error("Test is not loaded");
      }
      return practiceService.submitReadingAttempt(test.attemptId, test.testId, test.title, {
        answers,
      });
    },
    onSuccess: async (result) => {
      setSubmissionMessage(`Submitted: ${result.scoreLabel}`);
      setSubmissionResult(result);
      localStorage.removeItem(autoSaveKey);
      await refetchHistory();
    },
    onError: (submitError) => {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit answers.";
      setSubmissionMessage(message);
    },
  });
  const submitRef = React.useRef(submitMutation);
  submitRef.current = submitMutation;

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (hasStarted && !submissionResult && !showRestorePrompt) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (testMode === "timed" && test?.durationSeconds) {
            if (prev + 1 >= test.durationSeconds) {
              void submitRef.current.mutate();
              return test.durationSeconds;
            }
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasStarted, submissionResult, testMode, test?.durationSeconds, showRestorePrompt]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers]
  );

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reading test...</p>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ApiErrorState
          title="Failed to load reading test"
          message="Check endpoint `/api/practice/reading/:testId` or enable local fallback."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }
  const testAny = test as any;
  const isFullTest = testAny?.isFullTest === true;
  const activeTest = isFullTest && testAny?.combinedParts
    ? testAny.combinedParts[currentPart - 1]
    : test;

  const results = submissionResult?.detailedResults
    ? Object.fromEntries(submissionResult.detailedResults.map((r: any) => [r.questionId, r]))
    : null;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans h-screen flex flex-col overflow-hidden transition-colors duration-200">
      <header className="bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => requestLeave(() => navigate("/dashboard"))}
            className="mr-6 flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] mr-1">arrow_back</span>
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <img src={logo} alt="BandUp" className="w-8 h-8" />
            <span className="text-xl font-bold text-primary tracking-tight">Band<span className="font-bold text-slate-800 dark:text-white">Up</span></span>
          </div>

          <div className="flex-1 flex justify-center">
            {hasStarted && !submissionResult && !showRestorePrompt && (
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${testMode === "timed" && test?.durationSeconds && test.durationSeconds - elapsedSeconds <= 60
                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 animate-pulse"
                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                }`}>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                {testMode === "timed" && test?.durationSeconds ? (
                  <span>
                    {Math.floor(Math.max(0, test.durationSeconds - elapsedSeconds) / 60)}:
                    {Math.floor(Math.max(0, test.durationSeconds - elapsedSeconds) % 60).toString().padStart(2, "0")}
                  </span>
                ) : (
                  <span>
                    {Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:
                    {Math.floor(elapsedSeconds % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ModeToggle />
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div>
          <h1 className="text-lg font-bold">{isFullTest ? test.title : activeTest.title}</h1>
          <p className="text-sm text-slate-500">{activeTest.instruction}</p>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {isReviewMode ? "Review Mode" : `Answered: ${answeredCount}/${activeTest.questions.length}`}
        </div>
      </div>

      <TextHighlighter className="flex-1 flex flex-col overflow-hidden relative">
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className="w-full md:w-1/2 overflow-y-auto p-6 md:p-8 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 custom-scrollbar">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100 font-serif">
              {activeTest.passageTitle}
            </h2>
            <div className="space-y-6">
              {activeTest.passageSections.map((section: any) => {
                const rawText: string = section.text;

                const renderPassageText = () => {
                  if (!isReviewMode) {
                    return rawText.replace(/\[\[(\d+):(.*?)\]\]/g, '$2');
                  }
                  const parts = rawText.split(/(\[\[\d+:.*?\]\])/g);
                  return parts.map((part: string, i: number) => {
                    const match = part.match(/\[\[(\d+):(.*?)\]\]/);
                    if (match) {
                      const [, qNum, content] = match;
                      return (
                        <span key={i} className="inline-flex items-center align-baseline">
                          <span className="bg-[#7FFFD4] dark:bg-emerald-800 text-slate-900 dark:text-emerald-50 px-1 py-0.5 box-decoration-clone leading-tight">
                            {content}
                          </span>
                          <span className="inline-flex items-center justify-center font-sans font-bold text-[11px] leading-none border border-black dark:border-white text-black dark:text-white px-1.5 py-0.5 ml-0.5 bg-white dark:bg-slate-900">
                            {qNum}
                          </span>
                        </span>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  });
                };

                return (
                  <div key={section.id}>
                    {section.heading && section.heading !== section.id && section.heading.length > 2 && section.heading !== test.passageTitle ? (
                      <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100 font-serif">{section.heading}</h2>
                    ) : null}
                    <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 font-serif whitespace-pre-wrap">
                      {section.heading === section.id || section.heading.length <= 2 ? (
                        <span className="font-bold text-primary mr-1">{section.heading}.</span>
                      ) : null}
                      {renderPassageText()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full md:w-1/2 overflow-y-auto bg-slate-50 dark:bg-slate-900 border-t md:border-t-0 border-slate-200 dark:border-slate-700 p-6 md:p-8 custom-scrollbar">
            <div className="mb-8">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl mb-2">Questions</h3>
              {isReviewMode && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-primary">rate_review</span>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Review mode — inputs are locked.</p>
                </div>
              )}

              <div className="space-y-5">
                {activeTest.questions.map((question: any, index: number) => {
                  const resultEntry = results?.[question.id];
                  const isCorrect = resultEntry?.isCorrect;
                  const correctAnswer = resultEntry?.correctAnswer;
                  const userAnswer = answers[question.id] || "";

                  return (
                    <div
                      key={question.id}
                      className={`p-4 rounded-xl border shadow-sm transition-colors ${isReviewMode && resultEntry
                        ? isCorrect
                          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                          : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-medium">
                          <span className="text-slate-500 mr-1">{question.id.replace(/\D/g, '')}.</span>
                          {question.prompt.replace(/^Q\d+\.\s*/, '')}
                        </p>
                        {isReviewMode && resultEntry && (
                          <span className={`material-symbols-outlined text-[20px] ml-2 shrink-0 ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                            {isCorrect ? "check_circle" : "cancel"}
                          </span>
                        )}
                      </div>

                      {question.type === "single-choice" ? (
                        <select
                          value={userAnswer}
                          onChange={(e) => handleChange(question.id, e.target.value)}
                          disabled={isReviewMode}
                          className={`block w-40 rounded-md border px-3 py-2 text-sm transition-colors ${isReviewMode
                            ? "opacity-70 cursor-not-allowed"
                            : "focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                            } ${isReviewMode && resultEntry
                              ? isCorrect
                                ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                            }`}
                        >
                          <option value="" disabled>Select...</option>
                          {(question.options || []).map((option: string) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={userAnswer}
                          onChange={(e) => handleChange(question.id, e.target.value)}
                          readOnly={isReviewMode}
                          placeholder={question.placeholder || "Your answer"}
                          className={`w-full md:w-80 rounded-md border px-3 py-2 text-sm transition-colors ${isReviewMode
                            ? "cursor-default"
                            : "focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                            } ${isReviewMode && resultEntry
                              ? isCorrect
                                ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300"
                              : "border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                            }`}
                        />
                      )}

                      {isReviewMode && resultEntry && !isCorrect && (
                        <p className="mt-2 text-xs font-semibold text-green-700 dark:text-green-400">
                          ✓ Correct: {correctAnswer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-24">
              <h4 className="font-semibold mb-3">Attempt History</h4>
              {isHistoryLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : history && history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item: any) => (
                    <div key={item.id} className="text-sm flex justify-between gap-4">
                      <span className="truncate">{item.testTitle}</span>
                      <span className="text-slate-500">{item.scoreLabel}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No history yet.</p>
              )}
            </div>
          </div>
        </main>
      </TextHighlighter>

      {!submissionResult && (
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {isFullTest && (
              <>
                <button
                  className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${currentPart === 1 ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-900 text-slate-100 shadow-sm"}`}
                  onClick={() => currentPart > 1 && setCurrentPart(p => p - 1)}
                  disabled={currentPart === 1}
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>
                <span className="font-bold text-slate-700 dark:text-slate-300">Passage {currentPart}</span>
                <button
                  className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${currentPart === 3 ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-900 text-slate-100 shadow-sm"}`}
                  onClick={() => currentPart < 3 && setCurrentPart(p => p + 1)}
                  disabled={currentPart === 3}
                >
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </>
            )}
            <p className="text-sm text-slate-500">
              {answeredCount} of {activeTest.questions.length} questions answered
            </p>
          </div>
          <div className="flex flex-col items-end">
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 px-6 rounded-md shadow-md flex items-center transition-colors"
            >
              <span>{submitMutation.isPending ? "Submitting..." : "Submit Answers"}</span>
              <span className="material-symbols-outlined ml-2 text-sm">send</span>
            </button>
            {submissionMessage && !submissionResult && (
              <p className="mt-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                {submissionMessage}
              </p>
            )}
          </div>
        </footer>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancelLeave} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-200">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-amber-500 text-3xl">warning</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Leave this test?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Your progress and timer will be <strong className="text-slate-700 dark:text-slate-200">permanently lost</strong>. You'll need to start from the beginning.
            </p>
            <button
              onClick={cancelLeave}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl mb-3 transition-colors"
            >
              Continue Test
            </button>
            <button
              onClick={confirmLeave}
              className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold py-3 rounded-xl border border-red-200 dark:border-red-800 transition-colors"
            >
              Leave &amp; Discard Progress
            </button>
          </div>
        </div>
      )}

      {showRestorePrompt && (
        <div className="fixed bottom-24 right-6 z-[110] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-4 w-[300px] flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary p-1.5 flex items-center justify-center rounded-md shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[16px]">history</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-0.5">Unfinished attempt</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  Saved answers found. Do you want to restore them?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleDiscard}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Start fresh
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-primary hover:bg-blue-700 rounded-md transition-colors shadow-sm"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-amber-500 text-3xl">warning</span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Leave test?</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-5">
                Your progress is auto-saved and you can continue later, but make sure you're okay with leaving now.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelLeave}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={confirmLeave}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasStarted && !showRestorePrompt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-primary/10 dark:bg-primary/20 p-6 text-center border-b border-primary/20">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">menu_book</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to Start?</h2>
              <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">Choose how you want to take this test.</p>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => {
                  setTestMode("timed");
                  setHasStarted(true);
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Real Test Simulation</h3>
                  <p className="text-sm text-slate-500 mt-1">Strict {Math.round(test.durationSeconds / 60)}-minute timer. Best for exam practice.</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setTestMode("practice");
                  setHasStarted(true);
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">school</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Practice Mode</h3>
                  <p className="text-sm text-slate-500 mt-1">No time limit. Focus on understanding and accuracy.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {submissionResult && submissionResult.detailedResults && !isReviewMode && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Test Complete</h2>
                <div className="text-slate-500 mt-1 flex items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")} used
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${testMode === "timed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                    {testMode === "timed" ? "Timed Simulation" : "Practice Mode"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-primary font-mono drop-shadow-sm">{submissionResult.scoreLabel}</div>
                <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mt-1">Final Score</div>
              </div>
            </div>

            <div className="p-0 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 shadow-sm border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-16 text-center">#</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-1/2">Your Answer</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-1/2">Correct Answer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {submissionResult.detailedResults.map((res: any) => {
                    const qNumMatch = res.questionId.match(/\d+/);
                    const num = qNumMatch ? qNumMatch[0] : res.questionId;
                    return (
                      <tr key={res.questionId} className={`transition-colors ${res.isCorrect ? "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50" : "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50"}`}>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-500">{num}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`${res.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"} font-medium`}>
                              {res.userAnswer || <span className="text-slate-400 italic font-normal">blank</span>}
                            </span>
                            {res.isCorrect
                              ? <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                              : <span className="material-symbols-outlined text-red-500 text-[18px]">cancel</span>
                            }
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{res.correctAnswer}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => {
                  setSubmissionResult(null);
                  setHasStarted(false);
                  setElapsedSeconds(0);
                  setAnswers({});
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-5 py-2 rounded-md font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={() => navigate("/tests/reading")}
                className="px-5 py-2 rounded-md font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
              >
                Back to Library
              </button>
              <button
                onClick={() => setIsReviewMode(true)}
                className="px-5 py-2 rounded-md font-medium bg-primary text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">rate_review</span>
                Review Answers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeReading;


