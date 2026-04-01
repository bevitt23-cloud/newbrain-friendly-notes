import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIStream } from "../_shared/callAI.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getYouTubeVideoId(url: string): string | null {
  const cleanId = (candidate?: string | null): string | null => {
    if (!candidate) return null;
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    // YouTube IDs are usually 11 chars, but allow a slightly wider safe range.
    return /^[A-Za-z0-9_-]{6,}$/.test(trimmed) ? trimmed : null;
  };

  const raw = (url || "").trim();
  if (!raw) return null;

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") {
      return cleanId(segments[0]);
    }

    if (host === "youtube.com" || host === "music.youtube.com") {
      if (segments[0] === "watch") {
        return cleanId(parsed.searchParams.get("v"));
      }
      if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
        return cleanId(segments[1]);
      }
    }
  } catch {
    // Fall through to regex fallback for malformed but salvageable input.
  }

  const patterns = [
    /(?:youtube\.com\/watch\?[^\s]*[?&]v=)([^&\s]+)/i,
    /(?:youtu\.be\/)([^?\s]+)/i,
    /(?:youtube\.com\/(?:embed|shorts|live)\/)([^?\s]+)/i,
  ];

  for (const p of patterns) {
    const m = raw.match(p);
    const id = cleanId(m?.[1]);
    if (id) return id;
  }

  return null;
}

function normalizeWebsiteUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw || /\s/.test(raw)) return null;

  const unwrapCandidate = (value: string): string => {
    const redirectKeys = [
      "url",
      "u",
      "target",
      "dest",
      "destination",
      "redirect",
      "redirect_url",
      "redirectUri",
      "redirect_uri",
      "redirectTo",
      "redirect_to",
      "to",
      "out",
      "next",
      "link",
      "source",
      "source_url",
      "article",
      "article_url",
      "articleUrl",
    ];

    let current = value;
    for (let depth = 0; depth < 3; depth += 1) {
      try {
        const parsed = new URL(/^https?:\/\//i.test(current) ? current : `https://${current}`);
        const nested = redirectKeys
          .map((key) => parsed.searchParams.get(key))
          .find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
        if (!nested) return current;
        current = nested;
        continue;
      } catch {
        try {
          const decoded = decodeURIComponent(current);
          if (decoded === current) return current;
          current = decoded;
          continue;
        } catch {
          return current;
        }
      }
    }
    return current;
  };

  const candidate = unwrapCandidate(raw).trim();
  if (!candidate || !/[.:/]/.test(candidate)) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname) return null;
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function callInnerTubePlayer(
  videoId: string,
  clientName: string,
  clientVersion: string,
  apiKey: string,
  scrapingBeeKey?: string,
): Promise<any | null> {
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  const playerBody = JSON.stringify({
    context: { client: { clientName, clientVersion } },
    videoId,
  });

  try {
    if (scrapingBeeKey) {
      console.log(`Calling InnerTube (${clientName}) via ScrapingBee for video: ${videoId}`);
      const proxyUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(playerUrl)}&render_js=false&premium_proxy=true&forward_headers=true`;
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Spb-Forward-Headers": "Content-Type" },
        body: playerBody,
      });
      if (!resp.ok) {
        console.error(`ScrapingBee InnerTube (${clientName}) failed: ${resp.status}`);
        return null;
      }
      return await resp.json();
    } else {
      console.log(`Calling InnerTube (${clientName}) directly for video: ${videoId}`);
      const resp = await fetch(playerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: playerBody,
      });
      if (!resp.ok) {
        console.error(`InnerTube (${clientName}) failed: ${resp.status}`);
        return null;
      }
      return await resp.json();
    }
  } catch (err) {
    console.error(`InnerTube (${clientName}) error:`, err);
    return null;
  }
}

function extractCaptionsFromPlayer(playerData: any): string | null {
  if (!playerData) return null;
  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) return null;
  const englishTrack = captionTracks.find(
    (t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en")
  );
  return (englishTrack || captionTracks[0])?.baseUrl || null;
}

async function fetchCaptionText(captionUrl: string): Promise<string[]> {
  const captionResp = await fetch(captionUrl);
  if (!captionResp.ok) {
    console.error("Caption fetch failed:", captionResp.status);
    return [];
  }
  const captionXml = await captionResp.text();
  if (!captionXml || captionXml.length === 0) return [];

  const textSegments: string[] = [];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = textRegex.exec(captionXml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim();
    if (text) textSegments.push(text);
  }
  return textSegments;
}

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
    return match?.[1] || null;
  } catch {
    return null;
  }
}

// Known InnerTube API keys (publicly embedded in YouTube's frontend)
const KNOWN_INNERTUBE_KEYS = [
  "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
  "AIzaSyDK3iBpDP9nHVTk2qL73FLJICfOC3c51Og",
];

/** Gather all available InnerTube keys in priority order. */
async function getInnerTubeKeys(): Promise<string[]> {
  const keys: string[] = [];
  const stored = Deno.env.get("INNERTUBE_API_KEY");
  if (stored) keys.push(stored);

  const scraped = await scrapeInnerTubeKey();
  if (scraped && !keys.includes(scraped)) keys.push(scraped);

  for (const k of KNOWN_INNERTUBE_KEYS) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

async function fetchYouTubeTranscript(videoId: string, scrapingBeeKey?: string): Promise<string | null> {
  const apiKeys = await getInnerTubeKeys();
  if (apiKeys.length === 0) {
    console.error("No InnerTube API keys available");
    return null;
  }

  // Try multiple InnerTube client types — some videos only serve captions to certain clients
  const clients: Array<{ name: string; version: string }> = [
    { name: "WEB", version: "2.20260401.01.00" },
    { name: "ANDROID", version: "20.14.38" },
    { name: "IOS", version: "20.14.4" },
  ];

  // Try each key × each client combination
  for (const apiKey of apiKeys) {
    for (const client of clients) {
      try {
        const playerData = await callInnerTubePlayer(videoId, client.name, client.version, apiKey, scrapingBeeKey);
        if (!playerData) continue;

        const videoTitle = playerData?.videoDetails?.title || "";
        const captionUrl = extractCaptionsFromPlayer(playerData);

        if (!captionUrl) {
          console.log(`No captions from ${client.name} (key ${apiKey.substring(0, 12)}...) for video: ${videoId}`);
          continue;
        }

        console.log(`Found captions via ${client.name} (key ${apiKey.substring(0, 12)}...) for "${videoTitle}"`);
        const segments = await fetchCaptionText(captionUrl);

        if (segments.length === 0) {
          console.error(`Caption XML from ${client.name} had no text segments`);
          continue;
        }

        const transcript = segments.join(" ");
        console.log(`Fetched transcript for "${videoTitle}" (${transcript.length} chars, ${segments.length} segments)`);
        return `Video Title: ${videoTitle}\n\nTranscript:\n${transcript}`;
      } catch (err) {
        console.error(`Error with ${client.name} (key ${apiKey.substring(0, 12)}...):`, err);
      }
    }
  }

  // Also try direct call (no proxy) if ScrapingBee was used above and all clients failed
  if (scrapingBeeKey) {
    console.log("All proxied clients failed, trying direct calls as last resort");
    for (const apiKey of apiKeys) {
      for (const client of clients) {
        try {
          const playerData = await callInnerTubePlayer(videoId, client.name, client.version, apiKey);
          if (!playerData) continue;

          const videoTitle = playerData?.videoDetails?.title || "";
          const captionUrl = extractCaptionsFromPlayer(playerData);
          if (!captionUrl) continue;

          const segments = await fetchCaptionText(captionUrl);
          if (segments.length === 0) continue;

          const transcript = segments.join(" ");
          console.log(`Fetched transcript (direct, ${client.name}) for "${videoTitle}" (${transcript.length} chars)`);
          return `Video Title: ${videoTitle}\n\nTranscript:\n${transcript}`;
        } catch (err) {
          console.error(`Direct ${client.name} error:`, err);
        }
      }
    }
  }

  // All exhausted — check if video exists but has no captions
  console.log("All InnerTube clients exhausted for video:", videoId);
  const checkData = await callInnerTubePlayer(videoId, "WEB", "2.20260401.01.00", apiKeys[0]);
  if (checkData?.videoDetails) {
    return "NO_CAPTIONS";
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse(corsHeaders);

    const body = await req.json();
    const { textContent, youtubeUrl, websiteUrl, learningMode, extras, instructions, profilePrompt, age } = body;

    const contentParts: any[] = [];

    // Handle YouTube URL
    if (youtubeUrl) {
      const videoId = getYouTubeVideoId(youtubeUrl);
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: "Invalid YouTube URL format. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, and m.youtube.com links." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let transcript: string | null = null;
      try {
        const SCRAPINGBEE_KEY = Deno.env.get("SCRAPINGBEE_API_KEY");
        transcript = await fetchYouTubeTranscript(videoId, SCRAPINGBEE_KEY || undefined);
      } catch (err) {
        console.error("YouTube transcript fetch threw:", err);
        return new Response(
          JSON.stringify({ error: "Could not retrieve captions. The video may not have subtitles enabled, or is age-restricted." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (transcript && transcript !== "NO_CAPTIONS") {
        contentParts.push({
          type: "text",
          text: `--- YouTube Video Transcript ---\n${transcript}`,
        });
      } else if (transcript === "NO_CAPTIONS") {
        return new Response(
          JSON.stringify({ error: "This video doesn't have captions/subtitles enabled. To generate notes from a video, it needs to have closed captions turned on. Try a different video or paste the content as text instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // transcript is null — API failure, not "no captions"
        // Don't try scraping YouTube page — it always returns JS boilerplate
        const hasKey = !!Deno.env.get("INNERTUBE_API_KEY");
        console.error(`YouTube transcript extraction failed for ${videoId}. INNERTUBE_API_KEY configured: ${hasKey}`);
        return new Response(
          JSON.stringify({
            error: hasKey
              ? "Could not retrieve the transcript from this video. The YouTube API may be temporarily unavailable. Please try again in a moment, or paste the content as text instead."
              : "YouTube transcript extraction is not configured. Please contact support or paste the content as text instead.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle website URL
    if (websiteUrl && typeof websiteUrl === "string" && websiteUrl.trim()) {
      const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
      if (!normalizedWebsiteUrl) {
        return new Response(
          JSON.stringify({ error: "Invalid website URL. Paste a full article URL, including the domain name." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY");
      if (!SCRAPINGBEE_API_KEY) {
        console.error("SCRAPINGBEE_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "Website scraping is not configured. Please paste the content as text instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Selectors for academic, blog, and news article content
        const contentSelectors = "article, main, [class*='article'], [class*='post'], [class*='content'], [id*='content'], [class*='entry'], [class*='body'], .page-content, #core, .text, [role='main'], .prose, [class*='narrative'], .pmc-content, .ncbi-content";
        const extractRules = JSON.stringify({ content: contentSelectors });
        const bodyFallbackRules = JSON.stringify({ body: "body" });
        const scrapeTrace: Array<{ mode: string; bodyFallback: boolean; status: number; textLength: number }> = [];

        type ScrapeMode = "stealth" | "google_bot" | "no_js";

        const buildScrapeUrl = (mode: ScrapeMode, useBodyFallback = false) => {
          const params = new URLSearchParams({
            api_key: SCRAPINGBEE_API_KEY,
            url: normalizedWebsiteUrl,
            premium_proxy: "true",
            stealth_proxy: mode === "stealth" ? "true" : "false",
            render_js: mode === "no_js" ? "false" : "true",
            wait: mode === "no_js" ? "0" : "5000",
            wait_for: mode === "no_js" ? "" : "body",
            block_resources: "false",
            country_code: "us",
            extract_rules: useBodyFallback ? bodyFallbackRules : extractRules,
          });
          if (mode === "google_bot") {
            params.set("custom_google", "true");
          }
          if (mode === "no_js") {
            params.delete("wait_for");
          }
          return `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
        };

        const scrapeHeaders: Record<string, string> = {
          "Spb-Referer": "https://www.google.com/",
        };

        const extractText = (data: Record<string, unknown>): string => {
          if (typeof data.content === "string" && data.content.trim().length > 200) return data.content;
          if (typeof data.body === "string" && data.body.trim().length > 200) return data.body;
          if (typeof data.text === "string" && data.text.trim().length > 200) return data.text;
          return "";
        };

        const BLOCKED_STATUSES = new Set([401, 403, 407, 429, 503, 520, 521, 522, 523, 524]);

        const attemptScrape = async (mode: ScrapeMode, useBodyFallback = false): Promise<Response> => {
          console.log(`Scraping ${normalizedWebsiteUrl} (mode=${mode}, bodyFallback=${useBodyFallback})`);
          return fetch(buildScrapeUrl(mode, useBodyFallback), { headers: scrapeHeaders });
        };

        const recordAttempt = (mode: ScrapeMode, bodyFallback: boolean, status: number, textLength: number) => {
          scrapeTrace.push({ mode, bodyFallback, status, textLength });
        };

        try {
          // Attempt 1: stealth proxy + JS rendering (best for paywalls / bot-protected sites)
          let scrapeResp = await attemptScrape("stealth");
          let pageText = "";

          if (scrapeResp.ok) {
            const data = await scrapeResp.json();
            pageText = extractText(data);
          }
          recordAttempt("stealth", false, scrapeResp.status, pageText.length);

          // Attempt 2: Google-bot loophole (many paywalls allow Googlebot for SEO)
          if (!scrapeResp.ok || pageText.length < 200) {
            console.warn(`Attempt 1 insufficient (status=${scrapeResp.status}, len=${pageText.length}), trying Google-bot mode...`);
            scrapeResp = await attemptScrape("google_bot");
            if (scrapeResp.ok) {
              const data = await scrapeResp.json();
              pageText = extractText(data);
            }
            recordAttempt("google_bot", false, scrapeResp.status, pageText.length);
          }

          // Attempt 3: no JS (some sites detect and block headless browsers)
          if (!scrapeResp.ok || pageText.length < 200) {
            console.warn(`Attempt 2 insufficient (status=${scrapeResp.status}, len=${pageText.length}), trying no-JS mode...`);
            scrapeResp = await attemptScrape("no_js");
            if (scrapeResp.ok) {
              const data = await scrapeResp.json();
              pageText = extractText(data);
            }
            recordAttempt("no_js", false, scrapeResp.status, pageText.length);
          }

          // Attempt 4: stealth + full body fallback (content selectors may have matched nothing)
          if (!scrapeResp.ok || pageText.length < 200) {
            console.warn(`Attempt 3 insufficient, trying stealth + full body fallback...`);
            scrapeResp = await attemptScrape("stealth", true);
            if (scrapeResp.ok) {
              const data = await scrapeResp.json();
              pageText = extractText(data);
            }
            recordAttempt("stealth", true, scrapeResp.status, pageText.length);
          }

          if (!scrapeResp.ok || pageText.length < 200) {
            const status = scrapeResp.status;
            console.error(`All ScrapingBee attempts failed for ${normalizedWebsiteUrl}. Final status: ${status}, content length: ${pageText.length}`, scrapeTrace);
            const isHardBlock = BLOCKED_STATUSES.has(status);
            contentParts.push({
              type: "text",
              text: isHardBlock
                ? `This page at ${normalizedWebsiteUrl} is behind a high-security paywall or firewall that could not be bypassed. Please copy and paste the article text directly instead.`
                : `Could not extract readable content from ${normalizedWebsiteUrl} (status ${status}). The page may require a login, subscription, or is behind a bot-check. Try pasting the text directly.`,
            });
          } else {
            const trimmed = pageText.slice(0, 100000);
            console.log(`Successfully scraped ${normalizedWebsiteUrl}: ${trimmed.length} chars`, scrapeTrace);
            contentParts.push({
              type: "text",
              text: `--- Content scraped from ${normalizedWebsiteUrl} ---\n${trimmed}`,
            });
          }
        } catch (err) {
          console.error("ScrapingBee fetch error:", err);
          contentParts.push({
            type: "text",
            text: `Failed to scrape ${normalizedWebsiteUrl}: ${err instanceof Error ? err.message : "Unknown error"}. Please paste the content as text instead.`,
          });
        }
      }
    }

    // Handle plain text content
    if (textContent && typeof textContent === "string" && textContent.trim()) {
      const trimmed = textContent.slice(0, 100000);
      contentParts.push({
        type: "text",
        text: `--- Pasted text content ---\n${trimmed}`,
      });
    }

    // Check if website scraping failed and no other content was provided
    if (
      websiteUrl &&
      contentParts.length === 1 &&
      contentParts[0].text &&
      (
        contentParts[0].text.includes("Failed to scrape") ||
        contentParts[0].text.includes("protected by") ||
        contentParts[0].text.includes("not accessible") ||
        contentParts[0].text.includes("Could not extract readable content")
      )
    ) {
      return new Response(
        JSON.stringify({ error: contentParts[0].text || "Could not retrieve content from the provided URL. Please try pasting the content as text instead." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (contentParts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const EXTRAS_PROMPTS: Record<string, string> = {
      tldr: `You must begin the response with a 'Bottom-Line Up Front' (BLUF) summary. Condense the entire topic into exactly one or two highly impactful sentences that state the ultimate conclusion or primary mechanism. Place this at the very top under the heading 'TL;DR:'.`,
      feynman: `At the very end of all notes, include a 'Feynman Check' section wrapped in <div class="feynman-check" data-section="feynman">. Include a prompt asking the user to explain the core concept in their own words. Add a <textarea class="feynman-input" placeholder="Explain it in your own words..." rows="4"></textarea> and a <button class="feynman-submit">Check My Understanding</button>. Also include a hidden <div class="feynman-key" style="display:none"> containing 3-5 key points the user should have covered, each as a <div class="feynman-point" data-concept="SHORT_LABEL">explanation</div>.`,
      recall: `CRITICAL PLACEMENT RULE: At the VERY END of EACH <section>, AFTER all content (paragraphs, lists, sub-sections, write-this-down boxes), insert a recall prompt as the LAST child element before the closing </section> tag. The recall prompt MUST come AFTER the section content so the user reads the material first — placing it at the top defeats the purpose of retrieval practice. Wrap in <div class="recall-prompt" data-section-index="N"> (where N is the section number starting from 1). Include a brief open-ended question about that section's key concept. Add a <textarea class="recall-input" placeholder="What do you remember?" rows="3"></textarea> and a <button class="recall-submit">Check</button>. Include a hidden <div class="recall-key" style="display:none">the correct key points for this section</div>. Make questions force retrieval, not recognition.`,
      simplify: `Inside EACH <section>, at the end, include a <div class="write-this-down"><strong>✍️ Write This Down:</strong> <p>A 1-2 sentence guidance telling the user exactly what to note from this section and how to summarize it in their own words. Be specific about what concept to capture.</p></div>`,
      why_care: `Write a highly engaging introductory paragraph connecting the academic topic directly to the student's real life. Explicitly explain how mastering this academic concept gives them a strategic advantage. Place under heading "Why Should I Care?"`,
      visual_learner: `At the end of every major <section>, inject a button to help visual learners. The button MUST be formatted exactly like this: <button class="watch-explainer" data-query="[TAILORED SEARCH QUERY]">🎥 Watch Explainer</button>.
    CRITICAL RULES FOR THE SEARCH QUERY:
    1. Do NOT generate a YouTube URL. You must generate a YouTube search query.
    2. The query must be based on the core concept of that section.
    3. You MUST tailor the search query to the user's age and cognitive profile (e.g., append "simple visual explanation", "for kids", or "ADHD friendly" to the search terms based on their profile).
    4. Do not wrap the button in any other divs, just place it as the last element inside the <section>.`,
      mindmap: `After the notes, include a section titled "Mind Map Data" wrapped in <div class="mindmap-data" style="display:none">. Inside, place a valid JSON object following Tony Buzan's Radiant Thinking principles. Structure: {"nodes":[{"id":"root","label":"CENTRAL IDEA","type":"root","color":null,"detailed_info":"3-5 sentences of high-value study facts directly from the notes about the central focal point.","category":"overview"},{"id":"t1","label":"Keyword","type":"main_topic","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining this major theme with context, mechanisms, or examples.","category":"concept"},{"id":"t1d1","label":"Sub-keyword","type":"detail","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes expanding this supporting detail with specifics.","category":"detail"}],"edges":[{"source":"root","target":"t1"},{"source":"t1","target":"t1d1"}]}. RADIANT THINKING RULES: 1) CENTRAL NODE: Identify ONE clear, central focal point from the study material. The root label must be 1-3 keywords maximum. 2) RADIANT HIERARCHY: Main branches (main_topic) radiate from the center across the full topic space. Sub-branches (detail) radiate from their parent and should contain supporting facts or examples. 3) KEYWORDS ONLY: Every node label MUST be 1-3 concise keywords — never full sentences. 4) DEEP CONTENT RULE: DO NOT provide a meta-explanation of the tool. You MUST extract real, detailed study content from the provided material. 5) DETAILED INFO (CRITICAL): Each node object MUST contain: { id, label, type, color, detailed_info, category }. Every node MUST contain a detailed_info field with 3-5 sentences of contextually accurate study material from the source. No placeholders allowed. Every single node — root, main_topic, AND detail — MUST have this field. If "detailed_info" is missing, generic, or placeholder-like, the generation is considered a failure. 6) BRANCH COLORING: Use ONLY these colors: sage, lavender, peach, sky, amber. One color per main branch — all sub-nodes inherit their parent branch color. Root node should use color null. 7) CATEGORIES: Every node MUST have a "category" field (e.g. "overview", "concept", "process", "detail", "example", "definition"). 8) STRUCTURE: main_topic nodes branch from root. detail nodes branch from their parent main_topic. Generate 3-6 main topics with 2-4 details each. 9) No emojis. 10) The JSON must be valid — no trailing commas. 11) Output ONLY the JSON payload inside the hidden div with no commentary, markdown, or code fences.`,
      flowchart: `After the notes, include a section titled "Flow Chart Data" wrapped in <div class="flowchart-data" style="display:none">. Inside, place a valid JSON object. Structure: {"nodes":[{"id":"1","label":"Start Here","type":"start","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining what initiates this process and the required context.","category":"entry"},{"id":"2","label":"Step A","type":"process","color":"lavender","detailed_info":"3-5 sentences of high-value study facts directly from the notes describing what happens in this step, why it matters, and how it leads forward.","category":"procedure"},{"id":"3","label":"Decision?","type":"decision","color":"peach","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining the exact criteria, branch logic, or thresholds involved.","category":"decision"},{"id":"4","label":"Done","type":"end","color":"sky","detailed_info":"3-5 sentences of high-value study facts directly from the notes summarizing the end state, outcome, or result.","category":"outcome"}],"edges":[{"source":"1","target":"2"},{"source":"2","target":"3"},{"source":"3","target":"4","label":"Yes"},{"source":"3","target":"2","label":"No"}]}. Rules: 1) Extract the actual order of operations, real timelines, procedural sequences, cause-effect chains, or if/then logic directly FROM the study material. The chart must reflect the true order found in the text, such as surgical steps, legal workflows, scientific procedures, or real estate timelines. 2) DO NOT provide a meta-explanation of the tool. You MUST extract real, detailed study content from the provided material. 3) Use ONLY these colors: sage, lavender, peach, sky, amber. 4) Node types: "start" (entry point), "process" (a step), "decision" (yes/no branch), "end" (final outcome). The first node MUST be type "start" and the last MUST be type "end". 5) CRITICAL: Each node object MUST contain: { id, label, type, color, detailed_info, category }. Every node MUST contain a detailed_info field with 3-5 sentences of contextually accurate study material from the source. No placeholders allowed. Every single node MUST have this field. If "detailed_info" is missing, generic, or placeholder-like, the generation is considered a failure. 6) Every node MUST have a "category" field. 7) Keep labels SHORT (under 6 words). 8) Generate 6-15 nodes in a strictly sequential top-to-bottom order. 9) Decision nodes MUST have exactly 2 outgoing edges with "Yes"/"No" labels. 10) The JSON must be valid — no trailing commas. 11) Output ONLY the JSON payload inside the hidden div with no commentary, markdown, or code fences.`,
    };

    let extrasStr = "";
    if (extras && Array.isArray(extras) && extras.length > 0) {
      const prompts = extras.map((id: string) => EXTRAS_PROMPTS[id]).filter(Boolean);
      if (prompts.length > 0) {
        extrasStr = "\n\nADDITIONAL SECTIONS TO INCLUDE:\n" + prompts.join("\n\n");
      }
    }

    const instructionsStr = instructions
      ? `\n\nUser instructions: "${instructions}"`
      : "";

    let modePrompt = "";
    if (learningMode === "dyslexia") {
      modePrompt = `
Format for a reader with dyslexia:
- ZERO DATA LOSS (CRITICAL): You are strictly forbidden from summarizing, cutting, or condensing information. Every single detail, example, mechanism, and nuance from the source text MUST be preserved in your output.
- VISUAL PACING: To make the full depth of information readable, you must split the text into a high volume of short paragraphs. Use as many paragraphs as needed to retain 100% of the source data, but NEVER let a single paragraph exceed 3 sentences.
- Use bullet points ONLY for actual lists, categories, or sequential steps. Do not use bullets for narrative explanations.
- Avoid walls of text. Ensure every paragraph is separated by clear white space.
- Bold key terms on first use.
- Avoid idioms, sarcasm, and abstract metaphors. Use literal, concrete language.
- Every <section> must contain at least one <h3> sub-heading to logically group the deep information.`;
    } else {
      modePrompt = `
Format for a reader with ADHD:
- ZERO DATA LOSS (CRITICAL): You are strictly forbidden from summarizing, cutting, or condensing information. Every single detail, example, mechanism, and nuance from the source text MUST be preserved in your output.
- VISUAL PACING: You must retain the deep, complex information, but format it strictly for rapid visual processing. Use as many paragraphs as necessary to cover all the material, but keep every individual paragraph under 3 sentences.
- INFORMATION HIERARCHY: Start each section with a one-line hook or "why this matters" statement. Then, provide the full context using short, punchy paragraphs. Use bullet points specifically to break out granular facts, data sets, or lists.
- NARRATIVE PRESERVATION: Do NOT use bullet points exclusively if it destroys the narrative context of a complex topic.
- SKIMMABILITY: Use **bold text** strategically on key phrases, core mechanisms, and important terms within paragraphs. This allows the reader's eye to jump through the text and grasp the full concept without reading every filler word.
- Add emoji icons to section headers for visual anchoring.
- Include a "⚡ TL;DR" section at the very top (3-5 bullet summary).
- Every <section> must contain at least one <h3> sub-heading.
- CRITICAL FORMATTING: Set generous spacing between all elements, keep text columns narrow, and use line height of at least 1.6.`;
    }

    // 1. Process standard profile and age
    let profileStr = profilePrompt && typeof profilePrompt === "string" ? `\n\nUSER COGNITIVE PROFILE:\n${profilePrompt}` : "";
    const ageStr = age && typeof age === "number" ? `\n\nIMPORTANT: The learner is approximately ${age} years old. Adjust vocabulary, sentence complexity, and reading level accordingly. ${age < 10 ? "Use very simple language, short sentences, and concrete examples." : age < 13 ? "Use clear, straightforward language appropriate for a middle schooler." : age < 18 ? "Use age-appropriate language for a teenager." : ""}` : "";

    // 2. Hardcoded Strict Cognitive Modifiers
    const profileLower = profileStr.toLowerCase();
    const cognitiveRules: string[] = [];

    if (profileLower.includes("dyscalculia")) {
      cognitiveRules.push("COGNITIVE MODIFIER (Dyscalculia): Whenever presenting statistics, percentages, or abstract numbers, you MUST immediately translate them into a concrete, visual, real-world analogy (e.g., instead of '20%', say '2 out of every 10 people, or the size of a small classroom'). Do not leave numbers isolated.");
    }

    if (profileLower.includes("working memory") || profileLower.includes("executive function")) {
      cognitiveRules.push("COGNITIVE MODIFIER (Working Memory): Break complex multi-step concepts into the 'I Do, We Do, You Do' format. Provide an explicit, numbered checklist for any multi-step process. Keep instructions highly sequential.");
    }

    if (profileLower.includes("rsd") || profileLower.includes("rejection sensitive")) {
      cognitiveRules.push("COGNITIVE MODIFIER (RSD): Utilize Unconditional Positive Regard in all study tool outputs. Depersonalize all errors in quizzes or recall prompts. Never use the words 'wrong', 'incorrect', or 'failed'. Frame misunderstandings as 'stepping stones' and validate the user's thought process before correcting.");
    }

    if (cognitiveRules.length > 0) {
      profileStr += `\n\nSTRICT COGNITIVE RULES:\n${cognitiveRules.join("\n\n")}`;
    }

    const systemPrompt = `You are an expert study note generator. Your job is to transform raw study material into comprehensive, well-organized notes.

CONTENT FILTERING (CRITICAL — apply BEFORE generating notes):
• You will often receive raw web data that includes navigation menus, headers, footers, cookie consent banners, sidebar widgets, advertisements, social media links, and legal disclaimers. You MUST identify and DISCARD this non-academic noise. Only process information relevant to the core subject matter.
• If, after filtering, the remaining content is mostly advertisements, privacy policies, terms of service, cookie notices, or other non-study material with no substantive academic or educational content, respond with ONLY this single HTML line and nothing else:
<p class="no-content-warning">⚠️ The provided link appears to contain mostly website legal info, ads, or boilerplate rather than study material. Please try a different URL or paste the study content directly as text.</p>

CRITICAL RULES:
1. Do NOT lose any information. Every fact, concept, and detail must be preserved.
2. You are ONLY reformatting and reorganizing — not summarizing or cutting content.
3. For technical jargon or domain-specific terms, wrap them in: <span class="jargon" data-definition="PLAIN ENGLISH DEFINITION HERE">term</span>. The definition should be a short, simple explanation (1-2 sentences max). Keep the term in context naturally.

MICRO-CHUNKING RULE (MANDATORY):
- Any single <section> MUST NOT exceed 150 words of content.
- If a topic contains more than 150 words of information, you MUST split it into multiple <section> tags. Give each split section its own <h2> using either numbered parts (e.g. "Topic Name (Part 1)", "Topic Name (Part 2)") or distinct sub-topic headers that describe the content.
- Each new <section> must continue cycling through the data-section-color attributes: "sage", "lavender", "peach", "sky", "amber" — providing a visual reset with every section.
- You must still preserve ALL information when splitting — nothing may be lost or summarized away.
4. For uploaded documents (PDF, Word, PowerPoint, images), extract ALL text content.
5. For YouTube videos, use the provided transcript as the source material.

${modePrompt}

OUTPUT FORMAT:
Return valid HTML using: <h1>, <section>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <span>.
CRITICAL: NEVER use markdown syntax like **bold** or *italic* — ALWAYS use HTML tags <strong> and <em> instead. Output MUST be pure HTML, not markdown.
CRITICAL: Start with a single <h1> tag containing a clear, descriptive title based on the SUBJECT of the material (e.g. "Cell Biology & Mitosis", "World War II: Key Events", "Introduction to Python Programming"). Do NOT use generic titles like "Study Notes".
CRITICAL: Wrap EACH major section in a <section data-section-color="COLOR"> tag, where COLOR cycles through: "sage", "lavender", "peach", "sky", "amber".
Place the <h2> INSIDE the <section> (do NOT put data-section-color on the h2, put it on the section AND the h2).
Wrap the entire output in a single <div>.

CRITICAL JSON GENERATION RULES (STRICT ENFORCEMENT):
If you are asked to generate Mind Map or Flow Chart JSON, you will be heavily penalized if you violate these rules:
1. You MUST write 3-5 complete sentences of factual study context for the "detailed_info" field of EVERY single node. 
2. NEVER leave "detailed_info" blank. NEVER use generic placeholders like "Details go here."
3. DO NOT wrap the JSON in markdown code fences (\`\`\`json). Output the raw JSON object directly inside the hidden div.${extrasStr}${instructionsStr}${profileStr}${ageStr}`;

    contentParts.unshift({
      type: "text",
      text: "Transform ALL the content from the following material into brain-friendly study notes. Extract every piece of information.",
    });

    const streamResult = await callAIStream({
      systemPrompt,
      messages: [{ role: "user", content: contentParts }],
      stream: true,
    });

    return new Response(streamResult.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});