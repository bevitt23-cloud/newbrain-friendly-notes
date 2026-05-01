import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/callAI.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse(corsHeaders);

    const { notesHtml, age, learningMode, energyMode, profilePrompt } = await req.json();

    if (!notesHtml) {
      return new Response(
        JSON.stringify({ error: "Notes content required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plainText = notesHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);

    if (plainText.length < 20) {
      return new Response(
        JSON.stringify({ error: "Notes content too short to generate quiz" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let ageInstruction = "";
    if (age && typeof age === "number") {
      if (age < 10) ageInstruction = "Use very simple language appropriate for a young child.";
      else if (age < 13) ageInstruction = "Use clear language appropriate for a middle schooler.";
      else if (age < 18) ageInstruction = "Use language appropriate for a teenager.";
    }

    // Adapt question count + tone to energy + learning mode + profile.
    const isLowBattery = energyMode === "low";
    const energyInstruction = isLowBattery
      ? "LOW BATTERY MODE: Generate only 3-5 questions (not 5-10). Keep questions short and direct. Skip application questions — stick to factual + conceptual."
      : "";

    const lm = typeof learningMode === "string" ? learningMode.toLowerCase() : "";
    const learningModeInstruction =
      lm === "dyslexia"
        ? "DYSLEXIA MODE: Keep every question and every answer option under 15 words. No long compound sentences. Plain language only."
        : lm === "adhd"
          ? "ADHD MODE: Keep questions punchy and concrete. Lead with the most engaging detail. Avoid filler phrasing."
          : "";

    const profileLower = typeof profilePrompt === "string" ? profilePrompt.toLowerCase() : "";
    const profileInstructions: string[] = [];
    if (profileLower.includes("rsd") || profileLower.includes("rejection sensitive")) {
      profileInstructions.push(
        "RSD ADAPTATION: Never use the words 'wrong', 'incorrect', or 'failed' anywhere in the questions or explanations. Frame every wrong-answer explanation as a stepping stone — start with what the student likely was thinking, then redirect."
      );
    }
    if (profileLower.includes("demand avoidant") || profileLower.includes("pathological demand")) {
      profileInstructions.push(
        "DEMAND-AVOIDANT ADAPTATION: Avoid pressure language ('you must', 'obviously', 'of course'). Use invitational framing for question stems."
      );
    }
    if (profileLower.includes("dyscalculia") && /\b(\d+%|\d+\.\d+|\d+\s*\/\s*\d+)/.test(plainText)) {
      profileInstructions.push(
        "DYSCALCULIA ADAPTATION: For any question involving a number, percentage, or ratio, include a real-world size analogy in the correct-answer explanation."
      );
    }

    const systemPrompt = `You are a quiz generator for "Brain Flow Studio," an educational app for neurodivergent learners.

TASK: Generate 5-10 multiple choice retention quiz questions based on the study notes provided.

RULES:
• Generate one question per major section heading in the notes. "Key concepts" = terms in bold or headers.
• Question type distribution: 40% factual recall (can the student remember this fact?), 40% conceptual understanding (can the student explain why?), 20% application (can the student apply this to a new scenario?). Order: factual first, then conceptual, then application.
• Each question has exactly 4 answer options (A-D). Only one is correct.
• Wrong options must be plausible but clearly wrong — not trick questions.
• Provide a brief, encouraging explanation for the correct answer (1-2 sentences).
• For wrong answers, explanations should be supportive — frame mistakes as learning moments, never say "wrong" or "incorrect."
• Questions should progress from easier to harder within each type.
${ageInstruction ? `• ${ageInstruction}` : ""}
${energyInstruction ? `• ${energyInstruction}` : ""}
${learningModeInstruction ? `• ${learningModeInstruction}` : ""}
${profileInstructions.map((p) => `• ${p}`).join("\n")}

OUTPUT: A JSON array of question objects:
[
  {
    "question": "...",
    "options": ["A answer", "B answer", "C answer", "D answer"],
    "correct": 0,
    "explanation": "..."
  }
]

"correct" is the 0-based index of the right answer.
Output ONLY valid JSON, no markdown fences, no extra text. Do NOT ask for more information — use whatever content is provided.`;

    const userMessage = `Generate a retention quiz based on these study notes. You MUST return a non-empty JSON array of question objects. Do NOT return an empty array.\n\n${plainText}`;

    let questions: any[] = [];
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await callAI({
        systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 4096,
      });

      const content = result.content;
      console.log(`[Quiz] Attempt ${attempt + 1}, raw length: ${content.length}, preview: ${content.slice(0, 200)}`);

      try {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const arrStart = cleaned.indexOf("[");
        const arrEnd = cleaned.lastIndexOf("]");
        if (arrStart === -1 || arrEnd === -1 || arrEnd <= arrStart) throw new Error("No JSON array found");
        cleaned = cleaned.substring(arrStart, arrEnd + 1);
        // eslint-disable-next-line no-control-regex
        cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error("Not an array");
        questions = parsed.filter((q: any) =>
          q && typeof q.question === "string" &&
          Array.isArray(q.options) && q.options.length >= 2 &&
          typeof q.correct === "number"
        );
        if (questions.length > 0) break;
        console.warn(`[Quiz] Attempt ${attempt + 1} returned empty/invalid questions`);
      } catch (parseErr) {
        console.error(`[Quiz] Attempt ${attempt + 1} parse failed:`, parseErr, "Raw:", content.slice(0, 500));
      }
    }

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not generate quiz questions. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-retention-quiz error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("All AI models") ? 503 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
