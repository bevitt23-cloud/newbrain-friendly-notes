import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRationale, parseVideoResults } from "../_shared/youtubeSearchParser.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";
import { callAI } from "../_shared/callAI.ts";

// ─── Query distillation ──────────────────────────────────────────
// When a user highlights a long academic passage and asks for a
// video, the raw selection is far too long/noisy for YouTube search.
// We collapse it to a 5-10 word concept query before hitting
// InnerTube. Only triggered for queries that look like prose, not
// for the AI-generated inline "Watch Explainer" button queries
// which are already concise.

const ACADEMIC_NOISE = /\bet\s+al\.?\b|\bdoi:|\(\s*\d{4}\s*\)|\b\d{4}\)/i;

function looksLikeProse(query: string): boolean {
  const wordCount = query.trim().split(/\s+/).length;
  const hasMultipleSentences = (query.match(/[.!?]\s+[A-Z]/g) || []).length >= 1;
  const hasParentheticals = (query.match(/\([^)]{8,}\)/g) || []).length >= 1;
  return wordCount > 12 || hasMultipleSentences || hasParentheticals || ACADEMIC_NOISE.test(query);
}

function heuristicCleanup(query: string): string {
  return query
    // Strip citations: "(Smith et al., 2019)", "(Sartori, 2020)", "(2019)"
    .replace(/\([^)]*?(?:et\s+al\.?|\b\d{4})\b[^)]*?\)/gi, " ")
    // Strip parenthetical asides longer than a couple words
    .replace(/\([^)]{8,}\)/g, " ")
    // Strip "Author et al." constructs
    .replace(/\b[A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?\s+et\s+al\.?,?/gi, " ")
    // Strip "doi:..." tokens
    .replace(/\bdoi:\s*\S+/gi, " ")
    // Collapse whitespace and punctuation noise
    .replace(/[;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function distillQuery(rawQuery: string): Promise<string> {
  const cleaned = heuristicCleanup(rawQuery);
  // If after cleanup it's already short, skip the AI call.
  if (cleaned.split(/\s+/).length <= 10 && !ACADEMIC_NOISE.test(cleaned)) {
    return cleaned;
  }

  try {
    const result = await callAI({
      systemPrompt:
        `You convert long, citation-laden academic prose into a short YouTube search query for a student looking for a visual explainer video.\n\nRULES:\n- Output 5 to 9 words.\n- Identify the central concept or mechanism the passage is about, NOT the study or its authors.\n- Strip ALL author names, citations, year references, and parenthetical asides.\n- Strip filler verbs ("found that", "showed", "demonstrated").\n- Append exactly ONE format qualifier: "explained" (default), "step by step" (procedures/calculations), "animated" (biological/chemical/physical mechanisms), "diagram walkthrough" (anatomy/structures), or "visual explanation" (abstract theories).\n- Output ONLY the query string. No quotes, no preamble, no JSON.`,
      messages: [
        {
          role: "user",
          content: `Convert this passage into a YouTube search query:\n\n"""${rawQuery.slice(0, 2000)}"""`,
        },
      ],
      maxTokens: 80,
    });
    const distilled = (result.content || "").replace(/^["'`]+|["'`]+$/g, "").trim().split(/\n/)[0].trim();
    if (distilled && distilled.split(/\s+/).length >= 3 && distilled.length < 200) {
      return distilled;
    }
  } catch (err) {
    console.warn("Query distillation via AI failed, falling back to heuristic cleanup:", err);
  }

  // Fallback — heuristic cleanup, capped at 10 words.
  const words = cleaned.split(/\s+/).slice(0, 10);
  return words.join(" ");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known InnerTube API keys (YouTube embeds these publicly in its frontend)
const KNOWN_KEYS = [
  "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
  "AIzaSyDK3iBpDP9nHVTk2qL73FLJICfOC3c51Og",
];

/** Scrape the current InnerTube API key from YouTube's homepage. */
async function scrapeInnerTubeKey(): Promise<string | null> {
  try {
    const resp = await fetch("https://www.youtube.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    if (match?.[1]) {
      console.log("Scraped fresh InnerTube key:", match[1].substring(0, 12) + "...");
      return match[1];
    }
  } catch (err) {
    console.error("Failed to scrape InnerTube key:", err);
  }
  return null;
}

/** Try an InnerTube search with a given key. Returns the parsed JSON or null. */
async function tryInnerTubeSearch(
  key: string,
  query: string,
): Promise<Record<string, unknown> | null> {
  const searchUrl = `https://www.youtube.com/youtubei/v1/search?key=${key}`;
  const resp = await fetch(searchUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20260401.01.00",
          hl: "en",
          gl: "US",
        },
      },
      query,
      params: "EgIQAQ%3D%3D", // filter: videos only
    }),
  });

  if (!resp.ok) {
    console.error(`InnerTube search failed with key ${key.substring(0, 12)}...: ${resp.status}`);
    return null;
  }

  return resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse(corsHeaders);

    const { query } = await req.json();
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
      return new Response(JSON.stringify({ error: "Missing video search query." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Distill long / prose-shaped queries before hitting YouTube. The
    // AI-generated inline "Watch Explainer" button queries are already
    // 5-10 words, so this is a no-op for them. It mainly fires when the
    // user highlights an academic passage from their notes.
    const searchQuery = looksLikeProse(normalizedQuery)
      ? await distillQuery(normalizedQuery)
      : normalizedQuery;
    if (searchQuery !== normalizedQuery) {
      console.log(`Distilled video query: "${normalizedQuery.slice(0, 80)}..." → "${searchQuery}"`);
    }

    // Build list of keys to try: stored secret first, then scraped, then known keys
    const keysToTry: string[] = [];

    const storedKey = Deno.env.get("INNERTUBE_API_KEY");
    if (storedKey) keysToTry.push(storedKey);

    // Try to scrape the current key from YouTube
    const scrapedKey = await scrapeInnerTubeKey();
    if (scrapedKey && !keysToTry.includes(scrapedKey)) {
      keysToTry.push(scrapedKey);
    }

    // Add known fallback keys
    for (const k of KNOWN_KEYS) {
      if (!keysToTry.includes(k)) keysToTry.push(k);
    }

    if (keysToTry.length === 0) {
      return new Response(
        JSON.stringify({ error: "No YouTube API keys available." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Try each key until one works
    let data: Record<string, unknown> | null = null;
    for (const key of keysToTry) {
      data = await tryInnerTubeSearch(key, searchQuery);
      if (data) {
        console.log(`InnerTube search succeeded with key ${key.substring(0, 12)}...`);
        break;
      }
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Could not fetch explainer videos right now. All API keys failed." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const videos = parseVideoResults(data).map((video, index) => ({
      ...video,
      rationale: buildRationale(searchQuery, video.title, video.duration, index),
    }));

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No explainer videos found for this topic.",
          searchQuery,
          originalQuery: normalizedQuery,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        videos,
        searchQuery,
        originalQuery: normalizedQuery,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("search-youtube-videos error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
