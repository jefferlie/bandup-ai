import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import { Brain, Zap, Target, Shield, ArrowRight } from "lucide-react";
import ApiErrorState from "../components/ApiErrorState";
import { contentService } from "../services/contentService";

const featureIconMap = {
  brain: Brain,
  zap: Zap,
  target: Target,
  shield: Shield,
};

const AIInfoPage = () => {
  const navigate = useNavigate();
  const { data, error, refetch } = useQuery({
    queryKey: ["aiInfoContent"],
    queryFn: contentService.fetchAIInfoContent,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header showAuth={true} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-8">
            <ApiErrorState
              compact
              title="AI page content is not loaded from API"
              message="Check endpoint `/api/content/ai-info`."
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        )}

        <div className="text-center mb-16">
          <div className="text-6xl mb-6">🤖</div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {data?.heroTitle || "AI Assistants for Learning"}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            {data?.heroSubtitle || "Personal AI assistants help you learn faster."}
          </p>
          <button
            onClick={() => navigate("/register")}
            className="btn-primary text-lg px-8 py-4 flex items-center gap-2 mx-auto"
          >
            <Brain size={20} />
            Try AI Assistant
            <ArrowRight size={20} />
          </button>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Why AI Assistants?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(data?.features || []).map((feature, index) => {
              const Icon = featureIconMap[feature.icon as keyof typeof featureIconMap] || Brain;
              return (
                <div
                  key={index}
                  className="bg-card border border-border rounded-xl p-6 text-center"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Benefits of AI Learning
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(data?.benefits || []).map((benefit, index) => (
              <div key={index} className="bg-accent rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">{benefit.icon}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Subjects to Learn
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(data?.subjects || []).map((subject, index) => (
              <div key={index} className="bg-card border border-border rounded-xl p-4">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{subject.icon}</div>
                  <h3 className="text-xl font-bold text-foreground mb-1">{subject.name}</h3>
                  <p className="text-muted-foreground text-sm">{subject.description}</p>
                </div>
                <div className="space-y-1">
                  {subject.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span className="text-xs text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/register")}
                  className="w-full mt-4 btn-primary text-sm py-2"
                >
                  Start Learning
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIInfoPage;
