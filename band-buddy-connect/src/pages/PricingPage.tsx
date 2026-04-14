import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { Check, Zap, Star, Crown } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const PLANS = [
  {
    id: "free",
    name: "Бесплатный",
    icon: <Zap className="w-6 h-6" />,
    priceMonthly: 0,
    priceYearly: 0,
    description: "Для тех, кто только начинает",
    color: "border-border",
    badge: null,
    features: [
      "5 практических заданий в день",
      "Базовая обратная связь от AI",
      "Доступ к библиотеке тестов (ограничено)",
      "Прогресс-трекер",
    ],
    notIncluded: [
      "Неограниченные задания",
      "Детальный анализ ошибок",
      "Персональный план обучения",
      "Приоритетная поддержка",
    ],
  },
  {
    id: "monthly",
    name: "Стандарт",
    icon: <Star className="w-6 h-6" />,
    priceMonthly: 4990,
    priceYearly: 49900,
    description: "Лучший выбор для активной подготовки",
    color: "border-primary ring-2 ring-primary",
    badge: "Популярный",
    features: [
      "Неограниченные практические задания",
      "Детальная обратная связь от AI",
      "Полный доступ к библиотеке тестов",
      "Персональный план обучения",
      "Анализ слабых мест",
      "История всех попыток",
      "Поддержка в чате",
    ],
    notIncluded: ["Приоритетная поддержка 24/7", "Индивидуальные сессии"],
  },
  {
    id: "yearly",
    name: "Премиум",
    icon: <Crown className="w-6 h-6" />,
    priceMonthly: 8990,
    priceYearly: 89900,
    description: "Максимальные возможности для достижения высшего балла",
    color: "border-yellow-400 ring-2 ring-yellow-400",
    badge: "Лучшая цена",
    features: [
      "Всё из тарифа «Стандарт»",
      "Приоритетная поддержка 24/7",
      "Расширенная аналитика прогресса",
      "Эксклюзивные учебные материалы",
      "Симуляция реального экзамена",
      "Персональный AI-куратор",
      "Скидка 17% при оплате за год",
    ],
    notIncluded: [],
  },
];

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const handleSelect = (planId: string) => {
    if (planId === "free") {
      navigate(user ? "/dashboard" : "/register");
      return;
    }
    if (!user) {
      navigate("/register");
      return;
    }
    navigate("/settings");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAuth={true} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Тарифные планы</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Выберите подходящий план и начните эффективную подготовку к IELTS или SAT уже сегодня.
          </p>
          <div className="mt-6 inline-flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Ежегодно
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">−17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
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
                    <p className="text-3xl font-bold">Бесплатно</p>
                  ) : (
                    <div>
                      <p className="text-3xl font-bold">
                        {new Intl.NumberFormat("ru-KZ").format(price)}
                        <span className="text-base font-normal text-muted-foreground"> ₸</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {billing === "monthly" ? "в месяц" : "в год"}
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
                  onClick={() => handleSelect(plan.id)}
                  className={
                    plan.id === "free"
                      ? "btn-secondary w-full"
                      : plan.id === "yearly"
                      ? "w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-semibold transition-colors"
                      : "btn-primary w-full"
                  }
                >
                  {plan.id === "free" ? "Начать бесплатно" : "Выбрать план"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-accent rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Часто задаваемые вопросы</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left mt-6 max-w-3xl mx-auto">
            {[
              {
                q: "Можно ли отменить подписку?",
                a: "Да, вы можете отменить подписку в любое время. Доступ сохраняется до конца оплаченного периода.",
              },
              {
                q: "Как оплатить?",
                a: "Принимаем оплату картами Visa, Mastercard, а также через Kaspi Pay.",
              },
              {
                q: "Есть ли пробный период?",
                a: "Бесплатный тариф позволяет оценить платформу без ограничений по времени.",
              },
              {
                q: "Подходит ли для SAT?",
                a: "Да, платформа поддерживает подготовку как к IELTS, так и к SAT.",
              },
            ].map((faq) => (
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

// useState imported inline
import { useState } from "react";
export default PricingPage;
