import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "../components/Header";
import { Eye, EyeOff } from "lucide-react";
import { useAuth, type RegisterOnboardingPayload } from "../hooks/useAuth";

const TOTAL_STEPS = 2;
const SKILL_OPTIONS = ["listening", "reading", "writing", "speaking"] as const;
const DISCOVERY_SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "friend", label: "Friend" },
  { value: "google", label: "Google Search" },
  { value: "school", label: "School / Teacher" },
  { value: "other", label: "Other" },
] as const;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    primaryExam: "ielts" as "ielts" | "sat",
    currentIeltsScore: "",
    targetIeltsScore: "7.0",
    targetExamDate: "",
    targetSatScore: "",
    studyHoursPerWeek: "6",
    preferredStudyTime: "flexible" as
      | "morning"
      | "afternoon"
      | "evening"
      | "flexible",
    discoverySource: "instagram" as
      | "instagram"
      | "youtube"
      | "tiktok"
      | "friend"
      | "google"
      | "school"
      | "other",
    focusSkills: ["reading", "writing"] as Array<
      "listening" | "reading" | "writing" | "speaking"
    >,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const progressPercent = useMemo(
    () => Math.round((currentStep / TOTAL_STEPS) * 100),
    [currentStep]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const toggleFocusSkill = (skill: (typeof SKILL_OPTIONS)[number]) => {
    setFormData((prev) => {
      const exists = prev.focusSkills.includes(skill);
      const nextSkills = exists
        ? prev.focusSkills.filter((item) => item !== skill)
        : [...prev.focusSkills, skill];
      return {
        ...prev,
        focusSkills: Array.from(new Set(nextSkills)),
      };
    });
  };

  const validateStepOne = (): string | null => {
    if (!formData.name.trim()) {
      return "Please enter your name.";
    }
    if (!formData.email.trim()) {
      return "Please enter your email.";
    }
    if (!formData.password) {
      return "Please enter a password.";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters.";
    }
    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const validateStepTwo = (): string | null => {
    const currentIeltsScore = formData.currentIeltsScore
      ? Number(formData.currentIeltsScore)
      : null;
    const targetIeltsScore = Number(formData.targetIeltsScore);
    const targetSatScore = formData.targetSatScore
      ? Number(formData.targetSatScore)
      : null;
    const studyHoursPerWeek = Number(formData.studyHoursPerWeek);

    if (!formData.targetExamDate) {
      return "Please choose your target exam date.";
    }
    if (new Date(formData.targetExamDate).getTime() < new Date().setHours(0, 0, 0, 0)) {
      return "Target exam date cannot be in the past.";
    }

    if (
      currentIeltsScore !== null &&
      (!Number.isFinite(currentIeltsScore) || currentIeltsScore < 0 || currentIeltsScore > 9)
    ) {
      return "Current IELTS score must be between 0 and 9.";
    }

    if (
      formData.primaryExam === "ielts" &&
      (!Number.isFinite(targetIeltsScore) || targetIeltsScore < 0 || targetIeltsScore > 9)
    ) {
      return "Please enter a valid IELTS target score between 0 and 9.";
    }

    if (
      formData.primaryExam === "sat" &&
      (targetSatScore === null ||
        !Number.isFinite(targetSatScore) ||
        targetSatScore < 400 ||
        targetSatScore > 1600)
    ) {
      return "Please enter a valid SAT target score between 400 and 1600.";
    }

    if (
      !Number.isFinite(studyHoursPerWeek) ||
      studyHoursPerWeek < 1 ||
      studyHoursPerWeek > 40
    ) {
      return "Study hours per week must be between 1 and 40.";
    }

    if (formData.focusSkills.length === 0) {
      return "Please choose at least one focus skill.";
    }
    if (!formData.discoverySource) {
      return "Please tell us how you heard about BandUp.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (currentStep === 1) {
      const stepOneError = validateStepOne();
      if (stepOneError) {
        setError(stepOneError);
        return;
      }
      setCurrentStep(2);
      return;
    }

    const stepTwoError = validateStepTwo();
    if (stepTwoError) {
      setError(stepTwoError);
      return;
    }

    setIsLoading(true);

    const currentIeltsScore = formData.currentIeltsScore
      ? Number(formData.currentIeltsScore)
      : null;
    const targetIeltsScore = Number(formData.targetIeltsScore);
    const targetSatScore = formData.targetSatScore
      ? Number(formData.targetSatScore)
      : null;
    const studyHoursPerWeek = Number(formData.studyHoursPerWeek);

    const onboarding: RegisterOnboardingPayload = {
      primaryExam: formData.primaryExam,
      targetIeltsScore:
        formData.primaryExam === "ielts" &&
        Number.isFinite(targetIeltsScore) &&
        targetIeltsScore >= 0 &&
        targetIeltsScore <= 9
          ? targetIeltsScore
          : null,
      currentIeltsScore:
        formData.primaryExam === "ielts" &&
        currentIeltsScore !== null &&
        Number.isFinite(currentIeltsScore) &&
        currentIeltsScore >= 0 &&
        currentIeltsScore <= 9
          ? currentIeltsScore
          : null,
      targetExamDate: formData.targetExamDate || null,
      targetSatScore:
        formData.primaryExam === "sat" &&
        targetSatScore !== null &&
        Number.isFinite(targetSatScore) &&
        targetSatScore >= 400 &&
        targetSatScore <= 1600
          ? targetSatScore
          : null,
      studyHoursPerWeek: Math.min(40, Math.max(1, Math.round(studyHoursPerWeek))),
      focusSkills: formData.focusSkills,
      preferredStudyTime: formData.preferredStudyTime,
      discoverySource: formData.discoverySource,
    };

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      onboarding
    );

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Registration failed");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showAuth={false} />

      <main className="max-w-md mx-auto px-4 py-16">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Sign Up</h1>
            <p className="text-muted-foreground">
              Create your account and set learning goals
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>{currentStep === 1 ? "Step 1: Account" : "Step 2: Study Goals"}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full h-12 px-4 border border-input rounded-lg"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full h-12 px-4 border border-input rounded-lg"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full h-12 px-4 pr-12 border border-input rounded-lg"
                      placeholder="Create password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      className="w-full h-12 px-4 pr-12 border border-input rounded-lg"
                      placeholder="Repeat password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Study Onboarding</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    We use these answers for personalized schedule, weak-skill focus, and
                    recommendations.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Primary Exam Goal</label>
                  <select
                    name="primaryExam"
                    value={formData.primaryExam}
                    onChange={handleSelectChange}
                    className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                  >
                    <option value="ielts">IELTS</option>
                    <option value="sat">SAT</option>
                  </select>
                </div>

                {formData.primaryExam === "ielts" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Current IELTS Score
                      </label>
                      <input
                        type="number"
                        name="currentIeltsScore"
                        min={0}
                        max={9}
                        step={0.5}
                        value={formData.currentIeltsScore}
                        onChange={handleInputChange}
                        className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Target IELTS Score
                      </label>
                      <input
                        type="number"
                        name="targetIeltsScore"
                        min={0}
                        max={9}
                        step={0.5}
                        value={formData.targetIeltsScore}
                        onChange={handleInputChange}
                        className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                        placeholder="7.0"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2">Target SAT Score</label>
                    <input
                      type="number"
                      name="targetSatScore"
                      min={400}
                      max={1600}
                      step={10}
                      value={formData.targetSatScore}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                      placeholder="1200"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Target Exam Date</label>
                  <input
                    type="date"
                    name="targetExamDate"
                    value={formData.targetExamDate}
                    onChange={handleInputChange}
                    className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Study Hours / Week</label>
                    <input
                      type="number"
                      name="studyHoursPerWeek"
                      min={1}
                      max={40}
                      value={formData.studyHoursPerWeek}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Preferred Study Time</label>
                    <select
                      name="preferredStudyTime"
                      value={formData.preferredStudyTime}
                      onChange={handleSelectChange}
                      className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                    >
                      <option value="flexible">Flexible</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Focus Skills</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SKILL_OPTIONS.map((skill) => {
                      const checked = formData.focusSkills.includes(skill);
                      return (
                        <label
                          key={skill}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFocusSkill(skill)}
                          />
                          <span className="capitalize">{skill}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    How did you hear about BandUp?
                  </label>
                  <select
                    name="discoverySource"
                    value={formData.discoverySource}
                    onChange={handleSelectChange}
                    className="w-full h-12 px-4 border border-input rounded-lg bg-white"
                  >
                    {DISCOVERY_SOURCES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setCurrentStep(1);
                  }}
                  className="w-1/3 h-11 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  disabled={isLoading}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className={`btn-primary h-11 disabled:opacity-50 ${currentStep === 2 ? "w-2/3" : "w-full"}`}
              >
                {isLoading
                  ? "Signing up..."
                  : currentStep === 1
                    ? "Continue"
                    : "Create Account"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
