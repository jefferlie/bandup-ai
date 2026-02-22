import { apiRequest, ApiError } from "@/lib/apiClient";

type IconKey =
  | "target"
  | "clock"
  | "shield"
  | "book"
  | "users"
  | "zap"
  | "atom"
  | "brain";

export interface HomePageContent {
  heroTitle: string;
  heroSubtitle: string;
  whyBandUp: { icon: IconKey; title: string; description: string }[];
  features: { icon: IconKey; title: string; description: string }[];
  howItWorks: { title: string; description: string }[];
}

export interface AIInfoContent {
  heroTitle: string;
  heroSubtitle: string;
  features: { icon: IconKey; title: string; description: string }[];
  benefits: { icon: string; title: string; description: string }[];
  subjects: {
    name: string;
    description: string;
    icon: string;
    features: string[];
  }[];
}

const ENABLE_LOCAL_FALLBACK =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK !== "false";

const homeFallback: HomePageContent = {
  heroTitle: "BandUp",
  heroSubtitle:
    "Your personal AI assistant for Writing, Speaking, Math, and Physics. Get personalized learning support 24/7.",
  whyBandUp: [
    {
      icon: "target",
      title: "Personalized Approach",
      description: "AI adapts to your level and learning goals",
    },
    {
      icon: "clock",
      title: "Available 24/7",
      description: "Learn anytime, anywhere without limitations",
    },
    {
      icon: "shield",
      title: "Security & Privacy",
      description: "Your data is protected and never shared with third parties",
    },
  ],
  features: [
    {
      icon: "book",
      title: "Writing",
      description:
        "Improve writing with personalized feedback and guided exercises",
    },
    {
      icon: "users",
      title: "Speaking",
      description:
        "Build speaking confidence through interactive dialogue practice",
    },
    {
      icon: "zap",
      title: "Math",
      description: "Solve math problems with clear step-by-step explanations",
    },
    {
      icon: "atom",
      title: "Physics",
      description:
        "Learn physics from mechanics to quantum concepts with AI support",
    },
  ],
  howItWorks: [
    {
      title: "Choose a Subject",
      description: "Pick Writing, Speaking, Math, or Physics and get started",
    },
    {
      title: "Talk to AI",
      description: "Ask questions and receive personalized answers",
    },
    {
      title: "Track Progress",
      description: "Monitor your growth and improvements in real time",
    },
  ],
};

const aiInfoFallback: AIInfoContent = {
  heroTitle: "AI Assistants for Learning",
  heroSubtitle:
    "Discover the power of AI in education. Personal AI assistants help you master subjects faster and more effectively.",
  features: [
    {
      icon: "brain",
      title: "Artificial Intelligence",
      description:
        "Our AI assistants use machine learning to deliver personalized guidance.",
    },
    {
      icon: "zap",
      title: "Instant Answers",
      description:
        "Get detailed explanations and solutions in real time, 24/7.",
    },
    {
      icon: "target",
      title: "Personalized Approach",
      description: "AI adapts to your level and learning style.",
    },
    {
      icon: "shield",
      title: "Data Security",
      description: "Your data is protected and not shared with third parties.",
    },
  ],
  benefits: [
    {
      icon: "🎯",
      title: "Accurate Answers",
      description: "AI analyzes your question and returns relevant responses",
    },
    {
      icon: "📚",
      title: "Broad Knowledge",
      description: "Access a large knowledge base across multiple subjects",
    },
    {
      icon: "⏰",
      title: "Time Saving",
      description: "Get answers instantly",
    },
    {
      icon: "🔄",
      title: "Continuous Improvement",
      description: "AI keeps improving and updating its knowledge",
    },
  ],
  subjects: [
    {
      name: "Writing",
      description: "Improve writing skills with AI assistance",
      icon: "✍️",
      features: ["Grammar", "Style", "Text Structure", "Error Checking"],
    },
    {
      name: "Speaking",
      description: "Develop speaking skills with an AI coach",
      icon: "🗣️",
      features: ["Pronunciation", "Confidence", "Dialogues", "Speaking Practice"],
    },
    {
      name: "Math",
      description: "Solve problems with step-by-step explanations",
      icon: "📊",
      features: ["Algebra", "Geometry", "Trigonometry", "Step-by-step Solutions"],
    },
    {
      name: "Physics",
      description: "Understand laws of nature with AI support",
      icon: "⚛️",
      features: ["Mechanics", "Electrodynamics", "Optics", "Quantum Physics"],
    },
  ],
};

export const contentService = {
  fetchHomeContent: async (): Promise<HomePageContent> => {
    try {
      return await apiRequest<HomePageContent>("/api/content/home", {
        withAuth: false,
      });
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return homeFallback;
      }
      throw error;
    }
  },

  fetchAIInfoContent: async (): Promise<AIInfoContent> => {
    try {
      return await apiRequest<AIInfoContent>("/api/content/ai-info", {
        withAuth: false,
      });
    } catch (error) {
      if (ENABLE_LOCAL_FALLBACK && error instanceof ApiError) {
        return aiInfoFallback;
      }
      throw error;
    }
  },
};
