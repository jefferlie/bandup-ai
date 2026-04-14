import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TextHighlighter } from "../components/TextHighlighter";
import { ModeToggle } from "../components/mode-toggle";
import ChatWindow from "../components/ChatWindow";
import ApiErrorState from "../components/ApiErrorState";
import { practiceService } from "../services/practiceService";
import logo from "../assets/logo.png";

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainSeconds = rounded % 60;
  return `${minutes}:${String(remainSeconds).padStart(2, "0")}`;
};

const PracticeSpeaking = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const testId = searchParams.get("testId") || "speaking-default";

  const [isRecording, setIsRecording] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const [recordingError, setRecordingError] = useState("");
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingsRef = useRef<Record<string, string>>({});

  const {
    data: test,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["practiceSpeakingTest", testId],
    queryFn: () => practiceService.fetchSpeakingTest(testId),
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["practiceHistory", "speaking"],
    queryFn: () => practiceService.fetchAttemptHistory("speaking", 5),
  });

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

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  const currentTask = useMemo(() => {
    if (!test?.tasks.length) {
      return undefined;
    }
    return test.tasks.find((task: any) => task.id === currentTaskId) || test.tasks[0];
  }, [test, currentTaskId]);

  const currentTaskIndex = useMemo(() => {
    if (!test?.tasks.length || !currentTask) {
      return 0;
    }
    const index = test.tasks.findIndex((task: any) => task.id === currentTask.id);
    return index >= 0 ? index : 0;
  }, [test, currentTask]);

  const hasTaskNavigation = (test?.tasks?.length || 0) > 1;

  const goToTaskByIndex = (index: number) => {
    if (!test?.tasks?.length || index < 0 || index >= test.tasks.length) {
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    setCurrentTaskId(test.tasks[index].id);
  };

  const answerWordCount = useMemo(() => {
    if (!currentTask) {
      return 0;
    }
    const value = answers[currentTask.id] || "";
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }, [answers, currentTask]);

  const recordingProgress = useMemo(() => {
    if (!currentTask || currentTask.speakSeconds <= 0) {
      return 0;
    }
    return Math.min(100, (recordingSeconds / currentTask.speakSeconds) * 100);
  }, [recordingSeconds, currentTask]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const releaseMediaResources = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const startRecording = async () => {
    if (!currentTask) {
      return;
    }

    const supportsMediaRecorder =
      typeof MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;

    if (!supportsMediaRecorder) {
      setRecordingError("MediaRecorder is not supported in this browser.");
      return;
    }

    setRecordingError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      const recordingTaskId = currentTask.id;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordingChunksRef.current.length > 0) {
          const blob = new Blob(recordingChunksRef.current, {
            type: preferredMimeType || "audio/webm",
          });
          const nextUrl = URL.createObjectURL(blob);

          setRecordings((prev) => {
            const currentUrl = prev[recordingTaskId];
            if (currentUrl) {
              URL.revokeObjectURL(currentUrl);
            }
            return {
              ...prev,
              [recordingTaskId]: nextUrl,
            };
          });
        }

        recordingChunksRef.current = [];
        releaseMediaResources();
        setIsRecording(false);
        setRecordingSeconds(0);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch {
      setRecordingError("Could not access the microphone.");
      releaseMediaResources();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording || !currentTask) {
      return;
    }

    if (recordingSeconds >= currentTask.speakSeconds) {
      stopRecording();
    }
  }, [recordingSeconds, currentTask, isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }

      releaseMediaResources();
      Object.values(recordingsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const clearRecordingForCurrentTask = () => {
    if (!currentTask) {
      return;
    }

    setRecordings((prev) => {
      const next = { ...prev };
      const currentUrl = next[currentTask.id];
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      delete next[currentTask.id];
      return next;
    });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!test) {
        throw new Error("Speaking test not loaded");
      }
      return practiceService.submitSpeakingAttempt(test.attemptId, test.testId, test.title, {
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
          : "Failed to submit speaking answers.";
      setSubmissionMessage(message);
    },
  });

  const submitRef = useRef(submitMutation);
  submitRef.current = submitMutation;

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
          <p className="text-muted-foreground">Loading speaking test...</p>
        </div>
      </div>
    );
  }

  if (error || !test || !currentTask) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ApiErrorState
          title="Failed to load speaking test"
          message="Check endpoint `/api/ielts/practice/speaking/:testId` or fallback mode."
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
                  ? formatSeconds(test.durationSeconds - elapsedSeconds)
                  : formatSeconds(elapsedSeconds)}
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
                const totalWords = Object.values(answers).reduce((total, value) => {
                  return total + (value.trim() ? value.trim().split(/\s+/).length : 0);
                }, 0);
                if (totalWords < 15) {
                  alert("You must write at least 15 words across all transcripts or record audio before submitting.");
                  return;
                }
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending || !hasStarted || !!submissionResult}
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
                  <p className="text-sm text-slate-500 mt-1">No time limit. Relax and focus on pronunciation and argument flow.</p>
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
                Your speaking test has been securely submitted. An expert or AI grader will review your submission shortly.
              </p>
              <div className="text-5xl font-black text-primary scoreboard-font mt-6 drop-shadow-sm">{submissionResult.scoreLabel}</div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center gap-3">
              <button
                onClick={() => navigate("/tests/speaking")}
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
                  Current Test
                </h2>
                <div className="space-y-3">
                  {test.tasks?.map((task: any) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (currentTask.id === task.id) {
                          return;
                        }
                        if (isRecording) {
                          stopRecording();
                        }
                        setCurrentTaskId(task.id);
                      }}
                      className={`group flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-colors ${currentTask.id === task.id
                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-xl">mic</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold flex items-center gap-1">
                          {task.title}
                          {recordings[task.id] ? (
                            <span className="material-symbols-outlined text-green-500 text-sm">
                              check_circle
                            </span>
                          ) : null}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{task.question}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Tips
                  </h2>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {test.tips.map((tip, index) => (
                      <li key={index} className="flex gap-2">
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
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">campaign</span>
                      {currentTask.title}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      Prep {currentTask.prepSeconds}s / Speak {currentTask.speakSeconds}s
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white leading-snug mb-5 whitespace-pre-wrap">
                    {currentTask.question}
                  </h2>
                </div>

                
                <div className="flex-1 lg:w-1/2 flex flex-col bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative top-px">
                      {currentTask.title} Transcript
                    </span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <span>Words: <strong className="font-semibold">{answerWordCount}</strong></span>
                      <span className="text-slate-300 dark:text-slate-600 px-1">|</span>
                      <span>Task {test.tasks.findIndex((p: any) => p.id === currentTask.id) + 1}/{test.tasks.length}</span>
                    </span>
                  </div>

                  <textarea
                    value={answers[currentTask.id] || ""}
                    onChange={(event) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentTask.id]: event.target.value,
                      }))
                    }
                    className="flex-1 w-full p-6 bg-transparent custom-scrollbar border-0 focus:ring-0 resize-none text-slate-800 dark:text-slate-100 leading-[1.8] text-[15px] font-sans placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    placeholder="Type your speaking response transcript here..."
                    spellCheck={false}
                  />

                  <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          if (isRecording) {
                            stopRecording();
                          } else {
                            startRecording();
                          }
                        }}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${isRecording
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-primary text-white hover:bg-blue-600"
                          }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {isRecording ? "stop_circle" : "mic"}
                        </span>
                        {isRecording ? "Stop Recording" : "Start Recording"}
                      </button>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300">
                          {formatSeconds(recordingSeconds)} / {formatSeconds(currentTask.speakSeconds)}
                        </span>

                        {recordings[currentTask.id] && (
                          <button
                            onClick={clearRecordingForCurrentTask}
                            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                            title="Delete Recording"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full transition-all duration-300 ${isRecording ? "bg-red-500" : "bg-primary"
                          }`}
                        style={{ width: `${recordingProgress}%` }}
                      ></div>
                    </div>

                    {recordings[currentTask.id] && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                        <audio controls src={recordings[currentTask.id]} className="w-full h-10" />
                      </div>
                    )}

                    {recordingError && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
                        {recordingError}
                      </p>
                    )}

                    {hasTaskNavigation && (
                      <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <button
                          onClick={() => goToTaskByIndex(currentTaskIndex - 1)}
                          disabled={currentTaskIndex === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Previous Part
                        </button>

                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Part {currentTaskIndex + 1} of {test.tasks.length}
                        </span>

                        <button
                          onClick={() => goToTaskByIndex(currentTaskIndex + 1)}
                          disabled={currentTaskIndex >= test.tasks.length - 1}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors font-medium"
                        >
                          Next Part
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {submissionMessage && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white shadow-xl rounded-full px-6 py-2.5 z-50 animate-in slide-in-from-bottom-5">
                  <p className="text-sm font-medium">
                    {submissionMessage}
                  </p>
                </div>
              )}
            </div>

            
            {isChatOpen && (
              <div className="w-80 min-w-[320px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 transition-transform duration-300 ease-out">
                <ChatWindow subject="speaking" />
              </div>
            )}
          </div>
        </main>
      </TextHighlighter>
    </div>
  );
};

export default PracticeSpeaking;
