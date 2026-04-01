import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Battery, BatteryLow, Settings2, RotateCcw, Sparkles,
  Eye, Focus, Lightbulb, Shield, Zap, ChevronDown,
  BarChart3, TrendingUp, Clock, HelpCircle,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/hooks/useAuth";
import { useTelemetry } from "@/hooks/useTelemetry";
import { supabase } from "@/integrations/supabase/client";
import type { CognitiveTrait } from "@/lib/cognitiveRules";

// ─── Telemetry aggregation hook ─────────────────────────────
interface InsightsData {
  toolCounts: { tool: string; count: number }[];
  curiosityTopics: { topic: string; count: number }[];
  hourCounts: { hour: number; count: number }[];
  loaded: boolean;
}

const TOOL_EVENT_MAP: Record<string, string> = {
  flashcard_flip: "Flashcards",
  flashcard_rated: "Flashcards",
  cloze_answer: "Fill-in-the-Blank",
  quiz_answer: "Retention Quiz",
  socratic_turn: "Socratic Debate",
  mindmap_node_click: "Mind Map",
  flowchart_node_click: "Flow Chart",
  practice_answer: "Knowledge Quest",
  final_exam_answer: "Final Exam",
};

function useInsightsData(userId: string | undefined): InsightsData {
  const [data, setData] = useState<InsightsData>({ toolCounts: [], curiosityTopics: [], hourCounts: [], loaded: false });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: events } = await supabase
        .from("telemetry_events")
        .select("event_type, event_data, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!events) { setData((d) => ({ ...d, loaded: true })); return; }

      // Tool usage counts
      const toolMap = new Map<string, number>();
      // Curiosity topics
      const topicMap = new Map<string, number>();
      // Hour distribution
      const hourMap = new Map<number, number>();

      for (const ev of events) {
        // Tool affinity
        const toolLabel = TOOL_EVENT_MAP[ev.event_type];
        if (toolLabel) {
          toolMap.set(toolLabel, (toolMap.get(toolLabel) || 0) + 1);
        }

        // Curiosity
        if (ev.event_type === "explain_this_clicked") {
          const topic = (ev.event_data as any)?.text?.slice(0, 40) || (ev.event_data as any)?.topic || "Unknown";
          topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
        }

        // Hour distribution
        const hour = new Date(ev.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      }

      const toolCounts = Array.from(toolMap.entries())
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count);

      const curiosityTopics = Array.from(topicMap.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const hourCounts = Array.from(hourMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      setData({ toolCounts, curiosityTopics, hourCounts, loaded: true });
    })();
  }, [userId]);

  return data;
}

// ─── Cognitive Mirror Card Data ─────────────────────────────
interface MirrorCard {
  trait: CognitiveTrait;
  icon: typeof Brain;
  color: string;
  category: string;
  observation: string;
  theWhy: string;
}

const MIRROR_CARDS: MirrorCard[] = [
  {
    trait: "dyslexia",
    icon: Eye,
    color: "from-lavender-400 to-lavender-500",
    category: "Reading & Visual Processing",
    observation: "You indicated that dense walls of text can slow down your momentum or cause the words to blur.",
    theWhy: "Your brain processes big-picture concepts brilliantly but gets bogged down decoding individual words in large blocks. We enabled Bionic Reading to act as a guide-track for your eyes, and turned on TL;DR Summaries to give you the destination before you have to start the journey.",
  },
  {
    trait: "dyscalculia",
    icon: Lightbulb,
    color: "from-peach-400 to-peach-500",
    category: "Reading & Visual Processing",
    observation: "You mentioned that abstract numbers, formulas, or timelines don't easily paint a picture in your mind.",
    theWhy: "Math and statistics rely on symbols that don't stick naturally for you. We've instructed the AI to use Visual Data Anchors—pairing all heavy statistics, dates, and formulas with concrete, real-world analogies.",
  },
  {
    trait: "asd",
    icon: Focus,
    color: "from-sage-400 to-sage-500",
    category: "Reading & Visual Processing",
    observation: "You noted that you learn best with clear, predictable logic and struggle with unexpected topic jumps.",
    theWhy: "Your brain thrives on structure and exactness. We've instructed the AI to use precise, literal language (stripping away confusing idioms). We also enabled Transition Bridges, which explicitly explain exactly how a new topic connects to the old one.",
  },
  {
    trait: "adhd",
    icon: Zap,
    color: "from-amber-400 to-peach-400",
    category: "Focus & Momentum",
    observation: "You noted that if a topic is boring, it is physically painful to focus, and you need high interest to get started.",
    theWhy: "Your brain is wired to respond to genuine interest rather than just 'importance.' We set your default tools to highly interactive formats like the Socratic Chatbot to manufacture the engagement you need to lock in.",
  },
  {
    trait: "ef_planning",
    icon: Settings2,
    color: "from-lavender-400 to-sky-300",
    category: "Focus & Momentum",
    observation: "You indicated that looking at a large assignment makes you freeze because you aren't sure which step to take first.",
    theWhy: "Looking at a massive project overloads your brain's planning center. We've set the AI to automatically break complex materials down into bite-sized, Actionable Checklists. One clear next step at a time.",
  },
  {
    trait: "working_memory",
    icon: Brain,
    color: "from-sky-200 to-lavender-300",
    category: "Focus & Momentum",
    observation: "You mentioned that you sometimes lose the beginning of a sentence by the time you reach the end.",
    theWhy: "Your short-term memory buffer fills up quickly. We've formatted your notes into punchy micro-steps and enabled Recall Prompts to help actively move information into your long-term memory.",
  },
  {
    trait: "dysgraphia_motor",
    icon: Sparkles,
    color: "from-peach-300 to-peach-500",
    category: "Output & Execution",
    observation: "You indicated that the physical act of writing, or organizing your thoughts into a structured essay, is exhausting.",
    theWhy: "The physical or mental act of formatting sentences creates a traffic jam for your actual knowledge. We bypass this by defaulting to Fill-in-the-Blank (Cloze) Notes, saving your energy for understanding.",
  },
  {
    trait: "rsd",
    icon: Shield,
    color: "from-sage-300 to-sage-500",
    category: "Environment & Emotion",
    observation: "You indicated that getting practice questions wrong can trigger an intense surge of frustration, anxiety, or the desire to quit.",
    theWhy: "Traditional testing environments trigger a stress response that blocks learning. We've switched your testing to 'Safe-to-Fail' Mode with Knowledge Quests and XP points instead of red X's.",
  },
  {
    trait: "cognitive_burnout",
    icon: BatteryLow,
    color: "from-lavender-300 to-peach-300",
    category: "Environment & Emotion",
    observation: "You mentioned that traditional studying leaves you completely wiped out or in a state of 'brain fog'.",
    theWhy: "Trying to force your brain to learn in a way it wasn't designed for is exhausting. We've given you a prominent Energy Level toggle. On low-battery days, the system strips away heavy demands and provides bare-minimum survival notes.",
  },
];

const Insights = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useCognitiveProfile();
  const { preferences, updatePreferences, loading: prefsLoading } = useUserPreferences();
  const { track } = useTelemetry();
  const insights = useInsightsData(user?.id);
  const [dataNoticeExpanded, setDataNoticeExpanded] = useState(false);

  const isLowBattery = preferences.energy_mode === "low";

  const toggleEnergyMode = () => {
    const newMode = isLowBattery ? "full" : "low";
    updatePreferences({ energy_mode: newMode });
    track("energy_slider_used", { mode: newMode, day_of_week: new Date().toLocaleDateString("en-US", { weekday: "long" }) });
  };

  const relevantCards = MIRROR_CARDS.filter((card) => profile.traits.includes(card.trait));

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-4xl py-16 text-center">
          <Brain className="mx-auto h-12 w-12 text-lavender-400 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Your Learning Blueprint</h1>
          <p className="text-muted-foreground mb-6">Sign in to see your personalized learning insights.</p>
          <button onClick={() => navigate("/auth")} className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Sign In
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-lavender-100 via-sage-100 to-peach-100 dark:from-lavender-500/10 dark:via-sage-500/10 dark:to-peach-500/10" />
        <div className="container relative max-w-4xl py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-lavender-500/10 px-4 py-1.5 text-xs font-semibold text-lavender-600 dark:text-lavender-300 ring-1 ring-lavender-500/20 backdrop-blur-sm">
              <Brain className="h-3.5 w-3.5" /> Cognitive Mirror
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Your Learning{" "}
              <span className="bg-gradient-to-r from-lavender-500 via-sage-500 to-peach-500 bg-clip-text text-transparent">
                Blueprint
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Understand why your tools were chosen, track your growth, and take full control.
            </p>

            {/* Energy Toggle */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-5 py-3 shadow-sm backdrop-blur-sm">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Energy</span>
              <button
                onClick={toggleEnergyMode}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  isLowBattery
                    ? "bg-peach-200 text-peach-600 dark:bg-peach-500/20 dark:text-peach-300"
                    : "bg-sage-200 text-sage-700 dark:bg-sage-500/20 dark:text-sage-300"
                }`}
              >
                {isLowBattery ? (
                  <><BatteryLow className="h-4 w-4" /> Low Battery</>
                ) : (
                  <><Battery className="h-4 w-4" /> Full Battery</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-4xl py-8 space-y-12">
        {/* ─── Data Transparency Message ─── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-lavender-200 dark:border-lavender-200/30 bg-gradient-to-br from-lavender-50 via-card to-peach-50 dark:from-lavender-500/5 dark:to-peach-500/5 overflow-hidden"
        >
          <button
            onClick={() => setDataNoticeExpanded(!dataNoticeExpanded)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <Shield className="h-3.5 w-3.5 shrink-0 text-lavender-500 dark:text-lavender-300" />
            <span className="flex-1 text-xs font-semibold text-muted-foreground">A note from the creator 💜</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${dataNoticeExpanded ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dataNoticeExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hey! I want to be totally transparent about what data we collect and why. Your trust matters more than any metric.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">What we collect:</strong> Which study tools you use, how long you engage with them, which "Explain This" topics you click, your energy level choices, and setting changes.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Why:</strong> This data powers <em>your</em> Growth Dashboard above — showing you which formats work best for your brain, your curiosity patterns, and your optimal focus windows.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Research sharing:</strong> If you opt in, anonymized data helps our research team improve the platform for all neurodivergent learners. No personal info is ever shared.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preferences.insights_enabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePreferences({ research_data_shared: !preferences.research_data_shared });
                          track("setting_toggled", { setting: "research_data_shared", to: !preferences.research_data_shared });
                        }}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                          preferences.research_data_shared
                            ? "bg-sage-200 text-sage-700 dark:bg-sage-500/20 dark:text-sage-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {preferences.research_data_shared ? "✓ Sharing with research" : "Not sharing with research"}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate("/settings"); }}
                      className="rounded-xl px-4 py-2 text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ⚙️ Manage all data settings
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {!preferences.insights_enabled && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Insights are currently disabled. No data is being collected.</p>
            <button
              onClick={() => { updatePreferences({ insights_enabled: true }); }}
              className="rounded-xl bg-lavender-200 px-4 py-2 text-sm font-semibold text-lavender-600 hover:bg-lavender-300 transition-colors dark:bg-lavender-500/15 dark:text-lavender-300"
            >
              Enable Insights
            </button>
            <p className="text-xs text-muted-foreground">
              Or manage this in{" "}
              <button onClick={() => navigate("/settings")} className="text-lavender-500 underline">Settings</button>
            </p>
          </div>
        )}
        {/* ─── Section 1: Cognitive Mirror Cards ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-lavender-500" />
            <h2 className="text-xl font-bold text-foreground">The "Why" Behind Your Settings</h2>
          </div>

          {profileLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : relevantCards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {relevantCards.map((card) => (
                <motion.div
                  key={card.trait}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${card.color}`} />
                  <div className="p-5 bg-sky-50 dark:bg-sky-950/20">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white`}>
                        <card.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.category}</span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground font-medium mb-2 italic">"{card.observation}"</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.theWhy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <Brain className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No cognitive profile set up yet.</p>
              <button
                onClick={() => navigate("/setup")}
                className="inline-flex items-center gap-2 rounded-xl bg-lavender-200 px-4 py-2 text-sm font-semibold text-lavender-600 hover:bg-lavender-300 transition-colors dark:bg-lavender-500/15 dark:text-lavender-300 dark:hover:bg-lavender-500/25"
              >
                <Brain className="h-4 w-4" /> Take the Learning Quiz
              </button>
            </div>
          )}
        </section>

        {/* ─── Section 2: Growth Dashboard ─── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-sage-500" />
            <h2 className="text-xl font-bold text-foreground">Growth Dashboard</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Format Affinity */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-sage-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format Affinity</span>
              </div>
              {insights.loaded && insights.toolCounts.length > 0 ? (
                <div className="space-y-2">
                  {insights.toolCounts.slice(0, 4).map((t) => {
                    const max = insights.toolCounts[0].count;
                    return (
                      <div key={t.tool}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-foreground">{t.tool}</span>
                          <span className="text-[10px] text-muted-foreground">{t.count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sage-400 to-sage-500"
                            style={{ width: `${(t.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Complete a few study sessions and we'll show you which tools work best for your brain!
                  </p>
                </div>
              )}
            </div>

            {/* Curiosity Map */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-4 w-4 text-lavender-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Curiosity Map</span>
              </div>
              {insights.loaded && insights.curiosityTopics.length > 0 ? (
                <div className="space-y-2">
                  {insights.curiosityTopics.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-lavender-500 font-bold">{t.count}x</span>
                      <span className="text-xs text-foreground truncate">{t.topic}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Use "Explain This" on highlighted text and we'll map your curiosity patterns!
                  </p>
                </div>
              )}
            </div>

            {/* Focus Windows */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-peach-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Focus Windows</span>
              </div>
              {insights.loaded && insights.hourCounts.length > 0 ? (() => {
                const maxCount = Math.max(...insights.hourCounts.map((h) => h.count));
                const peakHour = insights.hourCounts.reduce((a, b) => (b.count > a.count ? b : a));
                const formatHour = (h: number) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-foreground font-medium">
                      Peak: <span className="text-peach-500 font-bold">{formatHour(peakHour.hour)}</span>
                    </p>
                    <div className="flex items-end gap-[2px] h-16">
                      {Array.from({ length: 24 }, (_, h) => {
                        const entry = insights.hourCounts.find((e) => e.hour === h);
                        const count = entry?.count || 0;
                        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div
                            key={h}
                            title={`${formatHour(h)}: ${count} events`}
                            className={`flex-1 rounded-t-sm transition-all ${count > 0 ? "bg-gradient-to-t from-peach-400 to-peach-300" : "bg-muted/50"}`}
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>12am</span>
                      <span>12pm</span>
                      <span>11pm</span>
                    </div>
                  </div>
                );
              })() : (
                <div className="flex items-center justify-center h-24">
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Study a few times and we'll find your optimal focus windows!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Section 3: Control Center ─── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-peach-500" />
              <h2 className="text-xl font-bold text-foreground">Control Center</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Recalibrate */}
            <button
              onClick={() => navigate("/setup")}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:shadow-md transition-shadow group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-200 to-peach-200 dark:from-lavender-500/20 dark:to-peach-500/20">
                <RotateCcw className="h-6 w-6 text-lavender-600 dark:text-lavender-300" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Recalibrate My Profile</div>
                <div className="text-xs text-muted-foreground">Retake the onboarding quiz to update your settings</div>
              </div>
            </button>

            {/* Go to Settings */}
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:shadow-md transition-shadow group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-200 to-sky-200 dark:from-sage-500/20 dark:to-sky-300/20">
                <Settings2 className="h-6 w-6 text-sage-600 dark:text-sage-300" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Settings</div>
                <div className="text-xs text-muted-foreground">Fine-tune every feature toggle and audio preference</div>
              </div>
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Insights;
