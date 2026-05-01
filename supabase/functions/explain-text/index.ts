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

    const { text, context, followUp, chatHistory } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "No text provided to explain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isFollowUp = !!(chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 && followUp);

    // First-pass explanations require a TWO-PART structure: a layman's
    // "explain it like I'm 10" version FIRST, then the deeper textbook
    // explanation. Follow-up turns stay conversational — forcing the
    // dual structure on every reply would feel robotic.
    const initialPromptRules = `You are an expert tutor explaining a concept to a student who learns differently. The user has highlighted text from their notes and wants to understand it better.

YOUR RESPONSE MUST HAVE EXACTLY TWO SECTIONS, in this exact order, separated by a single blank line:

SECTION 1 — IN PLAIN TERMS (layman's version):
Start with this exact opening line on its own:
<p><strong>🧒 In Plain Terms</strong></p>
Then write 2-3 short sentences (under 12 words each) that an average 10-year-old would understand. Use one everyday analogy (cooking, weather, sports, animals, household objects). NO jargon. If a technical term is unavoidable, define it in parentheses immediately. This section is the "explain it like I'm 10" version — it should feel warm and demystifying.

SECTION 2 — DETAILED EXPLANATION:
Start with this exact opening line on its own:
<p><strong>🎓 Detailed Explanation</strong></p>
Then provide the deeper, accurate, technically complete explanation. Use proper terminology now (still defining anything unusual). Include 1-2 concrete worked examples. Use bullet points or numbered steps for multi-step processes — but always precede a list with a lead-in sentence. Aim for 2-4 short paragraphs.

CRITICAL RULES:
1. NO CONVERSATIONAL FILLER. NEVER say "Great question!", "Sure!", or "I'd be happy to explain." Begin immediately with Section 1.
2. The two sections are NON-NEGOTIABLE. Even for very simple concepts, emit both — make the layman version one short sentence if needed, but emit it.
3. Use PLAIN ENGLISH overall. Keep sentences in Section 2 under 18 words on average.
4. Output using basic HTML formatting (<p>, <strong>, <ul>, <li>, <em>). DO NOT use markdown or asterisks.
5. Separate Section 1 from Section 2 with a single blank line so the UI renders them as two distinct cards.`;

    const followUpPromptRules = `You are an expert tutor continuing a conversation with a student who learns differently. They have already received a structured explanation and are now asking a follow-up question.

CRITICAL RULES:
1. NO CONVERSATIONAL FILLER. NEVER say "Great question!", "Sure!", or "I'd be happy to explain." Start immediately with the answer.
2. Use PLAIN ENGLISH. Target 8th-grade vocabulary. Keep sentences under 18 words on average.
3. Be direct and conversational — this is a follow-up, not a fresh explanation, so do NOT re-emit the "In Plain Terms" / "Detailed Explanation" two-section structure.
4. If a concrete example helps, include one. Otherwise be concise.
5. Output using basic HTML formatting (<p>, <strong>, <ul>, <li>, <em>). DO NOT use markdown or asterisks.`;

    const systemPrompt = isFollowUp ? followUpPromptRules : initialPromptRules;

    const messages: Array<{ role: string; content: string }> = [];

    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
      if (followUp) {
        messages.push({ role: "user", content: followUp });
      }
    } else {
      const userPrompt = `Here is the surrounding context:\n"${context || ""}"\n\nPlease explain this specific highlighted text — first in plain terms (10-year-old level), then with full detail:\n"${text}"`;
      messages.push({ role: "user", content: userPrompt });
    }

    const result = await callAI({
      systemPrompt,
      messages,
      maxTokens: 2048,
    });

    return new Response(
      JSON.stringify({ explanation: result.content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("explain-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
