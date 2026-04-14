import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextHighlighter } from "../components/TextHighlighter";
import { ModeToggle } from "../components/mode-toggle";
import ChatWindow from "../components/ChatWindow";
import ApiErrorState from "../components/ApiErrorState";
import { practiceService } from "../services/practiceService";
import logo from "../assets/logo.png";

const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainSeconds = rounded % 60;
  return `${minutes}:${String(remainSeconds).padStart(2, "0")}`;
};

const PracticeWriting = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const testId = searchParams.get("testId") || "writing-default";

  const [currentTaskId, setCurrentTaskId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const [testMode, setTestMode] = useState<"practice" | "timed" | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pendingLeaveAction = useRef<(() => void) | null>(null);

  const isTestInProgress = hasStarted && !submissionResult;

  const {
    data: test,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["practiceWritingTest", testId],
    queryFn: () => practiceService.fetchWritingTest(testId),
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["practiceHistory", "writing"],
    queryFn: () => practiceService.fetchAttemptHistory("writing", 5),
  });

  const requestLeave = useCallback((action: () => void) => {
    if (isTestInProgress) {
      pendingLeaveAction.current = action;
      setShowExitConfirm(true);
    } else {
      action();
    }
  }, [isTestInProgress]);

  const confirmLeave = useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current?.();
    pendingLeaveAction.current = null;
  }, []);

  const cancelLeave = useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current = null;
    window.history.pushState(null, "", window.location.href);
  }, []);

  useEffect(() => {
    if (!isTestInProgress) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isTestInProgress]);

  useEffect(() => {
    if (!isTestInProgress) return;
    const onPopState = () => {
      requestLeave(() => window.history.back());
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isTestInProgress, requestLeave]);

  useEffect(() => {
    if (test?.tasks.length && !currentTaskId) {
      const initialTaskId = searchParams.get("taskId");
      if (initialTaskId && test.tasks.some(t => t.id === initialTaskId)) {
        setCurrentTaskId(initialTaskId);
      } else {
        setCurrentTaskId(test.tasks[0].id);
      }
    }
  }, [test, currentTaskId, searchParams]);

  const currentTask = useMemo(() => {
    if (!test?.tasks.length) {
      return undefined;
    }
    return test.tasks.find((task) => task.id === currentTaskId) || test.tasks[0];
  }, [test, currentTaskId]);

  const currentTaskIndex = useMemo(() => {
    if (!test?.tasks.length || !currentTask) {
      return 0;
    }
    const index = test.tasks.findIndex((task) => task.id === currentTask.id);
    return index >= 0 ? index : 0;
  }, [test, currentTask]);

  const hasTaskNavigation = (test?.tasks.length || 0) > 1;

  const goToPreviousTask = () => {
    if (!test?.tasks.length || currentTaskIndex <= 0) {
      return;
    }
    setCurrentTaskId(test.tasks[currentTaskIndex - 1].id);
  };

  const goToNextTask = () => {
    if (!test?.tasks.length || currentTaskIndex >= test.tasks.length - 1) {
      return;
    }
    setCurrentTaskId(test.tasks[currentTaskIndex + 1].id);
  };

  const currentWordCount = useMemo(() => {
    if (!currentTask) {
      return 0;
    }
    const value = answers[currentTask.id] || "";
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }, [answers, currentTask]);

  const answeredTasksCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim()).length,
    [answers]
  );

  const totalWordCount = useMemo(() => {
    return Object.values(answers).reduce((total, value) => {
      return total + (value.trim() ? value.trim().split(/\s+/).length : 0);
    }, 0);
  }, [answers]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!test) {
        throw new Error("Writing test not loaded");
      }
      return practiceService.submitWritingAttempt(test.attemptId, test.testId, test.title, {
        answers,
      });
    },
    onSuccess: async (result) => {
      setSubmissionMessage(`Submitted: ${result.scoreLabel}`);
      setSubmissionResult(result);
      await refetchHistory();
    },
    onError: (submitError) => {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit writing answers.";
      setSubmissionMessage(message);
    },
  });

  const submitRef = useRef(submitMutation);
  submitRef.current = submitMutation;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (hasStarted && !submissionResult) {
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
  }, [hasStarted, submissionResult, testMode, test?.durationSeconds]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading writing test...</p>
        </div>
      </div>
    );
  }

  if (error || !test || !currentTask) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ApiErrorState
          title="Failed to load writing test"
          message="Check endpoint `/api/ielts/practice/writing/:testId` or fallback mode."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-200">
      <header className="bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl w-full mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => requestLeave(() => navigate("/dashboard"))}
              className="mr-6 flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] mr-1">arrow_back</span>
              <span className="text-sm font-medium hidden md:inline">Dashboard</span>
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <img src={logo} alt="BandUp" className="w-8 h-8" />
            <span className="text-xl font-bold text-primary tracking-tight">Band<span className="font-bold text-slate-800 dark:text-white">Up</span></span>
          </div>

          <div className="flex-1 flex justify-center">
            {hasStarted && !submissionResult && (
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${testMode === "timed" && test?.durationSeconds && test.durationSeconds - elapsedSeconds <= 60
                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 animate-pulse"
                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                }`}>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                {testMode === "timed" && test?.durationSeconds
                  ? formatAudioTime(test.durationSeconds - elapsedSeconds)
                  : formatAudioTime(elapsedSeconds)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${isChatOpen
                ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-blue-400 dark:border-primary/30"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              title="Toggle AI Tutor"
            >
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              <span className="hidden sm:inline">AI Tutor</span>
            </button>
            <ModeToggle />
            <button
              onClick={() => {
                if (totalWordCount < 50) {
                  alert("You must write at least 50 words across all tasks before submitting.");
                  return;
                }
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending || !hasStarted || submissionResult}
              className="bg-primary hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-md transition-all flex items-center"
            >
              <span className="material-symbols-outlined text-[18px] mr-1">check_circle</span>
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </header>

      
      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-4xl text-amber-600 dark:text-amber-400">warning</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Leave this test?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Your progress and timer will be <strong className="text-slate-700 dark:text-slate-300">permanently lost</strong>. You'll need to start from the beginning.
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2.5">
              <button
                onClick={cancelLeave}
                className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Continue Test
              </button>
              <button
                onClick={confirmLeave}
                className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200 dark:border-red-800/50"
              >
                Leave & Discard Progress
              </button>
            </div>
          </div>
        </div>
      )}

      
      {!hasStarted && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-primary/10 dark:bg-primary/20 p-6 text-center border-b border-primary/20">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">hotel_class</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to Start?</h2>
              <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">Choose how you want to take this test.</p>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => { setTestMode("timed"); setHasStarted(true); }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Real Test Simulation</h3>
                  <p className="text-sm text-slate-500 mt-1">Strict {Math.round(test.durationSeconds / 60)}-minute timer. Best for checking your actual band score progress.</p>
                </div>
              </button>
              <button
                onClick={() => { setTestMode("practice"); setHasStarted(true); }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">school</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Practice Mode</h3>
                  <p className="text-sm text-slate-500 mt-1">No time limit. Relax and focus on accuracy and argumentation.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      
      {submissionResult && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-6 flex flex-col border-b border-slate-200 dark:border-slate-700 text-center items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Test Submitted</h2>
              <div className="text-slate-500 mt-2 flex items-center justify-center gap-4 text-sm font-medium">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")} used
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${testMode === "timed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                  {testMode === "timed" ? "Timed Simulation" : "Practice Mode"}
                </span>
              </div>
            </div>
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                Your writing has been securely submitted. An expert or AI grader will review your submission shortly.
              </p>
              <div className="text-5xl font-black text-primary scoreboard-font mt-6 drop-shadow-sm">{submissionResult.scoreLabel}</div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center gap-3">
              <button
                onClick={() => navigate("/tests/writing")}
                className="px-5 py-2.5 rounded-md font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors w-full max-w-[200px]"
              >
                Back to Library
              </button>
            </div>
          </div>
        </div>
      )}

      <TextHighlighter className="flex-1 flex flex-col h-full relative transition-all duration-300 overflow-hidden">
        <main className="flex-1 flex flex-col h-full relative">

          <div className="flex-1 flex overflow-hidden relative">
            
            {isSidebarOpen && (
              <div
                className="lg:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-30"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            
            <div
              className={`absolute top-0 bottom-0 left-0 bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 w-72 flex flex-col shadow-2xl z-40 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
              
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute -right-10 top-1/2 -translate-y-1/2 w-10 h-16 bg-surface-light dark:bg-surface-dark border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl shadow-md flex items-center justify-center text-slate-500 hover:text-primary transition-colors hover:w-11 group"
                title={isSidebarOpen ? "Close Tasks" : "Open Tasks"}
              >
                <span className="material-symbols-outlined transition-transform duration-300 group-hover:scale-110">
                  {isSidebarOpen ? "chevron_left" : "chevron_right"}
                </span>
              </button>

              <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Tasks
                </h2>
                <div className="space-y-3">
                  {test.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setCurrentTaskId(task.id)}
                      className={`group flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-colors ${currentTask.id === task.id
                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-xl">
                          edit_square
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{task.title}</h3>
                        <p className="text-xs text-slate-500">{task.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Tips
                  </h2>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {test.tips.map((tip, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Attempt History
                  </h2>
                  {isHistoryLoading ? (
                    <p className="text-xs text-slate-500">Loading...</p>
                  ) : history && history.length > 0 ? (
                    <div className="space-y-2">
                      {history.map((item) => (
                        <div key={item.id} className="text-xs flex justify-between gap-2">
                          <span className="truncate">{item.testTitle}</span>
                          <span className="text-slate-500">{item.scoreLabel}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No attempts yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 bg-background-light dark:bg-background-dark p-4 md:p-6 lg:p-8 relative w-full h-full overflow-hidden">
              <div className="mx-auto h-full flex flex-col lg:flex-row gap-6 max-w-[1600px]">
                
                <div className="flex-1 lg:w-1/2 flex flex-col overflow-y-auto bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 custom-scrollbar p-6">
                  <div className="flex items-start justify-between mb-4 border-b border-slate-100 dark:border-slate-700/50 pb-4">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">campaign</span>
                      {currentTask.promptTitle || "Prompt"}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      Min words: {currentTask.minWords || 150}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white leading-snug mb-5 whitespace-pre-wrap">
                    {currentTask.question}
                  </h2>
                  {currentTask.imageUrl && (
                    <div className="mt-2 mb-4 flex justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                      <img
                        src={currentTask.imageUrl}
                        alt="Task Prompt Diagram"
                        className="max-h-[500px] w-auto object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>

                
                <div className="flex-1 lg:w-1/2 flex flex-col bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative top-px">
                      {currentTask.title} Answer
                    </span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <span>Words: <strong className={currentWordCount >= (currentTask.minWords || 0) ? "text-green-600 dark:text-green-400 font-bold" : "font-semibold"}>{currentWordCount}</strong></span>
                      <span className="text-slate-300 dark:text-slate-600 px-1">|</span>
                      <span>Task {answeredTasksCount}/{test.tasks.length}</span>
                    </span>
                  </div>

                  <textarea
                    value={answers[currentTask.id] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [currentTask.id]: e.target.value }))
                    }
                    className="flex-1 w-full p-6 md:p-8 bg-transparent custom-scrollbar border-0 focus:ring-0 resize-none text-slate-800 dark:text-slate-100 leading-[1.8] text-[15px] font-sans placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    placeholder="Start typing your essay here... Focus on argument structure and vocabulary usage."
                    spellCheck={false}
                  ></textarea>

                  {hasTaskNavigation && (
                    <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 rounded-b-2xl">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={goToPreviousTask}
                          disabled={currentTaskIndex === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Previous Task
                        </button>

                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Task {currentTaskIndex + 1} of {test.tasks.length}
                        </span>

                        <button
                          onClick={goToNextTask}
                          disabled={currentTaskIndex >= test.tasks.length - 1}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors font-medium"
                        >
                          Next Task
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              
              {submissionResult && submissionResult.detailedResults ? (
                <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 mt-20 md:my-auto animate-in fade-in zoom-in duration-300">
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 text-center border-b border-slate-200 dark:border-slate-800 relative">
                      <button onClick={() => navigate("/dashboard")} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-2xl">close</span>
                      </button>
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6 shadow-sm border border-blue-200 dark:border-blue-800">
                        <span className="text-4xl font-black">{submissionResult.detailedResults.overall_score?.toFixed(1) || "?"}</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Overall Band Score</h2>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Evaluated accurately by AI Examiner</p>
                    </div>

                    
                    <div className="p-6 md:p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="material-symbols-outlined text-indigo-500">assignment</span>
                              Task Response
                            </h3>
                            <span className="text-xl font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-xl shadow-inner border border-indigo-100 dark:border-indigo-800">
                              {submissionResult.detailedResults.task_response?.score?.toFixed(1) || "-"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {submissionResult.detailedResults.task_response?.feedback || "No feedback available."}
                          </p>
                        </div>

                        
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-500">account_tree</span>
                              Coherence & Cohesion
                            </h3>
                            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-3 py-1 rounded-xl shadow-inner border border-emerald-100 dark:border-emerald-800">
                              {submissionResult.detailedResults.coherence?.score?.toFixed(1) || "-"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {submissionResult.detailedResults.coherence?.feedback || "No feedback available."}
                          </p>
                        </div>

                        
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="material-symbols-outlined text-amber-500">menu_book</span>
                              Lexical Resource
                            </h3>
                            <span className="text-xl font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-3 py-1 rounded-xl shadow-inner border border-amber-100 dark:border-amber-800">
                              {submissionResult.detailedResults.lexical_resource?.score?.toFixed(1) || "-"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {submissionResult.detailedResults.lexical_resource?.feedback || "No feedback available."}
                          </p>
                        </div>

                        
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="material-symbols-outlined text-rose-500">spellcheck</span>
                              Grammar & Accuracy
                            </h3>
                            <span className="text-xl font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/40 px-3 py-1 rounded-xl shadow-inner border border-rose-100 dark:border-rose-800">
                              {submissionResult.detailedResults.grammar?.score?.toFixed(1) || "-"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {submissionResult.detailedResults.grammar?.feedback || "No feedback available."}
                          </p>
                        </div>
                      </div>

                      
                      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button
                          onClick={() => navigate("/tests/writing")}
                          className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined">arrow_back</span>
                          Return to Test Library
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : submissionMessage ? (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white shadow-xl rounded-full px-6 py-2.5 z-50 animate-in slide-in-from-bottom-5">
                  <p className="text-sm font-medium">
                    {submissionMessage}
                  </p>
                </div>
              ) : null}
            </div>

            
            {isChatOpen && (
              <div className="w-80 min-w-[320px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 transition-transform duration-300 ease-out">
                <ChatWindow subject="writing" />
              </div>
            )}
          </div>
        </main>
      </TextHighlighter>
    </div >
  );
};

export default PracticeWriting;
