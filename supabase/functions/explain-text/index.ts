import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIStream } from "../_shared/callAI.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse(corsHeaders);

    const { text, context } = await req.json();

    const systemPrompt = `You are an expert, highly factual academic tutor. The user has highlighted a specific concept from their notes and requested a deeper explanation ("Dive Deeper").

CRITICAL RULES:
1. NO CONVERSATIONAL FILLER. NEVER say "Great question!", "Sure!", "Here is an explanation," or "I'd be happy to explain."
2. Start immediately with the factual explanation. Do not waste the user's time.
3. Explain the concept clearly, providing an analogy or an example if helpful.
4. Output your response using basic HTML formatting (<p>, <strong>, <ul>, <li>) for maximum readability. DO NOT use markdown code fences.`;

    const userPrompt = `Here is the surrounding context:\n"${context}"\n\nPlease deeply explain this specific highlighted text:\n"${text}"`;

    const streamResult = await callAIStream({
      systemPrompt,
      messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      stream: true,
    });

    return new Response(streamResult.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});