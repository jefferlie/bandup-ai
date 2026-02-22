import { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import InputArea from "./InputArea";
import { AI_API_BASE_URL } from "@/lib/apiClient";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatWindowProps {
  subject: string;
}

const ChatWindow = ({ subject }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = AI_API_BASE_URL;
  useEffect(() => {
    const savedChat = localStorage.getItem(`bandup_chat_history_${subject}`);
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    const welcomeMessages = {
      writing:
        "Hi! I'm your AI Writing assistant. I can help you improve writing skills, grammar, style, and structure. Ask me anything!",
      speaking:
        "Hi! I'm your AI Speaking assistant. I can help you build fluency, pronunciation, and confidence in conversation.",
      math: "Hi! I'm your AI Math assistant. I can help you solve problems and explain formulas and concepts.",
      essay: "Write your essay, and I'll review it and suggest improvements.",
      physics:
        "Hi! I'm your AI Physics assistant. I can help solve problems, explain laws, and provide hints.",
    };

    const welcomeMessage: Message = {
      id: "welcome",
      text:
        welcomeMessages[subject as keyof typeof welcomeMessages] ||
        "Hi! I'm your AI assistant. How can I help?",
      isUser: false,
      timestamp: new Date().toISOString(),
    };

    setMessages([welcomeMessage]);
  }, [subject]);
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`bandup_chat_history_${subject}`, JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages, subject]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const payload = { message: inputValue, subject };

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply || "No response was returned from the server.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("API request failed:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: "Connection error. Please try again later.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleAudioSubmit = async (audioBlob: Blob) => {
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: "[Voice message 🎤]",
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("subject", subject);

    try {
      const response = await fetch(`${API_URL}/api/speaking/audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply || "No response from AI.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Audio upload failed:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: "Audio could not be processed. Please try again.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark outline-none">
      
      <div className="bg-surface-light dark:bg-surface-dark p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 capitalize flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
            {subject} AI Tutor
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ask questions to get AI help
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to clear the chat history?")) {
              localStorage.removeItem(`bandup_chat_history_${subject}`);
              setMessages([{
                id: "welcome",
                text: "Chat cleared. How can I help you?",
                isUser: false,
                timestamp: new Date().toISOString(),
              }]);
            }
          }}
          className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Clear Chat History"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message.text}
            isUser={message.isUser}
            timestamp={message.timestamp}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-message chat-ai">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      
      <InputArea
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder={
          subject === "essay"
            ? "Enter your essay for review..."
            : `Enter your ${subject} question...`
        }
        subject={subject}
        onAudioSubmit={handleAudioSubmit}
      />
    </div>
  );
};

export default ChatWindow;
