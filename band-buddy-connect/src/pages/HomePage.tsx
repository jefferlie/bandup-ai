import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import { BookOpen, Users, Zap, Target, Clock, Shield, Atom } from "lucide-react";
import ApiErrorState from "../components/ApiErrorState";
import { contentService } from "../services/contentService";

const iconMap = {
  target: Target,
  clock: Clock,
  shield: Shield,
  book: BookOpen,
  users: Users,
  zap: Zap,
  atom: Atom,
};

const HomePage = () => {
  const navigate = useNavigate();
  const { data, error, refetch } = useQuery({
    queryKey: ["homeContent"],
    queryFn: contentService.fetchHomeContent,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAuth={true} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 w-full">
        {error && (
          <div className="mb-8">
            <ApiErrorState
              compact
              title="Home page content is not loaded from API"
              message="Check endpoint `/api/content/home`."
              onRetry={() => {
                void refetch();
              }}
            />
          </div>
        )}

        <div className="text-center space-y-6 mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            <span className="font-bold text-primary">Band</span>Up
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {data?.heroSubtitle ||
              "Your personal AI assistant for learning and practice 24/7."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <button onClick={() => navigate("/register")} className="btn-primary text-lg px-8">
              Start Learning
            </button>
            <button onClick={() => navigate("/ai-info")} className="btn-secondary text-lg px-8">
              About AI Assistants
            </button>
            <button onClick={() => navigate("/login")} className="btn-secondary text-lg px-8">
              Already Have an Account
            </button>
            <button onClick={() => navigate("/pricing")} className="btn-secondary text-lg px-8">
              Тарифы и цены
            </button>
          </div>
        </div>

        <div className="mb-16 animate-fade-in-up delay-100">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-6 text-foreground">
            Why BandUp?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {(data?.whyBandUp || []).map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.title} className="bg-accent rounded-xl p-6 text-center flex flex-col items-center">
                  <Icon className="w-8 h-8 text-accent-foreground mb-2" />
                  <p className="font-medium text-lg text-foreground mb-2">{item.title}</p>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-8 animate-fade-in-up delay-200">
          {(data?.features || []).map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <div key={item.title} className="text-center space-y-4">
                <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto">
                  <Icon className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 animate-fade-in-up delay-400">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8 text-foreground">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {(data?.howItWorks || []).map((item, index) => (
              <div key={item.title} className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto text-white font-bold text-xl">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
