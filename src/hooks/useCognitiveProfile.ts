import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type CognitiveTrait,
  deriveProfileSettings,
  buildProfilePromptAppend,
  deriveTraitsFromAnswers,
  type ProfileSettings,
} from "@/lib/cognitiveRules";

export interface CognitiveProfile {
  traits: CognitiveTrait[];
  wizardAnswers: Record<string, number | number[]>;
  hyperFixation: string | null;
  hyperFixations: string[];
  wizardCompleted: boolean;
  settings: ProfileSettings;
  promptAppend: string;
  age: number | null;
  gender: string | null;
  region: string | null;
}

function parseHyperFixations(raw: string | null): string[] {
  if (!raw) return [];
  // Try JSON array first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === "string" && s.trim());
  } catch {}
  // Fallback: single string
  return raw.trim() ? [raw.trim()] : [];
}

const DEFAULT_PROFILE: CognitiveProfile = {
  traits: [],
  wizardAnswers: {},
  hyperFixation: null,
  hyperFixations: [],
  wizardCompleted: false,
  settings: deriveProfileSettings([]),
  promptAppend: "",
  age: null,
  gender: null,
  region: null,
};

export function useCognitiveProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CognitiveProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  // Load profile from DB
  useEffect(() => {
    if (!user) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("cognitive_profiles" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && !error) {
        const d = data as any;
        const traits = (d.traits || []) as CognitiveTrait[];
        const hfRaw = d.hyper_fixation || null;
        const hfList = parseHyperFixations(hfRaw);
        setProfile({
          traits,
          wizardAnswers: (d.wizard_answers || {}) as Record<string, number | number[]>,
          hyperFixation: hfList.length > 0 ? hfList[0] : hfRaw,
          hyperFixations: hfList,
          wizardCompleted: d.wizard_completed || false,
          settings: deriveProfileSettings(traits),
          promptAppend: buildProfilePromptAppend(traits, hfList[0] || hfRaw),
          age: d.age || null,
          gender: d.gender || null,
          region: d.region || null,
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Save profile to DB
  const saveProfile = useCallback(
    async (answers: Record<string, number | number[]>, hyperFixations?: string[], age?: number | null, demographics?: { gender?: string | null; region?: string | null }) => {
      if (!user) return;

      const traits = deriveTraitsFromAnswers(answers);
      // Store as JSON array string
      const hfString = hyperFixations && hyperFixations.length > 0 ? JSON.stringify(hyperFixations) : null;

      const payload: any = {
        user_id: user.id,
        traits,
        wizard_answers: answers,
        hyper_fixation: hfString,
        wizard_completed: true,
      };
      if (age !== undefined) payload.age = age;

      // Upsert core profile
      const { error } = await supabase
        .from("cognitive_profiles" as any)
        .upsert(payload, { onConflict: "user_id" });

      // Save demographics separately (columns may not exist if migration hasn't run)
      if (!error && demographics && (demographics.gender !== undefined || demographics.region !== undefined)) {
        const demoPayload: any = {};
        if (demographics.gender !== undefined) demoPayload.gender = demographics.gender;
        if (demographics.region !== undefined) demoPayload.region = demographics.region;
        try {
          await supabase
            .from("cognitive_profiles" as any)
            .update(demoPayload)
            .eq("user_id", user.id);
        } catch {
          // Demographics columns may not exist yet — non-critical
          console.warn("[Profile] Demographics save skipped — columns may not exist yet");
        }
      }

      if (!error) {
        const hfList = hyperFixations || [];
        setProfile({
          traits,
          wizardAnswers: answers,
          hyperFixation: hfList[0] || null,
          hyperFixations: hfList,
          wizardCompleted: true,
          settings: deriveProfileSettings(traits),
          promptAppend: buildProfilePromptAppend(traits, hfList[0] || null),
          age: age ?? null,
          gender: demographics?.gender ?? null,
          region: demographics?.region ?? null,
        });
      }
      return error;
    },
    [user]
  );

  return { profile, loading, saveProfile };
}
