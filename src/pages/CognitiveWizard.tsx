import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, SkipForward, Brain, CheckCircle2, Eye, Type, Sun, Moon } from "lucide-react";
import { WIZARD_QUESTIONS, deriveTraitsFromAnswers, deriveProfileSettings, deriveProfileLabel, TOOL_DETAILS, type CognitiveTrait } from "@/lib/cognitiveRules";
import { WRITING_STYLE_LABELS, getActiveVariantKey, buildTutorialNotes, type WritingStyleKey } from "@/lib/onboardingTemplate";
import { sanitizeHtml } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FOLDER } from "@/lib/constants";
import { toast } from "sonner";
import { useTheme } from "next-themes";

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
  const { user } = useAuth();
  const { saveProfile, profile } = useCognitiveProfile();
  const { theme, setTheme } = useTheme();
  // step 0 = intro, step 1 = age, 2-(totalQ+1) = questions, then interest, then results
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [hyperFixations, setHyperFixations] = useState<string[]>(
    profile.hyperFixations?.length ? profile.hyperFixations : []
  );
  const [newInterest, setNewInterest] = useState("");
  const [selectedAge, setSelectedAge] = useState<number | null>(profile.age);
  const [selectedGender, setSelectedGender] = useState<string | null>(profile.gender);
  const [selectedRegion, setSelectedRegion] = useState<string>(profile.region || "");
  const [saving, setSaving] = useState(false);

  // ── Smart Checkout state (initialized when result step is reached) ──
  const [selectedWritingStyles, setSelectedWritingStyles] = useState<WritingStyleKey[]>(["standard"]);
  const [selectedUiSettings, setSelectedUiSettings] = useState<string[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [selectedStudyTools, setSelectedStudyTools] = useState<string[]>([]);
  const [checkoutInitialized, setCheckoutInitialized] = useState(false);

  // Font & spacing preview state
  const [selectedFont, setSelectedFont] = useState<"arial" | "lexend" | "opendyslexic">("arial");
  const [fontSize, setFontSize] = useState(0.95);
  const [lineSpacing, setLineSpacing] = useState(1.6);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [wordSpacing, setWordSpacing] = useState(0);

  const totalQuestions = WIZARD_QUESTIONS.length;
  // step 0 = intro, step 1 = age, step 2 = demographics, step 3+ = questions
  const isAgeStep = step === 1;
  const isDemographicsStep = step === 2;
  const isQuestionStep = step >= 3 && step <= totalQuestions + 2;
  const questionIdx = step - 3;
  const currentQ = isQuestionStep ? WIZARD_QUESTIONS[questionIdx] : null;

  const traits = deriveTraitsFromAnswers(answers);
  const needsHyperFixation = traits.includes("interest_based");
  const isInterestStep = step === totalQuestions + 3 && needsHyperFixation;
  const isResultStep = step === (needsHyperFixation ? totalQuestions + 4 : totalQuestions + 3);

  const progressPercent = Math.min(100, (step / (totalQuestions + 3)) * 100);

  const handleToggleOption = (optionIdx: number) => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const current = prev[currentQ.id] || [];
      const hasTraits = currentQ.options[optionIdx].traits.length > 0;
      if (current.includes(optionIdx)) {
        // Deselect
        return { ...prev, [currentQ.id]: current.filter((i) => i !== optionIdx) };
      }
      // If selecting a baseline option (no traits), clear other selections
      if (!hasTraits) {
        return { ...prev, [currentQ.id]: [optionIdx] };
      }
      // If selecting a trait option, remove any baseline (no-trait) options
      const filtered = current.filter((i) => currentQ.options[i]?.traits.length > 0);
      return { ...prev, [currentQ.id]: [...filtered, optionIdx] };
    });
  };

  // Bionic reading transformation
  const applyBionic = useCallback((html: string): string => {
    return html.replace(/>([^<]+)</g, (match, text: string) => {
      const bionicText = text.replace(/\b(\w{2,})\b/g, (word: string) => {
        const boldLen = Math.ceil(word.length * 0.4);
        return `<span style="font-weight:700">${word.slice(0, boldLen)}</span>${word.slice(boldLen)}`;
      });
      return `>${bionicText}<`;
    });
  }, []);

  // Live preview HTML — dynamically assembled from traits + selected add-ons
  const activeVariantKey = useMemo(
    () => getActiveVariantKey(selectedWritingStyles),
    [selectedWritingStyles],
  );
  const activePreviewHtml = useMemo(() => {
    let html = buildTutorialNotes({
      writingStyle: activeVariantKey,
      traits,
      addOns: selectedAddOns,
      uiSettings: selectedUiSettings,
    });
    if (selectedUiSettings.includes("bionic_reading")) {
      html = applyBionic(html);
    }
    return sanitizeHtml(html);
  }, [activeVariantKey, traits, selectedAddOns, selectedUiSettings, applyBionic]);

  // Preview CSS classes
  const previewClasses = useMemo(() => {
    return "generated-notes";
  }, []);

  // Preview styles — apply font, size, spacing settings
  const FONT_FAMILIES: Record<string, string> = {
    arial: "'Arial', 'Helvetica Neue', sans-serif",
    lexend: "'Lexend', sans-serif",
    opendyslexic: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
  };

  const previewStyles = useMemo((): React.CSSProperties => {
    return {
      fontFamily: FONT_FAMILIES[selectedFont],
      fontSize: `${fontSize}rem`,
      lineHeight: lineSpacing,
      letterSpacing: `${letterSpacing}em`,
      wordSpacing: `${wordSpacing}em`,
    };
  }, [selectedFont, fontSize, lineSpacing, letterSpacing, wordSpacing]);

  const handleFinish = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    // 1. Save cognitive profile with custom checkout preferences
    const validInterests = hyperFixations.filter((h) => h.trim());
    const err = await saveProfile(answers, validInterests.length > 0 ? validInterests : undefined, selectedAge, { gender: selectedGender, region: selectedRegion.trim() || null });
    if (err) {
      setSaving(false);
      toast.error("Failed to save profile. Please try again.");
      return;
    }

    // 2. Save checkout preferences into wizard_answers (alongside existing answers)
    const checkoutPrefs = {
      ...answers,
      _checkout: {
        writingStyles: selectedWritingStyles,
        uiSettings: selectedUiSettings,
        addOns: selectedAddOns,
        studyTools: selectedStudyTools,
      },
    };
    const { error: prefsError } = await supabase
      .from("cognitive_profiles" as any)
      .update({ wizard_answers: checkoutPrefs })
      .eq("user_id", user.id);

    if (prefsError) {
      console.error("[Wizard] Failed to save checkout preferences:", prefsError);
      toast.warning("Profile saved, but some preferences could not be stored.");
    }

    // 2b. Save font & spacing preferences
    try {
      await supabase
        .from("user_preferences" as any)
        .upsert({
          user_id: user.id,
          dyslexia_font: selectedFont === "opendyslexic",
          bionic_reading: selectedUiSettings.includes("bionic_reading"),
          font_size: fontSize,
          line_spacing: lineSpacing,
          letter_spacing: letterSpacing,
          word_spacing: wordSpacing,
        }, { onConflict: "user_id" });
      // Also persist adhd_font to localStorage
      localStorage.setItem("bfn:adhd_font", String(selectedFont === "lexend"));
    } catch {
      console.warn("[Wizard] Font preferences save failed");
    }

    // 3. Insert welcome note into saved_notes
    let welcomeHtml = buildTutorialNotes({
      writingStyle: activeVariantKey,
      traits,
      addOns: selectedAddOns,
      uiSettings: selectedUiSettings,
    });
    if (selectedUiSettings.includes("bionic_reading")) {
      welcomeHtml = applyBionic(welcomeHtml);
    }
    const { data: noteData, error: noteError } = await supabase
      .from("saved_notes")
      .insert({
        user_id: user.id,
        title: "Welcome to Brain-Friendly Notes",
        content: welcomeHtml,
        folder: DEFAULT_FOLDER,
        source_type: "onboarding",
        tags: ["tutorial", "getting-started"],
      })
      .select("id")
      .single();

    if (noteError) {
      console.error("[Wizard] Failed to save welcome note:", noteError);
    }

    setSaving(false);
    toast.success("Profile saved! Let's generate your first set of notes.");

    // 4. Redirect to the upload page so user can generate their first notes
    navigate("/");
  }, [answers, hyperFixations, selectedAge, selectedGender, selectedRegion, selectedFont, fontSize, lineSpacing, letterSpacing, wordSpacing, selectedWritingStyles, selectedUiSettings, selectedAddOns, selectedStudyTools, activeVariantKey, traits, applyBionic, user, saveProfile, navigate]);

  const handleSkip = () => {
    navigate("/");
  };

  const settings = deriveProfileSettings(traits);

  // Initialize checkout toggles from AI-derived settings (once)
  useEffect(() => {
    if (isResultStep && !checkoutInitialized) {
      setSelectedUiSettings([...settings.uiSettings]);
      setSelectedAddOns([...settings.addOns]);
      setSelectedStudyTools([...settings.studyTools]);

      // Auto-select writing style based on traits
      const styles: WritingStyleKey[] = [];
      if (traits.includes("adhd")) styles.push("bulleted");
      if (traits.includes("asd")) styles.push("literal");
      if (traits.includes("strict_procedural")) styles.push("procedural");
      if (styles.includes("bulleted") && styles.includes("literal")) {
        setSelectedWritingStyles(["bulleted_literal"]);
      } else if (styles.length > 0) {
        setSelectedWritingStyles(styles);
      } else {
        setSelectedWritingStyles(["standard"]);
      }

      // Auto-select font based on traits
      if (traits.includes("dyslexia")) {
        setSelectedFont("opendyslexic");
        setLineSpacing(2.0);
        setLetterSpacing(0.05);
      } else if (traits.includes("adhd")) {
        setSelectedFont("lexend");
        setLetterSpacing(0.03);
      }

      setCheckoutInitialized(true);
    }
  }, [isResultStep, checkoutInitialized, settings, traits]);

  // Toggle helpers
  const toggleWritingStyle = useCallback((key: WritingStyleKey) => {
    setSelectedWritingStyles((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((s) => s !== key) : prev) : [...prev, key]
    );
  }, []);

  const toggleItem = useCallback(
    (key: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    },
    [],
  );

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
        <div className={`w-full ${isResultStep ? "max-w-6xl" : "max-w-lg"}`}>
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
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sage-500 to-lavender-500 px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:shadow-xl dark:shadow-none transition-all"
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

            {/* ─── Demographics step ─── */}
            {isDemographicsStep && (
              <motion.div
                key="demographics"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold text-foreground">A little about you</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Optional — helps us understand how different learners use the platform. You can update this anytime in Settings.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Gender</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                        { value: "non_binary", label: "Non-binary" },
                        { value: "prefer_not_to_say", label: "Prefer not to say" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedGender(selectedGender === opt.value ? null : opt.value)}
                          className={`rounded-xl border p-3 text-sm font-medium transition-all duration-200 ${
                            selectedGender === opt.value
                              ? "border-lavender-400 bg-lavender-50 dark:bg-lavender-500/10 ring-2 ring-lavender-300"
                              : "border-border hover:border-lavender-200 hover:bg-muted/50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wizard-region" className="text-sm font-medium text-foreground mb-2 block">Region</label>
                    <input
                      id="wizard-region"
                      name="wizardRegion"
                      type="text"
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      placeholder="e.g., Tennessee, US"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-lavender-300 transition-shadow"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-lavender-500 to-peach-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {!selectedGender && !selectedRegion.trim() ? "Skip" : "Next"} <ArrowRight className="h-4 w-4" />
                  </button>
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

                <p className="text-xs text-muted-foreground -mt-3">Select all that apply</p>
                <div className="space-y-2.5">
                  {currentQ.options.map((opt, i) => {
                    const currentSelections = answers[currentQ.id] || [];
                    const selected = currentSelections.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => handleToggleOption(i)}
                        className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                          selected
                            ? "border-lavender-400 bg-lavender-50 dark:bg-lavender-500/10 ring-2 ring-lavender-300"
                            : "border-border hover:border-lavender-200 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selected
                              ? "bg-lavender-500 border-lavender-500"
                              : "border-muted-foreground/30"
                          }`}>
                            {selected && (
                              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-foreground">{opt.label}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                        </div>
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
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-lavender-500 to-peach-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {(answers[currentQ.id]?.length ?? 0) === 0 ? "Skip" : "Next"} <ArrowRight className="h-4 w-4" />
                  </button>
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

            {/* ─── Smart Checkout (split-screen) ─── */}
            {isResultStep && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5"
              >
                {/* Header with profile name */}
                <div className="text-center">
                  <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-sage-200 to-lavender-200 dark:from-sage-500/20 dark:to-lavender-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-sage-600 dark:text-sage-300" />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sage-100 to-lavender-100 dark:from-sage-500/15 dark:to-lavender-500/15 px-4 py-1.5 mb-2">
                    <span className="text-sm font-bold text-foreground">{deriveProfileLabel(traits).name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{deriveProfileLabel(traits).description}</p>
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Toggle anything on or off below — your preview updates live on the right.
                  </p>
                </div>

                {/* Trait badges */}
                {traits.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {traits.map((t) => (
                      <span key={t} className="rounded-full bg-lavender-100 px-2.5 py-0.5 text-[11px] font-medium text-lavender-600 dark:bg-lavender-500/15 dark:text-lavender-300">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}

                {selectedAge !== null && selectedAge < 13 && (
                  <div className="rounded-xl bg-peach-50 border border-peach-200 p-3 text-xs text-peach-600 dark:bg-peach-500/10 dark:border-peach-500/30 dark:text-peach-300">
                    Since you're under 13, the Socratic Debate tool has been disabled for a safer experience.
                  </div>
                )}

                {/* ─── Split-screen grid ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* ── LEFT COLUMN: Toggle Switches ── */}
                  <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-1">

                    {/* AI Writing Style */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                        AI Writing Style
                      </div>
                      <div className="space-y-1.5">
                        {(Object.keys(WRITING_STYLE_LABELS) as WritingStyleKey[]).map((key) => {
                          const info = WRITING_STYLE_LABELS[key];
                          const active = selectedWritingStyles.includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => toggleWritingStyle(key)}
                              className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                                active
                                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10"
                                  : "border-border/50 hover:border-border hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">{info.name}</span>
                                <div className={`h-5 w-9 rounded-full transition-colors ${active ? "bg-primary" : "bg-muted"}`}>
                                  <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${active ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                                </div>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{info.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Font & Spacing */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                        <Type className="h-3 w-3" /> Font & Spacing
                      </div>

                      {/* Font selector */}
                      <div className="space-y-1.5 mb-3">
                        {([
                          { id: "arial" as const, name: "Arial", desc: "Clean, universal sans-serif" },
                          { id: "lexend" as const, name: "Lexend", desc: "Expanded spacing, optimized for ADHD focus" },
                          { id: "opendyslexic" as const, name: "OpenDyslexic", desc: "Bottom-weighted letters, optimized for dyslexia" },
                        ]).map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setSelectedFont(font.id)}
                            className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                              selectedFont === font.id
                                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10"
                                : "border-border/50 hover:border-border hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground" style={{ fontFamily: FONT_FAMILIES[font.id] }}>{font.name}</span>
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${selectedFont === font.id ? "border-primary" : "border-muted-foreground/30"}`}>
                                {selectedFont === font.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{font.desc}</p>
                          </button>
                        ))}
                      </div>

                      {/* Spacing sliders */}
                      <div className="space-y-3 rounded-xl border border-border/50 p-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground">Font Size</span>
                            <span className="text-[11px] font-medium text-foreground">{fontSize.toFixed(2)}rem</span>
                          </div>
                          <input type="range" min="0.8" max="1.6" step="0.05" value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground">Line Spacing</span>
                            <span className="text-[11px] font-medium text-foreground">{lineSpacing.toFixed(1)}</span>
                          </div>
                          <input type="range" min="1.2" max="2.5" step="0.1" value={lineSpacing}
                            onChange={(e) => setLineSpacing(Number(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground">Letter Spacing</span>
                            <span className="text-[11px] font-medium text-foreground">{letterSpacing.toFixed(2)}em</span>
                          </div>
                          <input type="range" min="0" max="0.12" step="0.01" value={letterSpacing}
                            onChange={(e) => setLetterSpacing(Number(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground">Word Spacing</span>
                            <span className="text-[11px] font-medium text-foreground">{wordSpacing.toFixed(2)}em</span>
                          </div>
                          <input type="range" min="0" max="0.5" step="0.05" value={wordSpacing}
                            onChange={(e) => setWordSpacing(Number(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
                        </div>
                      </div>
                    </div>

                    {/* UI Settings */}
                    {(() => {
                      // Always show bionic_reading + audio_player alongside trait-derived settings
                      const alwaysShow = ["bionic_reading", "audio_player"];
                      const visibleSettings = [...new Set([...alwaysShow, ...settings.uiSettings])];
                      return visibleSettings.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                          UI Settings
                        </div>
                        <div className="space-y-1.5">
                          {visibleSettings.map((key) => {
                            const info = TOOL_DETAILS[key];
                            if (!info) return null;
                            const active = selectedUiSettings.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleItem(key, setSelectedUiSettings)}
                                className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                                  active
                                    ? "border-sky-300 bg-sky-50 dark:bg-sky-500/10 ring-1 ring-sky-200/50"
                                    : "border-border/50 hover:border-border hover:bg-muted/30"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">{info.name}</span>
                                  <div className={`h-5 w-9 rounded-full transition-colors ${active ? "bg-sky-500" : "bg-muted"}`}>
                                    <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${active ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                                  </div>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{info.explanation}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      );
                    })()}

                    {/* Add-ons */}
                    {settings.addOns.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                          AI Add-Ons
                        </div>
                        <div className="space-y-1.5">
                          {settings.addOns.map((key) => {
                            const info = TOOL_DETAILS[key];
                            if (!info) return null;
                            const active = selectedAddOns.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleItem(key, setSelectedAddOns)}
                                className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                                  active
                                    ? "border-peach-300 bg-peach-50 dark:bg-peach-500/10 ring-1 ring-peach-200/50"
                                    : "border-border/50 hover:border-border hover:bg-muted/30"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">{info.name}</span>
                                  <div className={`h-5 w-9 rounded-full transition-colors ${active ? "bg-peach-500" : "bg-muted"}`}>
                                    <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${active ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                                  </div>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{info.explanation}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Study Tools */}
                    {settings.studyTools.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                          Study Tools
                        </div>
                        <div className="space-y-1.5">
                          {settings.studyTools.map((key) => {
                            const info = TOOL_DETAILS[key];
                            if (!info) return null;
                            const active = selectedStudyTools.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleItem(key, setSelectedStudyTools)}
                                className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                                  active
                                    ? "border-sage-300 bg-sage-50 dark:bg-sage-500/10 ring-1 ring-sage-200/50"
                                    : "border-border/50 hover:border-border hover:bg-muted/30"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">{info.name}</span>
                                  <div className={`h-5 w-9 rounded-full transition-colors ${active ? "bg-sage-500" : "bg-muted"}`}>
                                    <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${active ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                                  </div>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{info.explanation}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── RIGHT COLUMN: Live Preview ── */}
                  <div className="lg:sticky lg:top-20 lg:self-start">
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      {/* Preview header */}
                      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-2.5">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Live Preview
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/60">
                            {WRITING_STYLE_LABELS[activeVariantKey]?.name}
                          </span>
                          <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground hover:text-foreground transition-colors"
                            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                          >
                            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Preview content */}
                      <div
                        className={`${previewClasses} max-h-[55vh] overflow-y-auto p-5`}
                        style={previewStyles}
                        dangerouslySetInnerHTML={{ __html: activePreviewHtml }}
                      />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-sage-500 via-lavender-500 to-peach-500 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:shadow-xl dark:shadow-none transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save & Start Learning"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CognitiveWizard;
