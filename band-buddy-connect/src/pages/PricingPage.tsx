import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { Check, Zap, Star, Crown } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "@/lib/apiClient";

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: <Zap className="w-6 h-6" />,
    priceMonthly: 0,
    priceYearly: 0,
    description: "Perfect for getting started",
    color: "border-border",
    badge: null,
    priceId: null,
    features: [
      "5 practice tasks per day",
      "Basic AI feedback",
      "Limited test library access",
      "Progress tracker",
    ],
    notIncluded: [
      "Unlimited practice tasks",
      "Detailed error analysis",
      "Personalized study plan",
      "Priority support",
    ],
  },
  {
    id: "monthly",
    name: "Standard",
    icon: <Star className="w-6 h-6" />,
    priceMonthly: 4990,
    priceYearly: 49900,
    description: "Best choice for active preparation",
    color: "border-primary ring-2 ring-primary",
    badge: "Popular",
    priceId: "price_monthly",
    features: [
      "Unlimited practice tasks",
      "Detailed AI feedback",
      "Full test library access",
      "Personalized study plan",
      "Weak-spot analysis",
      "Full attempt history",
      "Chat support",
    ],
    notIncluded: ["24/7 priority support", "One-on-one sessions"],
  },
  {
    id: "yearly",
    name: "Premium",
    icon: <Crown className="w-6 h-6" />,
    priceMonthly: 8990,
    priceYearly: 89900,
    description: "Maximum tools for top scores",
    color: "border-yellow-400 ring-2 ring-yellow-400",
    badge: "Best value",
    priceId: "price_yearly",
    features: [
      "Everything in Standard",
      "24/7 priority support",
      "Advanced progress analytics",
      "Exclusive study materials",
      "Real exam simulation",
      "Personal AI tutor",
      "17% off with annual billing",
    ],
    notIncluded: [],
  },
];

const FAQ = [
  {
    q: "Can I cancel my subscription?",
    a: "Yes, you can cancel anytime. Access continues until the end of your paid period.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept Visa, Mastercard, and Kaspi Pay.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan lets you explore the platform with no time limit.",
  },
  {
    q: "Does it support SAT prep?",
    a: "Yes, the platform supports preparation for both IELTS and SAT.",
  },
];

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handleSelect = async (planId: string, priceId: string | null) => {
    if (planId === "free") {
      navigate(user ? "/dashboard" : "/register");
      return;
    }
    if (!user) {
      navigate("/register");
      return;
    }
    if (!priceId) return;

    setLoadingPlanId(planId);
    try {
      const res = await apiRequest<{ checkout_url: string }>(
        "/payments/create-checkout-session",
        {
          method: "POST",
          body: { price_id: priceId },
        }
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch {
      // Fall back to settings so user can use promo code
      navigate("/settings");
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAuth={true} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Pricing Plans</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choose the right plan and start preparing for IELTS or SAT today.
          </p>
          <div className="mt-6 inline-flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">−17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
            const isLoading = loadingPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative bg-card rounded-2xl border p-6 flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground">
                    {plan.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  {price === 0 ? (
                    <p className="text-3xl font-bold">Free</p>
                  ) : (
                    <div>
                      <p className="text-3xl font-bold">
                        {new Intl.NumberFormat("ru-KZ").format(price)}
                        <span className="text-base font-normal text-muted-foreground"> ₸</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {billing === "monthly" ? "per month" : "per year"}
                      </p>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground line-through">
                      <span className="w-4 h-4 mt-0.5 shrink-0 text-center">✕</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => void handleSelect(plan.id, plan.priceId)}
                  disabled={isLoading}
                  className={
                    plan.id === "free"
                      ? "btn-secondary w-full"
                      : plan.id === "yearly"
                      ? "w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-semibold transition-colors disabled:opacity-60"
                      : "btn-primary w-full disabled:opacity-60"
                  }
                >
                  {isLoading
                    ? "Redirecting..."
                    : plan.id === "free"
                    ? "Get Started Free"
                    : "Choose Plan"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-accent rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left mt-6 max-w-3xl mx-auto">
            {FAQ.map((faq) => (
              <div key={faq.q}>
                <p className="font-semibold mb-1">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
