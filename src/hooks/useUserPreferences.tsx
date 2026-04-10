import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FunFactMode = "material" | "special_interest" | "custom";

export interface UserPreferences {
  energy_mode: string;
  lofi_playlist_url: string;
  isochronic_hz: number;
  gamma_beats_enabled: boolean;
  isochronic_enabled: boolean;
  lofi_enabled: boolean;
  lofi_volume: number;
  gamma_volume: number;
  isochronic_volume: number;
  reduce_motion: boolean;
  bionic_reading: boolean;
  safe_to_fail: boolean;
  research_data_shared: boolean;
  insights_enabled: boolean;
  dyslexia_font: boolean;
  adhd_font: boolean;
  font_size: number;
  line_spacing: number;
  letter_spacing: number;
  word_spacing: number;
  default_dark_mode: boolean;
  dopamine_rewards: boolean;
  fun_fact_mode: FunFactMode;
  fun_fact_custom_topic: string;
  retention_quiz_default: boolean;
  tldr_default: boolean;
  jargon_default: boolean;
  feynman_default: boolean;
  recall_prompts_default: boolean;
  simplify_default: boolean;
  why_care_default: boolean;
  mindmap_default: boolean;
  flowchart_default: boolean;
  tutorial_dismissed: boolean;
}

const DEFAULTS: UserPreferences = {
  energy_mode: "full",
  lofi_playlist_url: "https://www.youtube.com/watch?v=sF80I-TQiW0",
  isochronic_hz: 15,
  gamma_beats_enabled: true,
  isochronic_enabled: true,
  lofi_enabled: true,
  lofi_volume: 0.5,
  gamma_volume: 0.4,
  isochronic_volume: 0.3,
  reduce_motion: false,
  bionic_reading: false,
  safe_to_fail: false,
  research_data_shared: true,
  insights_enabled: true,
  dyslexia_font: false,
  adhd_font: true,
  font_size: 0.95,
  line_spacing: 1.6,
  letter_spacing: 0,
  word_spacing: 0,
  default_dark_mode: false,
  dopamine_rewards: true,
  fun_fact_mode: "material",
  fun_fact_custom_topic: "",
  retention_quiz_default: true,
  tldr_default: true,
  jargon_default: true,
  feynman_default: true,
  recall_prompts_default: true,
  simplify_default: true,
  why_care_default: true,
  mindmap_default: false,
  flowchart_default: false,
  tutorial_dismissed: false,
};

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  preferences: DEFAULTS,
  loading: true,
  updatePreferences: async () => {},
});

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (prevUserIdRef.current && preferences.fun_fact_custom_topic) {
        supabase
          .from("user_preferences" as any)
          .update({ fun_fact_custom_topic: null, fun_fact_mode: "material" } as any)
          .eq("user_id", prevUserIdRef.current);
      }
      prevUserIdRef.current = null;
      setPreferences(DEFAULTS);
      setLoading(false);
      return;
    }
    prevUserIdRef.current = user.id;

    const load = async () => {
      const { data, error } = await supabase
        .from("user_preferences" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && !error) {
        const d = data as any;
        setPreferences({
          energy_mode: d.energy_mode || "full",
          lofi_playlist_url: d.lofi_playlist_url || DEFAULTS.lofi_playlist_url,
          isochronic_hz: d.isochronic_hz || 15,
          gamma_beats_enabled: d.gamma_beats_enabled ?? true,
          isochronic_enabled: d.isochronic_enabled ?? true,
          lofi_enabled: d.lofi_enabled ?? true,
          lofi_volume: Number(d.lofi_volume) || 0.5,
          gamma_volume: Number(d.gamma_volume) || 0.4,
          isochronic_volume: Number(d.isochronic_volume) || 0.3,
          reduce_motion: d.reduce_motion ?? false,
          bionic_reading: d.bionic_reading ?? false,
          safe_to_fail: d.safe_to_fail ?? false,
          research_data_shared: d.research_data_shared ?? true,
          insights_enabled: d.insights_enabled ?? true,
          dyslexia_font: d.dyslexia_font ?? false,
          adhd_font: d.adhd_font ?? (localStorage.getItem("bfn:adhd_font") !== null ? localStorage.getItem("bfn:adhd_font") === "true" : true),
          font_size: Number(d.font_size) || 0.95,
          line_spacing: Number(d.line_spacing) || 1.6,
          letter_spacing: Number(d.letter_spacing) || 0,
          word_spacing: Number(d.word_spacing) || 0,
          default_dark_mode: d.default_dark_mode ?? false,
          dopamine_rewards: d.dopamine_rewards ?? true,
          fun_fact_mode: d.fun_fact_mode || "material",
          fun_fact_custom_topic: d.fun_fact_custom_topic || "",
          retention_quiz_default: d.retention_quiz_default ?? true,
          
          tldr_default: d.tldr_default ?? true,
          jargon_default: d.jargon_default ?? true,
          feynman_default: d.feynman_default ?? true,
          recall_prompts_default: d.recall_prompts_default ?? true,
          simplify_default: d.simplify_default ?? true,
          why_care_default: d.why_care_default ?? true,
          mindmap_default: d.mindmap_default ?? false,
          flowchart_default: d.flowchart_default ?? false,
          tutorial_dismissed: d.tutorial_dismissed ?? false,
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      // Use functional updater to avoid stale-closure issues when
      // multiple calls happen before React re-renders.
      let newPrefs!: UserPreferences;
      setPreferences((prev) => {
        newPrefs = { ...prev, ...updates };
        return newPrefs;
      });

      // Persist adhd_font to localStorage (not in DB schema)
      if ("adhd_font" in updates || "dyslexia_font" in updates) {
        localStorage.setItem("bfn:adhd_font", String(newPrefs.adhd_font));
      }

      if (!user) return;

      // Strip client-only fields that don't exist in the DB schema
      const { adhd_font, ...dbPayload } = newPrefs;
      await supabase
        .from("user_preferences" as any)
        .upsert({ user_id: user.id, ...dbPayload } as any, { onConflict: "user_id" });
    },
    [user]
  );

  return (
    <UserPreferencesContext.Provider value={{ preferences, loading, updatePreferences }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}
