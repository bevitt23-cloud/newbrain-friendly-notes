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

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","by","from","as","is","are","was","were","be","been","being",
  "this","that","these","those","it","its","their","they","them","there","here","which","who","whom","what","when","where","why","how",
  "we","us","our","you","your","he","she","his","her","i","me","my",
  "had","has","have","having","do","does","did","done","doing","can","could","should","would","may","might","must","will","shall",
  "also","just","only","very","more","most","such","some","any","all","each","every","other","another","than","then","so","not",
  "found","shown","showed","demonstrated","reported","studied","investigated","examined","observed","noted","reveals","revealed","suggests","suggested","indicates","indicated","appears","appeared","seems","seemed","like","including","such","with","without",
  "significant","significantly","increased","decreased","reduced","elevated","normalized","altered","affected","resulted","resulting","caused","causing","leading","led","produced","produces",
  "effect","effects","result","results","finding","findings","study","studies","research","analysis","data","level","levels","group","groups","subject","subjects",
]);

function looksLikeProse(query: string): boolean {
  const wordCount = query.trim().split(/\s+/).length;
  const hasMultipleSentences = (query.match(/[.!?]\s+[A-Z]/g) || []).length >= 1;
  const hasParentheticals = (query.match(/\([^)]{8,}\)/g) || []).length >= 1;
  return wordCount > 10 || hasMultipleSentences || hasParentheticals || ACADEMIC_NOISE.test(query);
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

/**
 * Strip common chatty AI wrappers that survive the system prompt:
 *   "Query: foo bar"
 *   "Search query: foo bar"
 *   "Here's the query: foo bar"
 *   "**foo bar**"
 *   "```\nfoo bar\n```"
 *   trailing commentary after a blank line
 */
function unwrapAIQuery(raw: string): string {
  let s = raw.trim();
  // Take only up to the first blank line (drop trailing commentary)
  s = s.split(/\n\s*\n/)[0].trim();
  // Strip code fences
  s = s.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // Strip "Query:" / "Search query:" / "Here's the query:" prefixes
  s = s.replace(/^(?:final\s+)?(?:youtube\s+)?(?:search\s+)?query\s*[:=]\s*/i, "");
  s = s.replace(/^(?:here(?:'|’)?s|here\s+is)\s+(?:the|a|your)\s+(?:search\s+)?query\s*[:.]\s*/i, "");
  s = s.replace(/^(?:answer|result|output)\s*[:=]\s*/i, "");
  // Strip a single line of leading/trailing markdown emphasis
  s = s.replace(/^\*\*(.+)\*\*$/, "$1").replace(/^\*(.+)\*$/, "$1");
  // Strip wrapping quotes/backticks
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  // Take only the first line if multi-line survives
  s = s.split(/\n/)[0].trim();
  return s;
}

/**
 * Heuristic keyword extraction for the fallback path. Picks the
 * most-distinctive content tokens (acronyms, hyphenated compounds,
 * capitalized terms, multi-syllable words) and skips common stopwords.
 * Used both when AI distillation fails AND as a "simpler retry" if
 * the first YouTube search returns 0 results.
 */
function extractKeyTerms(text: string, max: number = 6): string[] {
  const cleaned = heuristicCleanup(text);
  // Tokenize keeping hyphens and apostrophes inside words
  const tokens = cleaned.split(/[\s,.!?;:()"—]+/).filter(Boolean);

  type Scored = { token: string; score: number; idx: number };
  const scored: Scored[] = tokens.map((t, idx) => {
    const lower = t.toLowerCase();
    if (STOPWORDS.has(lower) || lower.length < 3) return { token: t, score: 0, idx };
    let score = 1;
    // Acronyms (all caps, 2-6 chars): high value (HPA, ACTH, DNA)
    if (/^[A-Z]{2,6}$/.test(t)) score += 6;
    // Hyphenated compounds (hypothalamic-pituitary-adrenal, magnesium-depleted): high
    else if (t.includes("-") && t.length >= 6) score += 4;
    // Capitalized non-sentence-start (proper nouns / technical terms)
    else if (/^[A-Z][a-z]+/.test(t) && idx > 0) score += 2;
    // Long words tend to be technical
    if (t.length >= 9) score += 1;
    if (t.length >= 12) score += 1;
    return { token: t, score, idx };
  }).filter((s) => s.score > 0);

  // Dedup case-insensitively, keep first occurrence
  const seen = new Set<string>();
  const deduped: Scored[] = [];
  for (const s of scored) {
    const key = s.token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  // Take top N by score, then sort back into original document order
  // (preserves natural noun-phrase grouping like "HPA axis")
  return deduped
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.token);
}

async function distillQuery(rawQuery: string): Promise<string> {
  const cleaned = heuristicCleanup(rawQuery);
  if (cleaned.split(/\s+/).length <= 8 && !ACADEMIC_NOISE.test(cleaned)) {
    return cleaned;
  }

  try {
    const result = await callAI({
      systemPrompt:
        `You convert academic prose into a short YouTube search query for a student looking for a visual explainer video.

Output STRICT JSON in this exact shape:
{"query": "<5-9 word search query>", "core_terms": "<2-4 word core concept only, no qualifier>"}

RULES for "query":
- 5 to 9 words total.
- Identify the central concept, mechanism, or system being described — NOT the study, its authors, or what the researchers did.
- Strip ALL author names, citations, year references, parenthetical asides, and filler verbs ("found that", "showed", "demonstrated", "reported").
- Append exactly ONE format qualifier at the end: "explained" (default), "step by step" (procedures/calculations), "animated" (biological/chemical/physical mechanisms), "diagram walkthrough" (anatomy/structures), or "visual explanation" (abstract theories).

RULES for "core_terms":
- 2 to 4 words. The naked concept name only — no qualifier, no verbs.
- Used as a fallback search if the full query returns nothing.

Output ONLY the JSON object. No preamble, no commentary, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: `Convert this passage into a YouTube search query and core terms:\n\n"""${rawQuery.slice(0, 2000)}"""`,
        },
      ],
      maxTokens: 200,
      jsonMode: true,
    });

    const raw = result.content || "";
    // First, try to parse as JSON (the structured path)
    try {
      const cleanedJson = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const start = cleanedJson.indexOf("{");
      const end = cleanedJson.lastIndexOf("}");
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(cleanedJson.slice(start, end + 1));
        if (typeof parsed.query === "string" && parsed.query.trim().length > 3) {
          const q = unwrapAIQuery(parsed.query);
          if (q && q.split(/\s+/).length >= 3 && q.length < 200) {
            return q;
          }
        }
      }
    } catch {
      // Fall through to plain-text unwrapping
    }

    // Plain-text fallback: unwrap chatty prefixes/fences
    const distilled = unwrapAIQuery(raw);
    if (distilled && distilled.split(/\s+/).length >= 3 && distilled.length < 200) {
      return distilled;
    }
  } catch (err) {
    console.warn("Query distillation via AI failed, falling back to keyword extraction:", err);
  }

  // Final fallback — extract top key terms heuristically and append "explained".
  const keyTerms = extractKeyTerms(rawQuery, 5);
  if (keyTerms.length > 0) {
    return keyTerms.join(" ") + " explained";
  }
  // Last resort: cleaned + truncate
  return cleaned.split(/\s+/).slice(0, 8).join(" ");
}

/**
 * If a query returned 0 results, try progressively simpler variations.
 * Strips qualifiers, then uses just the top 2-4 key terms.
 */
function buildRetryQuery(distilled: string, originalRaw: string): string | null {
  // Try 1: drop the trailing format qualifier
  const qualifier = /\s+(explained|animated|step by step|diagram walkthrough|visual explanation)\s*$/i;
  const withoutQualifier = distilled.replace(qualifier, "").trim();
  if (withoutQualifier && withoutQualifier !== distilled && withoutQualifier.split(/\s+/).length >= 2) {
    return withoutQualifier;
  }
  // Try 2: top 3 key terms from the original raw text
  const keyTerms = extractKeyTerms(originalRaw, 3);
  if (keyTerms.length >= 2) {
    return keyTerms.join(" ");
  }
  return null;
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

    // Helper: run an InnerTube search across all keys, return parsed videos
    // (or empty array if YouTube returns no matches, null if all keys failed)
    async function searchAndParse(q: string): Promise<{ videos: ReturnType<typeof parseVideoResults>; failed: boolean }> {
      let data: Record<string, unknown> | null = null;
      for (const key of keysToTry) {
        data = await tryInnerTubeSearch(key, q);
        if (data) {
          console.log(`InnerTube search ok via key ${key.substring(0, 12)}... for "${q}"`);
          break;
        }
      }
      if (!data) return { videos: [], failed: true };
      return { videos: parseVideoResults(data), failed: false };
    }

    // Attempt 1 — distilled query
    let attempt = await searchAndParse(searchQuery);
    let queryUsed = searchQuery;
    let queryAttempts: string[] = [searchQuery];

    if (attempt.failed) {
      return new Response(
        JSON.stringify({ error: "Could not fetch explainer videos right now. All API keys failed." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Attempt 2 — if 0 results, retry with a simpler query (no qualifier
    // or just the top key terms). Niche academic topics often need this.
    if (attempt.videos.length === 0) {
      const retryQuery = buildRetryQuery(searchQuery, normalizedQuery);
      if (retryQuery && retryQuery !== searchQuery) {
        console.log(`No results for "${searchQuery}" — retrying with "${retryQuery}"`);
        queryAttempts.push(retryQuery);
        attempt = await searchAndParse(retryQuery);
        if (!attempt.failed && attempt.videos.length > 0) {
          queryUsed = retryQuery;
        }
      }
    }

    // Attempt 3 — last resort: top 2 key terms only, no qualifier
    if (attempt.videos.length === 0) {
      const keyTerms = extractKeyTerms(normalizedQuery, 2);
      if (keyTerms.length >= 2) {
        const lastResort = keyTerms.join(" ");
        if (!queryAttempts.includes(lastResort)) {
          console.log(`Still no results — last-resort query: "${lastResort}"`);
          queryAttempts.push(lastResort);
          attempt = await searchAndParse(lastResort);
          if (!attempt.failed && attempt.videos.length > 0) {
            queryUsed = lastResort;
          }
        }
      }
    }

    const videos = attempt.videos.map((video, index) => ({
      ...video,
      rationale: buildRationale(queryUsed, video.title, video.duration, index),
    }));

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No explainer videos found for this topic. Try selecting a shorter, more specific phrase.",
          searchQuery: queryUsed,
          originalQuery: normalizedQuery,
          queryAttempts,
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
        searchQuery: queryUsed,
        originalQuery: normalizedQuery,
        queryAttempts,
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
