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

    const { topic, context, interests } = await req.json();

    if (!topic && !context && (!interests || interests.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Topic, context, or interests required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plainContext = context
      ? context.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)
      : "";

    const interestsList = Array.isArray(interests) && interests.length > 0 ? interests : null;
    const interestNote = interestsList
      ? `\nThe user has these special interests: ${interestsList.join(", ")}. The fun fact MUST relate to one or more of these interests. Pick a different interest each time for variety.`
      : "";

    const systemPrompt = `You are a fun fact generator for "Brain Flow Studio," an educational app for neurodivergent learners.

TASK: Generate ONE fascinating, surprising, or mind-blowing fun fact related to the topic provided.${interestNote}

RULES:
• The fact must be genuinely interesting and related to the subject matter or the user's interests.
• Keep it to 2-3 sentences maximum.
• Use warm, enthusiastic but not overwhelming language.
• The fact should spark curiosity and make the learner want to explore more.
• Include a specific detail — a number, a name, a date — that makes it memorable.
• Also provide a concise 3-5 word Google search query the user could use to learn more.

OUTPUT: A JSON object: {"fact": "...", "search_query": "..."}
Output ONLY valid JSON, no markdown fences.`;

    const userMessage = topic
      ? `Generate a fun fact about: ${topic}${plainContext ? `\n\nStudy context: ${plainContext.slice(0, 2000)}` : ""}`
      : `Generate a fun fact related to this study material:\n\n${plainContext}`;

    const result = await callAI({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 1024,
      jsonMode: true,
    });

    // Parse the AI output server-side so the client never deals with
    // raw JSON strings. Strip any stray markdown fences the model may
    // still emit despite jsonMode, then parse. Return a clean object.
    const cleaned = result.content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: { fact?: string; search_query?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("generate-fun-fact: JSON parse failed", parseErr, "raw:", cleaned);
      return new Response(
        JSON.stringify({ error: "AI did not return valid JSON. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fact = typeof parsed.fact === "string" ? parsed.fact.trim() : "";
    const searchQuery = typeof parsed.search_query === "string" ? parsed.search_query.trim() : "";
    if (!fact) {
      return new Response(
        JSON.stringify({ error: "AI returned an empty fact. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ fact, search_query: searchQuery }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-fun-fact error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("All AI models") ? 503 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
