import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings2, Headphones, Brain, Radio, Waves,
  ChevronRight, User, Lock, MessageCircle,
  Moon, Type, Save,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences, UserPreferences } from "@/hooks/useUserPreferences";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useTelemetry } from "@/hooks/useTelemetry";
import { ISOCHRONIC_OPTIONS } from "@/hooks/useAudioMixer";
import { toast } from "sonner";

/* ── Helpers ── */

/** Pick a subset of keys from preferences */
function pick<K extends keyof UserPreferences>(prefs: UserPreferences, keys: K[]): Pick<UserPreferences, K> {
  const out = {} as Pick<UserPreferences, K>;
  for (const k of keys) out[k] = prefs[k];
  return out;
}

/** Deep-equal for flat objects */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

/* ── Section keys per category ── */

const APPEARANCE_KEYS: (keyof UserPreferences)[] = ["default_dark_mode"];

const FONT_KEYS: (keyof UserPreferences)[] = [
  "dyslexia_font", "bionic_reading", "font_size", "line_spacing", "letter_spacing", "word_spacing",
];

const STUDY_KEYS: (keyof UserPreferences)[] = [
  "dopamine_rewards", "fun_fact_mode", "fun_fact_custom_topic",
  "tldr_default", "jargon_default", "retention_quiz_default", "mindmap_default", "flowchart_default",
  "feynman_default", "recall_prompts_default", "simplify_default",
  "why_care_default", "safe_to_fail", "reduce_motion",
];

const AUDIO_KEYS: (keyof UserPreferences)[] = [
  "lofi_enabled", "gamma_beats_enabled", "isochronic_enabled",
  "lofi_playlist_url", "isochronic_hz",
  "lofi_volume", "gamma_volume", "isochronic_volume",
];

const PRIVACY_KEYS: (keyof UserPreferences)[] = ["insights_enabled", "research_data_shared"];

/* ── Custom hook for staged section state ── */

function useStagedSection<K extends keyof UserPreferences>(
  preferences: UserPreferences,
  keys: K[],
  updatePreferences: (u: Partial<UserPreferences>) => Promise<void>,
  track: (event: string, data: Record<string, unknown>) => void,
) {
  const committed = pick(preferences, keys);
  const [staged, setStaged] = useState<Pick<UserPreferences, K>>(committed);

  // Sync staged state when committed prefs change (e.g. after load)
  useEffect(() => {
    setStaged(pick(preferences, keys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences]);

  const hasChanges = !shallowEqual(staged as Record<string, unknown>, committed as Record<string, unknown>);

  const update = useCallback((partial: Partial<Pick<UserPreferences, K>>) => {
    setStaged((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = useCallback(async () => {
    await updatePreferences(staged);
    // Track each changed key
    for (const k of keys) {
      if (staged[k] !== committed[k]) {
        track("setting_toggled", { setting: k, to: staged[k] });
      }
    }
    toast.success("Settings saved");
  }, [staged, committed, updatePreferences, track, keys]);

  return { staged, update, save, hasChanges };
}

/* ── Main component ── */

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences, updatePreferences, loading: prefsLoading } = useUserPreferences();
  const { profile } = useCognitiveProfile();
  const { track } = useTelemetry();

  const hasDyslexiaTrait = profile.traits.includes("dyslexia");

  const appearance = useStagedSection(preferences, APPEARANCE_KEYS, updatePreferences, track);
  const font = useStagedSection(preferences, FONT_KEYS, updatePreferences, track);
  const study = useStagedSection(preferences, STUDY_KEYS, updatePreferences, track);
  const audio = useStagedSection(preferences, AUDIO_KEYS, updatePreferences, track);
  const privacy = useStagedSection(preferences, PRIVACY_KEYS, updatePreferences, track);

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-3xl py-16 text-center">
          <Settings2 className="mx-auto h-12 w-12 text-lavender-400 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Account Settings</h1>
          <p className="text-muted-foreground mb-6">Sign in to manage your settings.</p>
          <button onClick={() => navigate("/auth")} className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Sign In
          </button>
        </div>
      </Layout>
    );
  }

  if (prefsLoading) {
    return (
      <Layout>
        <div className="container max-w-3xl py-16">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-3xl py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-lavender-500" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all your preferences in one place. Changes are saved per section.</p>
        </div>

        {/* Account — no staged state needed, just navigation */}
        <Section icon={User} title="Account" color="text-lavender-500">
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </div>
          <button
            onClick={() => navigate("/setup")}
            className="flex items-center gap-2 rounded-xl bg-lavender-100 px-4 py-2.5 text-sm font-semibold text-lavender-600 hover:bg-lavender-200 transition-colors dark:bg-lavender-500/15 dark:text-lavender-300"
          >
            <Brain className="h-4 w-4" /> Recalibrate Cognitive Profile
            <ChevronRight className="h-4 w-4 ml-auto" />
          </button>
          {profile.wizardCompleted && (
            <div className="text-xs text-muted-foreground">
              Age on file: <span className="font-medium text-foreground">{profile.age || "Not set"}</span>
              {" · "}
              <button onClick={() => navigate("/setup")} className="text-lavender-500 underline">Update</button>
            </div>
          )}
        </Section>

        {/* Appearance */}
        <Section icon={Moon} title="Appearance" color="text-lavender-500">
          <Toggle
            value={appearance.staged.default_dark_mode}
            onChange={(v) => appearance.update({ default_dark_mode: v })}
            label="Default to Dark Mode"
            desc="Automatically use dark theme when you sign in"
          />
          <SaveButton hasChanges={appearance.hasChanges} onSave={appearance.save} />
        </Section>

        {/* Font & Reading */}
        <Section icon={Type} title="Font & Reading" color="text-sage-500">
          <Toggle
            value={font.staged.dyslexia_font}
            onChange={(v) => font.update({ dyslexia_font: v })}
            label="Readable Font"
            desc="Use the OpenDyslexic typeface for improved readability"
          />
          <Toggle
            value={font.staged.bionic_reading}
            onChange={(v) => font.update({ bionic_reading: v })}
            label="Bionic Reading"
            desc="Bold the first few letters of words to guide your eyes"
          />

          <div className="space-y-4 pt-2">
            <FontSlider label="Font Size" value={font.staged.font_size} min={0.8} max={1.6} step={0.05} unit="rem" onChange={(v) => font.update({ font_size: v })} />
            <FontSlider label="Line Spacing" value={font.staged.line_spacing} min={1.2} max={2.5} step={0.1} onChange={(v) => font.update({ line_spacing: v })} />
            <FontSlider label="Letter Spacing" value={font.staged.letter_spacing} min={0} max={0.12} step={0.01} unit="em" onChange={(v) => font.update({ letter_spacing: v })} />
            <FontSlider label="Word Spacing" value={font.staged.word_spacing} min={0} max={0.5} step={0.02} unit="em" onChange={(v) => font.update({ word_spacing: v })} />
          </div>

          {/* Preview */}
          <div
            className="rounded-xl border border-border bg-background p-4 text-foreground"
            style={{
              fontFamily: font.staged.dyslexia_font ? "'OpenDyslexic', sans-serif" : "'Lexend', sans-serif",
              fontSize: `${font.staged.font_size}rem`,
              lineHeight: font.staged.line_spacing,
              letterSpacing: `${font.staged.letter_spacing}em`,
              wordSpacing: `${font.staged.word_spacing}em`,
            }}
          >
            The quick brown fox jumps over the lazy dog. This is a preview of your current font settings.
          </div>
          <SaveButton hasChanges={font.hasChanges} onSave={font.save} />
        </Section>

        {/* Study Tools */}
        <Section icon={MessageCircle} title="Study Tools" color="text-sage-500">
          <Toggle
            value={study.staged.dopamine_rewards}
            onChange={(v) => study.update({ dopamine_rewards: v })}
            label="Dopamine Rewards"
            desc="Show 'Fun Fact!' links in study tools and notes"
          />

          {study.staged.dopamine_rewards && (
            <div className="space-y-3 rounded-xl bg-muted/30 p-4">
              <div className="text-xs font-semibold text-foreground">Fun Fact Topic Source</div>
              <div className="flex flex-col gap-2">
                {([
                  { value: "material" as const, label: "Study Material", desc: "Based on your current notes or study content" },
                  { value: "special_interest" as const, label: "Special Interest", desc: profile.hyperFixation ? `Fun facts about "${profile.hyperFixation}"` : "Set your special interest in your Cognitive Profile" },
                  { value: "custom" as const, label: "Type Your Own", desc: "Enter a custom topic — resets when you log out" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === "special_interest" && !profile.hyperFixation) return;
                      study.update({ fun_fact_mode: opt.value });
                    }}
                    disabled={opt.value === "special_interest" && !profile.hyperFixation}
                    className={`flex items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                      study.staged.fun_fact_mode === opt.value
                        ? "bg-primary/10 ring-2 ring-primary/30"
                        : "bg-muted/50 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                      study.staged.fun_fact_mode === opt.value ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {study.staged.fun_fact_mode === opt.value && (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {study.staged.fun_fact_mode === "custom" && (
                <div className="pt-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Custom Topic</label>
                  <input
                    id="fun-fact-custom-topic"
                    name="funFactCustomTopic"
                    type="text"
                    value={study.staged.fun_fact_custom_topic}
                    onChange={(e) => study.update({ fun_fact_custom_topic: e.target.value })}
                    placeholder="e.g. Space exploration, Ancient Rome, Marine biology..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">This resets to "Study Material" when you log out.</p>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Note Add-on Defaults</p>
            <div className="space-y-1">
              <Toggle value={study.staged.tldr_default} onChange={(v) => study.update({ tldr_default: v })} label="📌 TL;DR Summary" desc="Start notes with a 'Bottom-Line Up Front' summary" />
              <Toggle value={study.staged.jargon_default} onChange={(v) => study.update({ jargon_default: v })} label="📖 Jargon Decoder" desc="Identify technical terms and provide plain-English definitions" />
              <Toggle value={study.staged.retention_quiz_default} onChange={(v) => study.update({ retention_quiz_default: v })} label="🧩 Retention Quiz" desc="Include a retention quiz at the bottom of generated notes" />
              
              <Toggle value={study.staged.feynman_default} onChange={(v) => study.update({ feynman_default: v })} label="🧠 Feynman Technique" desc="Explain concepts in your own words at the end" />
              <Toggle value={study.staged.recall_prompts_default} onChange={(v) => study.update({ recall_prompts_default: v })} label="💭 Active Recall Prompts" desc="Insert retrieval practice questions at the end of every section" />
              <Toggle value={study.staged.simplify_default} onChange={(v) => study.update({ simplify_default: v })} label="✏️ Write This Down" desc="Provide specific guidance on what to record in your manual notes" />
              <Toggle value={study.staged.why_care_default} onChange={(v) => study.update({ why_care_default: v })} label="🔥 Real-World Hook" desc="Include a 'Why Should I Care?' section connecting topics to real life" />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Study Tool Defaults</p>
            <div className="space-y-1">
              <Toggle value={study.staged.mindmap_default} onChange={(v) => study.update({ mindmap_default: v })} label="🗺️ Mind Map" desc="Auto-include an interactive mind map when generating notes" />
              <Toggle value={study.staged.flowchart_default} onChange={(v) => study.update({ flowchart_default: v })} label="🔀 Process Flow" desc="Auto-include an interactive flow chart when generating notes" />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accessibility</p>
            <Toggle value={study.staged.safe_to_fail} onChange={(v) => study.update({ safe_to_fail: v })} label="Safe-to-Fail Mode" desc="Replace red X's with XP and gentle feedback in quizzes" />
            <Toggle value={study.staged.reduce_motion} onChange={(v) => study.update({ reduce_motion: v })} label="Reduce Motion" desc="Disable animations and transitions across the app" />
          </div>

          <SaveButton hasChanges={study.hasChanges} onSave={study.save} />
        </Section>

        {/* Audio */}
        <Section icon={Headphones} title="Audio" color="text-lavender-500">
          <Toggle value={audio.staged.lofi_enabled} onChange={(v) => audio.update({ lofi_enabled: v })} label="Lofi Background Music" desc="Play lofi hip-hop during study sessions" />
          <Toggle value={audio.staged.gamma_beats_enabled} onChange={(v) => audio.update({ gamma_beats_enabled: v })} label="Gamma Binaural Beats" desc="40Hz binaural beats for focus" />
          <Toggle value={audio.staged.isochronic_enabled} onChange={(v) => audio.update({ isochronic_enabled: v })} label="Isochronic Tones" desc="Pulsing single-channel tones for concentration" />

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Lofi YouTube Playlist URL</label>
            <input
              id="lofi-playlist-url"
              name="lofiPlaylistUrl"
              type="url"
              value={audio.staged.lofi_playlist_url}
              onChange={(e) => audio.update({ lofi_playlist_url: e.target.value })}
              placeholder="https://www.youtube.com/playlist?list=..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-lavender-300"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Isochronic Tone Frequency</label>
            <div className="flex gap-2 flex-wrap">
              {ISOCHRONIC_OPTIONS.map((opt) => (
                <button
                  key={opt.hz}
                  onClick={() => audio.update({ isochronic_hz: opt.hz })}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    audio.staged.isochronic_hz === opt.hz
                      ? "bg-sky-200 text-sky-700 ring-2 ring-sky-300 dark:bg-sky-300/20 dark:text-sky-200 dark:ring-sky-300/30"
                      : "bg-muted text-muted-foreground hover:bg-sky-100 dark:hover:bg-sky-300/10"
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[9px] opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "lofi_volume" as const, label: "Lofi", icon: Radio, color: "text-peach-500" },
              { key: "gamma_volume" as const, label: "Gamma", icon: Headphones, color: "text-lavender-500" },
              { key: "isochronic_volume" as const, label: "Isochronic", icon: Waves, color: "text-sky-300" },
            ]).map((item) => (
              <div key={item.key}>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <item.icon className={`h-3 w-3 ${item.color}`} /> {item.label}
                </label>
                <input
                  id={`audio-${item.key}`}
                  name={`audio-${item.key}`}
                  type="range" min="0" max="1" step="0.05"
                  value={audio.staged[item.key]}
                  onChange={(e) => audio.update({ [item.key]: parseFloat(e.target.value) } as any)}
                  className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer"
                />
                <span className="text-[10px] text-muted-foreground">{Math.round(Number(audio.staged[item.key]) * 100)}%</span>
              </div>
            ))}
          </div>
          <SaveButton hasChanges={audio.hasChanges} onSave={audio.save} />
        </Section>

        {/* Privacy & Data */}
        <Section icon={Lock} title="Privacy & Data" color="text-peach-500">
          <Toggle
            value={privacy.staged.insights_enabled}
            onChange={(v) => privacy.update({ insights_enabled: v })}
            label="Learning Insights"
            desc="Collect usage data to power your personal Growth Dashboard and Cognitive Mirror"
          />
          {privacy.staged.insights_enabled && (
            <Toggle
              value={privacy.staged.research_data_shared}
              onChange={(v) => privacy.update({ research_data_shared: v })}
              label="Share Data with Research"
              desc="Allow anonymized data to be viewed by the research team to improve the platform"
            />
          )}
          {!privacy.staged.insights_enabled && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
              ⚠️ With Insights disabled, no usage data will be collected. Your Growth Dashboard and Cognitive Mirror will not update.
            </p>
          )}
          <SaveButton hasChanges={privacy.hasChanges} onSave={privacy.save} />
        </Section>
      </div>
    </Layout>
  );
};

/* ── Reusable sub-components ── */

const Section = ({ icon: Icon, title, color, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color}`} /> {title}
    </h2>
    {children}
  </section>
);

const SaveButton = ({ hasChanges, onSave }: { hasChanges: boolean; onSave: () => void }) => (
  <div className="pt-2">
    <Button
      onClick={onSave}
      disabled={!hasChanges}
      size="sm"
      className={`gap-2 rounded-xl transition-all ${
        hasChanges
          ? "bg-sage-600 hover:bg-sage-700 text-white shadow-md shadow-sage-500/20 ring-2 ring-sage-400/30"
          : "bg-muted text-muted-foreground cursor-not-allowed"
      }`}
    >
      <Save className="h-3.5 w-3.5" />
      {hasChanges ? "Save Changes" : "All Saved"}
    </Button>
  </div>
);

const Toggle = ({ value, onChange, label, desc }: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) => (
  <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
    <div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </button>
  </div>
);

const FontSlider = ({ label, value, min, max, step, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <span className="text-xs text-foreground font-mono">{value.toFixed(2)}{unit || ""}</span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
    />
  </div>
);

export default Settings;
