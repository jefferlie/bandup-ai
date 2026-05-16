import { useState, useRef, useEffect } from "react";
import {
  Headphones,
  BookOpen,
  Edit,
  Mic,
  Calculator,
  Languages,
  Send,
  Bot,
  RotateCcw,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { apiRequest } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Subject {
  id: string;
  label: string;
  icon: React.ElementType;
  welcome: string;
  placeholder: string;
}

// ── Subjects ───────────────────────────────────────────────────────────────────

const SUBJECTS: Subject[] = [
  {
    id: "ielts-listening",
    label: "Listening",
    icon: Headphones,
    welcome:
      "Hi! I'm your IELTS Listening coach. Ask me about strategies, question types (multiple choice, matching, form completion), or tips for improving your score.",
    placeholder: "e.g. How do I handle section 4 of the listening test?",
  },
  {
    id: "ielts-reading",
    label: "Reading",
    icon: BookOpen,
    welcome:
      "Hi! I'm your IELTS Reading coach. Ask me about True/False/Not Given, matching headings, skimming and scanning techniques, or time management.",
    placeholder: "e.g. How do I approach matching headings quickly?",
  },
  {
    id: "ielts-writing",
    label: "Writing",
    icon: Edit,
    welcome:
      "Hi! I'm your IELTS Writing coach. I can help with Task 1 (graphs, letters), Task 2 (essays), grammar, cohesion, vocabulary, and band score criteria.",
    placeholder: "e.g. How do I write a strong Task 2 introduction?",
  },
  {
    id: "ielts-speaking",
    label: "Speaking",
    icon: Mic,
    welcome:
      "Hi! I'm your IELTS Speaking coach. Let's work on fluency, coherence, vocabulary, pronunciation strategies, and all three parts of the speaking test.",
    placeholder: "e.g. What should I say when I don't know an answer in Part 3?",
  },
  {
    id: "sat-math",
    label: "SAT Math",
    icon: Calculator,
    welcome:
      "Hi! I'm your SAT Math tutor. I can explain algebra, advanced math, problem-solving, data analysis, and walk through any question step by step.",
    placeholder: "e.g. How do I solve systems of equations on the SAT?",
  },
  {
    id: "sat-english",
    label: "SAT English",
    icon: Languages,
    welcome:
      "Hi! I'm your SAT English tutor. Ask me about Reading & Writing, craft and structure, information and ideas, standard English conventions, or expression of ideas.",
    placeholder: "e.g. How do I spot the correct transition word in a question?",
  },
];

// ── TypingDots ─────────────────────────────────────────────────────────────────

const TypingDots = () => (
  <div className="flex items-center gap-1 py-1">
    <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
  </div>
);

// ── AIChatPage ─────────────────────────────────────────────────────────────────

const AIChatPage = () => {
  const [activeId, setActiveId] = useState(SUBJECTS[0].id);
  const [histories, setHistories] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const subject = SUBJECTS.find((s) => s.id === activeId)!;
  const messages: Message[] = histories[activeId] ?? [];

  const welcomeMsg: Message = {
    id: `welcome-${activeId}`,
    role: "assistant",
    content: subject.welcome,
  };

  const displayMessages = messages.length === 0 ? [welcomeMsg] : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, loading]);

  const handleTabChange = (id: string) => {
    setActiveId(id);
    setInput("");
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };

    const prevMessages = messages.length === 0 ? [welcomeMsg] : messages;
    const nextMessages = [...prevMessages, userMsg];

    setHistories((h) => ({ ...h, [activeId]: nextMessages }));
    setInput("");
    setError(null);
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const history = prevMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await apiRequest<{ reply: string }>("/api/chat/message", {
        method: "POST",
        body: { message: text, conversation_history: history },
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.reply,
      };
      setHistories((h) => ({ ...h, [activeId]: [...nextMessages, assistantMsg] }));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setHistories((h) => ({ ...h, [activeId]: [] }));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AI Study Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Ask anything about IELTS or SAT preparation
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New chat
            </button>
          )}
        </div>

        {/* ── Subject tabs ── */}
        <div className="flex gap-1 overflow-x-auto px-6 py-3 border-b border-border shrink-0 scrollbar-none">
          {SUBJECTS.map((s) => {
            const Icon = s.icon;
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => handleTabChange(s.id)}
                className={`flex items-center gap-2 shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {error}
              </p>
            </div>
          )}

          {/* Suggested prompts — show only on a fresh chat */}
          {messages.length === 0 && !loading && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              {getSuggestedPrompts(activeId).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="text-left rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
            className="flex items-end gap-3"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={subject.placeholder}
              disabled={loading}
              rows={1}
              className="flex-1 min-h-[44px] max-h-[140px] resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for new line · Each subject keeps its own history
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ── Suggested prompts per subject ─────────────────────────────────────────────

function getSuggestedPrompts(subjectId: string): string[] {
  const map: Record<string, string[]> = {
    "ielts-listening": [
      "What are the most common question types?",
      "How do I improve my listening speed?",
      "Tips for section 3 and 4?",
      "How to predict answers before listening?",
    ],
    "ielts-reading": [
      "How do I do True/False/Not Given questions?",
      "Best skimming strategy for Academic Reading?",
      "How to manage time in the reading test?",
      "Matching headings — what's the trick?",
    ],
    "ielts-writing": [
      "How do I structure a Task 2 essay?",
      "What makes a Band 7+ introduction?",
      "How do I describe a bar chart in Task 1?",
      "What is coherence and cohesion?",
    ],
    "ielts-speaking": [
      "How do I extend my answers in Part 1?",
      "What should I do if I don't understand the question?",
      "How do I sound more fluent?",
      "Tips for the Part 2 long turn?",
    ],
    "sat-math": [
      "How do I solve linear equations quickly?",
      "What math topics appear most on the SAT?",
      "Explain quadratic functions step by step",
      "What is the best strategy for hard questions?",
    ],
    "sat-english": [
      "How do I choose the right transition word?",
      "What is 'craft and structure' on the SAT?",
      "How do I find the main idea of a passage?",
      "Tips for the hardest Reading questions?",
    ],
  };
  return map[subjectId] ?? [];
}

export default AIChatPage;
