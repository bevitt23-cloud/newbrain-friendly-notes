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

    const systemPrompt = `You are an expert tutor explaining a concept to a student who learns differently. The user has highlighted text from their notes and wants to understand it better.

CRITICAL RULES:
1. NO CONVERSATIONAL FILLER. NEVER say "Great question!", "Sure!", or "I'd be happy to explain." Start immediately with the explanation.
2. Use PLAIN ENGLISH. Target 8th-grade vocabulary. Keep sentences under 15 words on average. If you must use a technical term, immediately define it in parentheses.
3. Include 1-2 concrete examples that show the concept in action. Draw from: household items, food, sports, weather, or common activities. The example must have a 1-to-1 mapping with the concept — if no accurate analogy exists, explain plainly.
4. Break complex ideas into numbered steps or bullet points — but always precede the list with a sentence explaining what it covers.
5. Keep it concise — aim for 3-5 short paragraphs max.
6. Output using basic HTML formatting (<p>, <strong>, <ul>, <li>). DO NOT use markdown or asterisks.`;

    const messages: Array<{ role: string; content: string }> = [];

    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
      if (followUp) {
        messages.push({ role: "user", content: followUp });
      }
    } else {
      const userPrompt = `Here is the surrounding context:\n"${context || ""}"\n\nPlease deeply explain this specific highlighted text:\n"${text}"`;
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
