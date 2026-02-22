import { apiRequest, ApiError } from "@/lib/apiClient";

export type PracticeMode = "reading" | "listening" | "speaking" | "writing";

export interface PracticeQuestion {
  id: string;
  prompt: string;
  type: "single-choice" | "short-text";
  options?: string[];
  placeholder?: string;
}

export interface ReadingPracticeTest {
  attemptId: string;
  testId: string;
  title: string;
  instruction: string;
  durationSeconds: number;
  passageTitle: string;
  passageSections: {
    id: string;
    heading: string;
    text: string;
  }[];
  questions: PracticeQuestion[];
}

export interface ListeningPracticeTest {
  attemptId: string;
  testId: string;
  title: string;
  instruction: string;
  durationSeconds: number;
  audioUrl: string;
  audioDurationLabel: string;
  notesTitle: string;
  questions: PracticeQuestion[];
  partAudios?: Record<string, string>;
  transcripts?: Record<string, string>;
}

export interface SpeakingPracticeTask {
  id: string;
  part: number;
  title: string;
  question: string;
  prepSeconds: number;
  speakSeconds: number;
}

export interface SpeakingPracticeTest {
  attemptId: string;
  testId: string;
  title: string;
  instruction: string;
  durationSeconds: number;
  tasks: SpeakingPracticeTask[];
  tips: string[];
}

export interface WritingPracticeTask {
  id: string;
  title: string;
  desc: string;
  promptTitle: string;
  question: string;
  minWords: number;
  imageUrl?: string;
}

export interface WritingPracticeTest {
  attemptId: string;
  testId: string;
  title: string;
  instruction: string;
  durationSeconds: number;
  tasks: WritingPracticeTask[];
  tips: string[];
}

export interface PracticeHistoryItem {
  id: string;
  mode: PracticeMode;
  testId: string;
  testTitle: string;
  submittedAt: string;
  scoreLabel: string;
  status: "submitted" | "checking" | "reviewed";
}

export interface SubmitAttemptPayload {
  answers: Record<string, string>;
}

export interface SubmitAttemptResult {
  attemptId: string;
  scoreLabel: string;
  status: "submitted" | "checking" | "reviewed";
  feedback?: string;
  detailedResults?: {
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }[];
}

const ENABLE_LOCAL_FALLBACK =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK !== "false";

const HISTORY_KEY = "bandup_local_practice_history";

const fallbackReadingTest = (testId: string): ReadingPracticeTest => ({
  attemptId: `reading-local-${Date.now()}`,
  testId,
  title: "Reading Practice Test",
  instruction: "Read the text and answer questions below.",
  durationSeconds: 3600,
  passageTitle: "Livestock Guard Dogs: A Historical Perspective",
  passageSections: [
    {
      id: "A",
      heading: "A",
      text: "The use of dogs to protect livestock dates back thousands of years. These dogs were bred for protection rather than herding.",
    },
    {
      id: "B",
      heading: "B",
      text: "Modern guard dogs are raised with livestock and often deter predators by presence and loud barking.",
    },
    {
      id: "C",
      heading: "C",
      text: "Studies in Portugal and Australia show strong reductions in predation when guard dogs are used properly.",
    },
    {
      id: "D",
      heading: "D",
      text: "Challenges include interactions with hikers and care costs, though many farmers consider benefits greater.",
    },
  ],
  questions: [
    {
      id: "q1",
      prompt:
        "Which paragraph explains how guard dogs are trained to bond with livestock?",
      type: "single-choice",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q2",
      prompt: "Which paragraph gives research evidence from different countries?",
      type: "single-choice",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q3",
      prompt:
        "Write one short phrase about one challenge when introducing livestock guard dogs.",
      type: "short-text",
      placeholder: "Your answer",
    },
  ],
});

const fallbackListeningTest = (testId: string): ListeningPracticeTest => ({
  attemptId: `listening-local-${Date.now()}`,
  testId,
  title: "Listening Practice Test",
  instruction: "Listen to the audio and complete the notes.",
  durationSeconds: 2400,
  audioUrl: "",
  audioDurationLabel: "8:02",
  notesTitle: "Research around the Chembe Bird Sanctuary",
  questions: [
    {
      id: "q1",
      prompt: "They destroy ___ and other rodents.",
      type: "short-text",
      placeholder: "ONE WORD",
    },
    {
      id: "q2",
      prompt: "They help prevent farmers from being bitten by ___.",
      type: "short-text",
      placeholder: "ONE WORD",
    },
    {
      id: "q3",
      prompt: "They now support the economy by encouraging ___.",
      type: "short-text",
      placeholder: "ONE WORD",
    },
  ],
});

const fallbackSpeakingTest = (testId: string): SpeakingPracticeTest => ({
  attemptId: `speaking-local-${Date.now()}`,
  testId,
  title: "Speaking Practice Test",
  instruction: "Prepare and answer each speaking part.",
  durationSeconds: 900,
  tasks: [
    {
      id: "part1",
      part: 1,
      title: "Part 1",
      question: "Tell me about your hometown.",
      prepSeconds: 30,
      speakSeconds: 90,
    },
    {
      id: "part2",
      part: 2,
      title: "Part 2",
      question: "Describe a time when you helped someone.",
      prepSeconds: 60,
      speakSeconds: 120,
    },
    {
      id: "part3",
      part: 3,
      title: "Part 3",
      question: "Do you think community service should be required at school?",
      prepSeconds: 30,
      speakSeconds: 120,
    },
  ],
  tips: [
    "Focus on fluency first, then vocabulary variety.",
    "Support opinions with concrete examples.",
    "Use cohesive devices naturally (however, for example, in contrast).",
  ],
});

const fallbackWritingTest = (testId: string): WritingPracticeTest => ({
  attemptId: `writing-local-${Date.now()}`,
  testId,
  title: "Writing Practice Test",
  instruction: "Write responses for Task 1 and Task 2.",
  durationSeconds: 3600,
  tasks: [
    {
      id: "task1",
      title: "Task 1",
      desc: "Graph Description",
      promptTitle: "Line graph report",
      question:
        "The graph below shows changes in the number of overseas visitors to three different areas in a European country between 1987 and 2007. Summarise the information by selecting and reporting the main features.",
      minWords: 150,
    },
    {
      id: "task2",
      title: "Task 2",
      desc: "Essay Writing",
      promptTitle: "Argument essay",
      question:
        "Some people believe unpaid community service should be compulsory for high school students. To what extent do you agree or disagree?",
      minWords: 250,
    },
  ],
  tips: [
    "Spend a few minutes planning before writing.",
    "Keep paragraphs focused on one main idea.",
    "Aim for clarity before complex vocabulary.",
  ],
});

const readHistory = (): PracticeHistoryItem[] => {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as PracticeHistoryItem[];
  } catch {
    return [];
  }
};

const writeHistory = (history: PracticeHistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const pushLocalHistory = (
  mode: PracticeMode,
  testId: string,
  testTitle: string,
  result: SubmitAttemptResult
) => {
  const current = readHistory();
  current.unshift({
    id: `${mode}-${Date.now()}`,
    mode,
    testId,
    testTitle,
    submittedAt: new Date().toISOString(),
    scoreLabel: result.scoreLabel,
    status: result.status,
  });
  writeHistory(current.slice(0, 30));
};

const buildFallbackSubmitResult = (
  attemptId: string,
  payload: SubmitAttemptPayload
): SubmitAttemptResult => {
  const total = Object.keys(payload.answers).length;
  const filled = Object.values(payload.answers).filter(Boolean).length;
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return {
    attemptId,
    scoreLabel: `${percent}% completed`,
    status: "submitted",
    feedback: "Saved locally (fallback mode).",
  };
};

const submitWithFallback = async (
  mode: PracticeMode,
  endpoint: string,
  attemptId: string,
  testId: string,
  testTitle: string,
  payload: SubmitAttemptPayload
): Promise<SubmitAttemptResult> => {
  try {
    return await apiRequest<SubmitAttemptResult>(endpoint, {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
      const result = buildFallbackSubmitResult(attemptId, payload);
      pushLocalHistory(mode, testId, testTitle, result);
      return result;
    }
    throw error;
  }
};

export const practiceService = {
  fetchReadingTest: async (testId: string): Promise<ReadingPracticeTest> => {
    try {
      return await apiRequest<ReadingPracticeTest>(
        `/api/ielts/practice/reading/${encodeURIComponent(testId)}`
      );
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return fallbackReadingTest(testId);
      }
      throw error;
    }
  },

  fetchListeningTest: async (testId: string): Promise<ListeningPracticeTest> => {
    try {
      return await apiRequest<ListeningPracticeTest>(
        `/api/ielts/practice/listening/${encodeURIComponent(testId)}`
      );
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return fallbackListeningTest(testId);
      }
      throw error;
    }
  },

  fetchSpeakingTest: async (testId: string): Promise<SpeakingPracticeTest> => {
    try {
      return await apiRequest<SpeakingPracticeTest>(
        `/api/ielts/practice/speaking/${encodeURIComponent(testId)}`
      );
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return fallbackSpeakingTest(testId);
      }
      throw error;
    }
  },

  fetchWritingTest: async (testId: string): Promise<WritingPracticeTest> => {
    try {
      return await apiRequest<WritingPracticeTest>(
        `/api/ielts/practice/writing/${encodeURIComponent(testId)}`
      );
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return fallbackWritingTest(testId);
      }
      throw error;
    }
  },

  submitReadingAttempt: async (
    attemptId: string,
    testId: string,
    testTitle: string,
    payload: SubmitAttemptPayload
  ): Promise<SubmitAttemptResult> =>
    submitWithFallback(
      "reading",
      `/api/ielts/practice/reading/${encodeURIComponent(attemptId)}/answers`,
      attemptId,
      testId,
      testTitle,
      payload
    ),

  submitListeningAttempt: async (
    attemptId: string,
    testId: string,
    testTitle: string,
    payload: SubmitAttemptPayload
  ): Promise<SubmitAttemptResult> =>
    submitWithFallback(
      "listening",
      `/api/ielts/practice/listening/${encodeURIComponent(attemptId)}/answers`,
      attemptId,
      testId,
      testTitle,
      payload
    ),

  submitSpeakingAttempt: async (
    attemptId: string,
    testId: string,
    testTitle: string,
    payload: SubmitAttemptPayload
  ): Promise<SubmitAttemptResult> =>
    submitWithFallback(
      "speaking",
      `/api/ielts/practice/speaking/${encodeURIComponent(attemptId)}/answers`,
      attemptId,
      testId,
      testTitle,
      payload
    ),

  submitWritingAttempt: async (
    attemptId: string,
    testId: string,
    testTitle: string,
    payload: SubmitAttemptPayload
  ): Promise<SubmitAttemptResult> =>
    submitWithFallback(
      "writing",
      `/api/ielts/practice/writing/${encodeURIComponent(attemptId)}/answers`,
      attemptId,
      testId,
      testTitle,
      payload
    ),

  fetchAttemptHistory: async (
    mode: PracticeMode,
    limit = 10
  ): Promise<PracticeHistoryItem[]> => {
    try {
      return await apiRequest<PracticeHistoryItem[]>(
        `/api/ielts/practice/${mode}/attempts?limit=${limit}`
      );
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return readHistory()
          .filter((entry) => entry.mode === mode)
          .slice(0, limit);
      }
      throw error;
    }
  },
};
