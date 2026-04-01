import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, SkipForward, Brain, CheckCircle2 } from "lucide-react";
import { WIZARD_QUESTIONS, deriveTraitsFromAnswers, deriveProfileSettings, type CognitiveTrait } from "@/lib/cognitiveRules";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { toast } from "sonner";

const SECTION_COLORS: Record<string, string> = {
  "Input & Decoding": "from-sage-400 to-sage-500",
  "Output & Organization": "from-lavender-400 to-lavender-500",
  "Emotion & Energy": "from-peach-400 to-peach-500",
};

const SECTION_BG: Record<string, string> = {
  "Input & Decoding": "bg-sage-50 dark:bg-sage-900/20",
  "Output & Organization": "bg-lavender-50 dark:bg-lavender-900/20",
  "Emotion & Energy": "bg-peach-50 dark:bg-peach-900/20",
};

const AGE_RANGES = [
  { label: "Under 10", value: 9 },
  { label: "10–12", value: 11 },
  { label: "13–15", value: 14 },
  { label: "16–18", value: 17 },
  { label: "19–25", value: 22 },
  { label: "26–40", value: 33 },
  { label: "41+", value: 45 },
];

const CognitiveWizard = () => {
  const navigate = useNavigate();
  const { saveProfile, profile } = useCognitiveProfile();
  // step 0 = intro, step 1 = age, 2-(totalQ+1) = questions, then interest, then results
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [hyperFixations, setHyperFixations] = useState<string[]>(
    profile.hyperFixations?.length ? profile.hyperFixations : []
  );
  const [newInterest, setNewInterest] = useState("");
  const [selectedAge, setSelectedAge] = useState<number | null>(profile.age);
  const [saving, setSaving] = useState(false);

  const totalQuestions = WIZARD_QUESTIONS.length;
  // step 1 = age picker
  const isAgeStep = step === 1;
  const isQuestionStep = step >= 2 && step <= totalQuestions + 1;
  const questionIdx = step - 2;
  const currentQ = isQuestionStep ? WIZARD_QUESTIONS[questionIdx] : null;

  const traits = deriveTraitsFromAnswers(answers);
  const needsHyperFixation = traits.includes("interest_based");
  const isInterestStep = step === totalQuestions + 2 && needsHyperFixation;
  const isResultStep = step === (needsHyperFixation ? totalQuestions + 3 : totalQuestions + 2);

  const progressPercent = Math.min(100, (step / (totalQuestions + 2)) * 100);

  const handleAnswer = (optionIdx: number) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optionIdx }));
    setTimeout(() => setStep((s) => s + 1), 300);
  };

  const handleFinish = useCallback(async () => {
    setSaving(true);
    const validInterests = hyperFixations.filter((h) => h.trim());
    const err = await saveProfile(answers, validInterests.length > 0 ? validInterests : undefined, selectedAge);
    setSaving(false);
    if (err) {
      toast.error("Failed to save profile. Please try again.");
    } else {
      toast.success("Cognitive profile saved! Your experience is now personalized.");
      navigate("/");
    }
  }, [answers, hyperFixations, selectedAge, saveProfile, navigate]);

  const handleSkip = () => {
    navigate("/");
  };

  const settings = deriveProfileSettings(traits);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-2xl py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-lavender-500" />
            <span className="text-sm font-semibold text-foreground">Cognitive Setup</span>
          </div>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip for now
          </button>
        </div>
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-sage-400 via-lavender-400 to-peach-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* ─── Intro ─── */}
            {step === 0 && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-6"
              >
                <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-lavender-200 to-peach-200 dark:from-lavender-500/20 dark:to-peach-500/20 flex items-center justify-center">
                  <Brain className="h-10 w-10 text-lavender-600 dark:text-lavender-300" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Let's set up your learning profile</h1>
                  <p className="mt-2 text-muted-foreground">
                    A quick age question + {WIZARD_QUESTIONS.length} questions about how you learn. We'll auto-configure the best tools for your brain.
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sage-500 to-lavender-500 px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:shadow-xl dark:shadow-none transition-all hover:scale-[1.02]"
                >
                  Let's go <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {/* ─── Age step ─── */}
            {isAgeStep && (
              <motion.div
                key="age"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold text-foreground">How old are you?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This helps us adjust reading levels and content appropriateness.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {AGE_RANGES.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => {
                        setSelectedAge(range.value);
                        setTimeout(() => setStep(2), 300);
                      }}
                      className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                        selectedAge === range.value
                          ? "border-lavender-400 bg-lavender-50 dark:bg-lavender-500/10 ring-2 ring-lavender-300"
                          : "border-border hover:border-lavender-200 hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm text-foreground">{range.label}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(0)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  {selectedAge !== null && (
                    <button
                      onClick={() => setStep(2)}
                      className="flex items-center gap-1 text-sm font-medium text-lavender-500 hover:text-lavender-600 transition-colors"
                    >
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── Question screens ─── */}
            {isQuestionStep && currentQ && (
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${SECTION_BG[currentQ.section]} text-foreground`}>
                    {currentQ.sectionIcon} {currentQ.section}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {questionIdx + 1} of {totalQuestions}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-foreground leading-snug">
                  {currentQ.question}
                </h2>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, i) => {
                    const selected = answers[currentQ.id] === i;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                          selected
                            ? "border-lavender-400 bg-lavender-50 dark:bg-lavender-500/10 ring-2 ring-lavender-300"
                            : "border-border hover:border-lavender-200 hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-sm text-foreground">{opt.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{opt.description}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Nav */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  {answers[currentQ.id] !== undefined && (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      className="flex items-center gap-1 text-sm font-medium text-lavender-500 hover:text-lavender-600 transition-colors"
                    >
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── Hyper-fixation input (multiple) ─── */}
            {isInterestStep && (
              <motion.div
                key="interest"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="space-y-6"
              >
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-peach-200 to-lavender-200 dark:from-peach-500/20 dark:to-lavender-500/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-peach-600 dark:text-peach-300" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-foreground">What are your hyper-fixations?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add up to 5 interests. We'll use them to generate fun facts that feel personal.
                  </p>
                </div>

                {/* Interest tags */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {hyperFixations.filter(h => h.trim()).map((h, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full bg-peach-100 dark:bg-peach-500/15 px-3 py-1.5 text-xs font-medium text-peach-600 dark:text-peach-300"
                      >
                        {h}
                        <button
                          onClick={() => setHyperFixations((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-0.5 text-peach-400 hover:text-peach-600 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {hyperFixations.filter(h => h.trim()).length < 5 && (
                    <div className="flex gap-2">
                      <input
                        id="wizard-new-interest"
                        name="wizardNewInterest"
                        type="text"
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newInterest.trim()) {
                            e.preventDefault();
                            setHyperFixations((prev) => [...prev.filter(h => h.trim()), newInterest.trim()]);
                            setNewInterest("");
                          }
                        }}
                        placeholder="e.g. Minecraft, Formula 1, K-pop..."
                        className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-lavender-300 transition-shadow"
                      />
                      <button
                        onClick={() => {
                          if (newInterest.trim()) {
                            setHyperFixations((prev) => [...prev.filter(h => h.trim()), newInterest.trim()]);
                            setNewInterest("");
                          }
                        }}
                        disabled={!newInterest.trim()}
                        className="rounded-xl bg-peach-200 dark:bg-peach-500/20 px-4 py-3 text-sm font-semibold text-peach-600 dark:text-peach-300 transition-colors hover:bg-peach-300 dark:hover:bg-peach-500/30 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">
                    {hyperFixations.filter(h => h.trim()).length}/5 interests added
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-lavender-500 to-peach-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    See my profile <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Results screen ─── */}
            {isResultStep && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-gradient-to-br from-sage-200 to-lavender-200 dark:from-sage-500/20 dark:to-lavender-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-sage-600 dark:text-sage-300" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Your Learning Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Here's what we've configured based on your answers
                  </p>
                </div>

                {selectedAge !== null && selectedAge < 13 && (
                  <div className="rounded-xl bg-peach-50 border border-peach-200 p-3 text-xs text-peach-600 dark:bg-peach-500/10 dark:border-peach-500/30 dark:text-peach-300">
                    🛡️ Since you're under 13, the Socratic Debate tool has been disabled for a safer experience.
                  </div>
                )}

                {traits.length > 0 ? (
                  <div className="space-y-4">
                    {/* Traits */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Identified Patterns
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {traits.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-lavender-100 px-3 py-1 text-xs font-medium text-lavender-600 dark:bg-lavender-500/15 dark:text-lavender-300"
                          >
                            {t.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Auto-selected tools */}
                    {settings.studyTools.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          📚 Auto-Selected Study Tools
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {settings.studyTools.map((t) => (
                            <span key={t} className="rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-sage-600 dark:bg-sage-500/15 dark:text-sage-300">
                              {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {settings.addOns.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          🧩 Add-Ons Enabled
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {settings.addOns.map((t) => (
                            <span key={t} className="rounded-full bg-peach-100 px-3 py-1 text-xs font-medium text-peach-600 dark:bg-peach-500/15 dark:text-peach-300">
                              {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {settings.uiSettings.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          ⚙️ UI Settings
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {settings.uiSettings.map((t) => (
                            <span key={t} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-600 dark:bg-sky-300/15 dark:text-sky-300">
                              {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                    No specific patterns identified — we'll use our standard optimized settings.
                  </div>
                )}

                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-sage-500 via-lavender-500 to-peach-500 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:shadow-xl dark:shadow-none transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save & Start Learning"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CognitiveWizard;
