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

    const { notesHtml, age } = await req.json();

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

    const systemPrompt = `You are a quiz generator for "Brain Flow Studio," an educational app for neurodivergent learners.

TASK: Generate 5-10 multiple choice retention quiz questions based on the study notes provided.

RULES:
• Questions should test understanding and retention of key concepts from the notes.
• Each question has exactly 4 answer options (A-D).
• Only one answer is correct per question.
• Provide a brief, encouraging explanation for the correct answer.
• For wrong answers, explanations should be supportive — frame mistakes as learning moments.
• Questions should progress from easier to harder.
• Vary question types: factual recall, conceptual understanding, application.
${ageInstruction ? `• ${ageInstruction}` : ""}

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
