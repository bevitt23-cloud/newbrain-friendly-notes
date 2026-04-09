import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIStream } from "../_shared/callAI.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // SSRF protection: block private/internal IP ranges and cloud metadata endpoints
    const h = parsed.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h === "[::1]" ||
      h.endsWith(".internal") ||
      h.endsWith(".local") ||
      h === "metadata.google.internal" ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^0\./.test(h) ||
      h === "metadata" ||
      h === "metadata.google" ||
      h.startsWith("fd") || // IPv6 private
      h.startsWith("fe80") // IPv6 link-local
    ) {
      console.warn(`[SSRF] Blocked private/internal URL: ${h}`);
      return null;
    }

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
    const { textContent, youtubeUrl, websiteUrl, learningMode, extras, instructions, profilePrompt, age, chapterContext, images, noteFormat } = body;

    const contentParts: any[] = [];

    // ── Handle uploaded images (vision input) ──
    const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const MAX_IMAGE_BASE64_LEN = 10 * 1024 * 1024; // ~7.5MB decoded
    let validImageCount = 0;
    if (Array.isArray(images) && images.length > 0) {
      console.log(`[generate-notes] Received ${images.length} image(s) for vision processing`);
      for (const img of images.slice(0, 10)) {
        if (!img.data || typeof img.data !== "string") continue;
        if (img.data.length > MAX_IMAGE_BASE64_LEN) {
          console.warn(`[generate-notes] Skipping oversized image (${(img.data.length / 1024 / 1024).toFixed(1)}MB)`);
          continue;
        }
        const mime = typeof img.mimeType === "string" ? img.mimeType.toLowerCase() : "";
        if (!ALLOWED_IMAGE_MIMES.has(mime)) {
          console.warn(`[generate-notes] Skipping image with invalid MIME: ${mime}`);
          continue;
        }
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${mime};base64,${img.data}`,
          },
        });
        validImageCount++;
      }
      console.log(`[generate-notes] ${validImageCount} of ${images.length} image(s) passed validation`);
    }
    const hasImages = validImageCount > 0;

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

      // ── Multi-strategy website content extraction ──
      // Strategy 1: Free academic APIs (PMC, PubMed, ArXiv, Semantic Scholar, DOI/Unpaywall)
      // Strategy 2: Smart direct fetch with academic-aware HTML extraction
      // Strategy 3: ScrapingBee (when configured) with 4-attempt escalation
      // Strategy 4: Unpaywall open-access fallback for paywalled papers

      let websiteText = "";
      const parsedUrl = new URL(normalizedWebsiteUrl);
      const host = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();

      // ── Helper: strip HTML to plain text ──
      // Cap input at 500KB to prevent ReDoS from malformed HTML with
      // unclosed tags causing catastrophic regex backtracking.
      const STRIP_HTML_MAX = 512 * 1024;
      const stripHtml = (html: string): string => {
        const capped = html.length > STRIP_HTML_MAX ? html.slice(0, STRIP_HTML_MAX) : html;
        return capped
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<aside[\s\S]*?<\/aside>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#?\w+;/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
      };

      // ── Helper: fetch with browser-like headers ──
      const browserFetch = (url: string) =>
        fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });

      // ── STRATEGY 1: Academic Free APIs ──
      try {
        // PMC (PubMed Central) — free full-text XML API
        const pmcMatch = normalizedWebsiteUrl.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i)
          || normalizedWebsiteUrl.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/(PMC\d+)/i);
        if (pmcMatch && !websiteText) {
          const pmcId = pmcMatch[1];
          console.log(`PMC detected: ${pmcId} — fetching via NCBI E-Utilities`);
          const pmcResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcId}&rettype=xml`);
          if (pmcResp.ok) {
            const xml = await pmcResp.text();
            // Extract body text from JATS XML
            const bodyMatch = xml.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
            const text = stripHtml(bodyMatch ? bodyMatch[1] : xml);
            if (text.length > 500) {
              websiteText = text;
              console.log(`PMC API succeeded: ${text.length} chars`);
            }
          }
        }

        // PubMed abstract — free API
        const pubmedMatch = normalizedWebsiteUrl.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)
          || normalizedWebsiteUrl.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i);
        if (pubmedMatch && !websiteText) {
          const pmid = pubmedMatch[1];
          console.log(`PubMed detected: PMID ${pmid} — fetching abstract + checking for PMC full text`);
          // Check if there's a PMC full-text version
          const linkResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pmc&id=${pmid}&retmode=json`);
          if (linkResp.ok) {
            const linkData = await linkResp.json();
            const pmcLinks = linkData?.linksets?.[0]?.linksetdbs?.find((db: any) => db.dbto === "pmc");
            if (pmcLinks?.links?.[0]) {
              const pmcId = `PMC${pmcLinks.links[0]}`;
              console.log(`Found PMC full text: ${pmcId}`);
              const pmcResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcId}&rettype=xml`);
              if (pmcResp.ok) {
                const xml = await pmcResp.text();
                const bodyMatch = xml.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
                const text = stripHtml(bodyMatch ? bodyMatch[1] : xml);
                if (text.length > 500) {
                  websiteText = text;
                  console.log(`PMC full text via PubMed link: ${text.length} chars`);
                }
              }
            }
          }
          // Fallback: at least get the abstract
          if (!websiteText) {
            const absResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`);
            if (absResp.ok) {
              const absText = await absResp.text();
              if (absText.trim().length > 100) {
                websiteText = absText.trim();
                console.log(`PubMed abstract: ${websiteText.length} chars`);
              }
            }
          }
        }

        // ArXiv — free full-text HTML/PDF
        const arxivMatch = normalizedWebsiteUrl.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d+\.\d+)/i);
        if (arxivMatch && !websiteText) {
          const arxivId = arxivMatch[1];
          console.log(`ArXiv detected: ${arxivId} — fetching HTML version`);
          const htmlResp = await fetch(`https://arxiv.org/html/${arxivId}v1`);
          if (htmlResp.ok) {
            const html = await htmlResp.text();
            const text = stripHtml(html);
            if (text.length > 500) {
              websiteText = text;
              console.log(`ArXiv HTML: ${text.length} chars`);
            }
          }
          // Fallback: get abstract from API
          if (!websiteText) {
            const apiResp = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
            if (apiResp.ok) {
              const xml = await apiResp.text();
              const summaryMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/);
              if (summaryMatch) {
                websiteText = summaryMatch[1].trim();
                console.log(`ArXiv abstract: ${websiteText.length} chars`);
              }
            }
          }
        }

        // Semantic Scholar — free API for any DOI or paper URL
        const doiMatch = normalizedWebsiteUrl.match(/(?:doi\.org|dx\.doi\.org)\/(10\.\d{4,}\/[^\s?#]+)/i)
          || normalizedWebsiteUrl.match(/(10\.\d{4,}\/[^\s?#]+)/i);
        if (doiMatch && !websiteText) {
          const doi = doiMatch[1];
          console.log(`DOI detected: ${doi} — trying Semantic Scholar + Unpaywall`);
          // Semantic Scholar full text
          const s2Resp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=title,abstract,tldr,openAccessPdf`);
          if (s2Resp.ok) {
            const s2Data = await s2Resp.json();
            const parts: string[] = [];
            if (s2Data.title) parts.push(`Title: ${s2Data.title}`);
            if (s2Data.abstract) parts.push(`Abstract: ${s2Data.abstract}`);
            if (s2Data.tldr?.text) parts.push(`TL;DR: ${s2Data.tldr.text}`);
            if (parts.join("\n\n").length > 200) {
              websiteText = parts.join("\n\n");
              console.log(`Semantic Scholar: ${websiteText.length} chars`);
            }
            // Try open access PDF URL from Semantic Scholar
            if (!websiteText && s2Data.openAccessPdf?.url) {
              console.log(`Trying open access PDF: ${s2Data.openAccessPdf.url}`);
              const pdfPageResp = await browserFetch(s2Data.openAccessPdf.url);
              if (pdfPageResp.ok) {
                const ct = pdfPageResp.headers.get("content-type") || "";
                if (ct.includes("html")) {
                  const html = await pdfPageResp.text();
                  const text = stripHtml(html);
                  if (text.length > 500) websiteText = text;
                }
              }
            }
          }
          // Unpaywall — find free/legal open access version
          if (!websiteText) {
            const upResp = await fetch(`https://api.unpaywall.org/v2/${doi}?email=${Deno.env.get("UNPAYWALL_EMAIL") || "brainfriendlynotes@app.com"}`);
            if (upResp.ok) {
              const upData = await upResp.json();
              const oaUrl = upData.best_oa_location?.url_for_landing_page || upData.best_oa_location?.url;
              if (oaUrl) {
                console.log(`Unpaywall found OA version: ${oaUrl}`);
                const oaResp = await browserFetch(oaUrl);
                if (oaResp.ok) {
                  const html = await oaResp.text();
                  const text = stripHtml(html);
                  if (text.length > 500) {
                    websiteText = text;
                    console.log(`Unpaywall OA: ${text.length} chars`);
                  }
                }
              }
            }
          }
        }
      } catch (apiErr) {
        console.warn("Academic API strategy failed:", apiErr);
      }

      // ── STRATEGY 2: Smart direct fetch ──
      if (!websiteText) {
        try {
          console.log(`Trying direct fetch for ${normalizedWebsiteUrl}`);
          const directResp = await browserFetch(normalizedWebsiteUrl);
          if (directResp.ok) {
            const html = await directResp.text();
            const text = stripHtml(html);
            if (text.length > 200) {
              websiteText = text;
              console.log(`Direct fetch succeeded: ${text.length} chars`);
            }
          } else {
            console.warn(`Direct fetch returned status ${directResp.status}`);
          }
        } catch (fetchErr) {
          console.warn("Direct fetch failed:", fetchErr);
        }
      }

      // ── STRATEGY 3: ScrapingBee (when configured) ──
      const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY");
      if (!websiteText && SCRAPINGBEE_API_KEY) {
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
          if (mode === "google_bot") params.set("custom_google", "true");
          if (mode === "no_js") params.delete("wait_for");
          return `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
        };

        const scrapeHeaders: Record<string, string> = { "Spb-Referer": "https://www.google.com/" };

        const extractText = (data: Record<string, unknown>): string => {
          if (typeof data.content === "string" && data.content.trim().length > 200) return data.content;
          if (typeof data.body === "string" && data.body.trim().length > 200) return data.body;
          if (typeof data.text === "string" && data.text.trim().length > 200) return data.text;
          return "";
        };

        const attemptScrape = async (mode: ScrapeMode, useBodyFallback = false): Promise<Response> => {
          console.log(`ScrapingBee: ${normalizedWebsiteUrl} (mode=${mode}, bodyFallback=${useBodyFallback})`);
          return fetch(buildScrapeUrl(mode, useBodyFallback), { headers: scrapeHeaders });
        };

        try {
          const modes: Array<{ mode: ScrapeMode; body: boolean }> = [
            { mode: "stealth", body: false },
            { mode: "google_bot", body: false },
            { mode: "no_js", body: false },
            { mode: "stealth", body: true },
          ];

          for (const { mode, body } of modes) {
            if (websiteText) break;
            const resp = await attemptScrape(mode, body);
            let text = "";
            if (resp.ok) {
              const data = await resp.json();
              text = extractText(data);
            }
            scrapeTrace.push({ mode, bodyFallback: body, status: resp.status, textLength: text.length });
            if (text.length >= 200) {
              websiteText = text;
              console.log(`ScrapingBee succeeded (${mode}): ${text.length} chars`);
            } else {
              console.warn(`ScrapingBee attempt ${mode} insufficient (status=${resp.status}, len=${text.length})`);
            }
          }
          if (!websiteText) {
            console.error(`All ScrapingBee attempts failed for ${normalizedWebsiteUrl}`, scrapeTrace);
          }
        } catch (err) {
          console.error("ScrapingBee error:", err);
        }
      }

      // ── STRATEGY 4: Unpaywall DOI lookup as last resort ──
      if (!websiteText && host !== "doi.org") {
        try {
          // Try to extract a DOI from the page URL or fetch the page to find one
          const possibleDoi = normalizedWebsiteUrl.match(/(10\.\d{4,}\/[^\s?#&]+)/);
          if (possibleDoi) {
            const doi = possibleDoi[1];
            console.log(`Last resort: Unpaywall for DOI ${doi}`);
            const upResp = await fetch(`https://api.unpaywall.org/v2/${doi}?email=${Deno.env.get("UNPAYWALL_EMAIL") || "brainfriendlynotes@app.com"}`);
            if (upResp.ok) {
              const upData = await upResp.json();
              const oaUrl = upData.best_oa_location?.url_for_landing_page || upData.best_oa_location?.url;
              if (oaUrl && oaUrl !== normalizedWebsiteUrl) {
                const oaResp = await browserFetch(oaUrl);
                if (oaResp.ok) {
                  const html = await oaResp.text();
                  const text = stripHtml(html);
                  if (text.length > 500) {
                    websiteText = text;
                    console.log(`Unpaywall last-resort OA: ${text.length} chars`);
                  }
                }
              }
            }
          }
        } catch (upErr) {
          console.warn("Unpaywall last-resort failed:", upErr);
        }
      }

      // ── Push result ──
      if (websiteText && websiteText.length > 200) {
        const trimmed = websiteText.slice(0, 100000);
        console.log(`Website extraction succeeded for ${normalizedWebsiteUrl}: ${trimmed.length} chars`);
        contentParts.push({
          type: "text",
          text: `--- Content from ${normalizedWebsiteUrl} ---\n${trimmed}`,
        });
      } else {
        console.error(`All extraction strategies failed for ${normalizedWebsiteUrl}`);
        contentParts.push({
          type: "text",
          text: `Could not extract readable content from ${normalizedWebsiteUrl}. The page may be behind a paywall, require login, or block automated access. Try copying and pasting the article text directly.`,
        });
      }
    }

    // Handle plain text content
    if (textContent && typeof textContent === "string" && textContent.trim()) {
      const trimmed = textContent.slice(0, 100000);
      // Detect if content comes from an uploaded document vs raw pasted text.
      // Check specifically for the client-side extraction marker at the START of the text.
      const isUploadedDoc = /^--- Content from .+\.(pdf|docx?|pptx?|txt|md|csv) ---/im.test(trimmed.slice(0, 300));
      const contentLabel = isUploadedDoc
        ? "Uploaded document content (DO NOT apply web content filtering)"
        : "Pasted text content";
      contentParts.push({
        type: "text",
        text: `--- ${contentLabel} ---\n${trimmed}`,
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
      tldr: `You must begin the response with a 'Bottom-Line Up Front' (BLUF) summary wrapped in its own colored section: <section data-section-color="sky"><h2 data-section-color="sky">⚡ TL;DR</h2>...</section>. Condense the entire topic into exactly one or two highly impactful sentences that state the ultimate conclusion or primary mechanism. This section MUST be a colored <section> tag with data-section-color — never plain unstyled text.`,
      feynman: `At the very end of all notes, include a 'Feynman Check' section wrapped in <div class="feynman-check" data-section="feynman">. Include a prompt asking the user to explain the core concept in their own words. Add a <textarea class="feynman-input" placeholder="Explain it in your own words..." rows="4"></textarea> and a <button class="feynman-submit">Check My Understanding</button>. Also include a hidden <div class="feynman-key" style="display:none"> containing 3-5 key points the user should have covered, each as a <div class="feynman-point" data-concept="SHORT_LABEL">explanation</div>.`,
      recall: `SELECTIVE PLACEMENT RULE: Add recall prompts ONLY to sections that contain actual educational/study content — concepts, mechanisms, facts, theories, procedures, or analysis. Do NOT add recall prompts to sections that are structural, organizational, introductory overviews, tables of contents, handbook structure descriptions, author bios, acknowledgements, or administrative content. For qualifying sections: At the VERY END of the <section>, AFTER all content (paragraphs, lists, sub-sections, write-this-down boxes), insert a recall prompt as the LAST child element before the closing </section> tag. The recall prompt MUST come AFTER the section content so the user reads the material first — placing it at the top defeats the purpose of retrieval practice. Wrap in <div class="recall-prompt" data-section-index="N"> (where N is the section number starting from 1). Include a brief open-ended question about that section's key concept. Add a <textarea class="recall-input" placeholder="What do you remember?" rows="3"></textarea> and a <button class="recall-submit">Check</button>. Include a hidden <div class="recall-key" style="display:none">the correct key points for this section</div>. Make questions force retrieval, not recognition.`,
      simplify: `SELECTIVE PLACEMENT RULE: Add "Write This Down" boxes ONLY to sections that contain actual educational/study content worth memorizing — key concepts, mechanisms, facts, formulas, procedures, or critical analysis. Do NOT add them to structural sections, handbook overviews, tables of contents, organizational descriptions, admin info, or introductory framing that has no testable content. For qualifying sections: at the end, include a <div class="write-this-down"><strong>✍️ Write This Down:</strong> <p>A 1-2 sentence guidance telling the user exactly what to note from this section and how to summarize it in their own words. Be specific about what concept to capture.</p></div>`,
      why_care: `Write a highly engaging introductory paragraph connecting the academic topic directly to the student's real life. Explicitly explain how mastering this academic concept gives them a strategic advantage. Wrap it in its own colored section: <section data-section-color="amber"><h2 data-section-color="amber">🤔 Why Should I Care?</h2>...</section>. This section MUST be a colored <section> tag with data-section-color — never plain unstyled text. Place it right after the TL;DR (if present) or at the very top.`,
      visual_learner: `SELECTIVE PLACEMENT: Only add a Watch Explainer button to sections that contain a concept, process, or mechanism that would genuinely benefit from a video demonstration. DO NOT add the button to introductory sections, summary sections, tables of contents, definitions-only sections, or sections that are purely text-based context without a visualizable concept. Good candidates: scientific processes, math procedures, historical events, anatomical systems, coding tutorials, engineering concepts. Bad candidates: author bios, vocabulary lists, administrative info, simple factual lists. The button MUST be formatted exactly like this: <button class="watch-explainer" data-query="[TAILORED SEARCH QUERY]">🎥 Watch Explainer</button>.
    CRITICAL RULES FOR THE SEARCH QUERY:
    1. Do NOT generate a YouTube URL. You must generate a YouTube SEARCH QUERY string.
    2. The query MUST be hyper-specific to the exact concept in that section — not the general topic. BAD: "biology explained". GOOD: "mitosis prophase metaphase stages explained diagram".
    3. Include the specific subject area and key terminology from the section. For example, if the section covers "oxidative phosphorylation in the electron transport chain", the query should be "oxidative phosphorylation electron transport chain explained step by step", NOT "cell biology explained".
    4. Add a format qualifier at the end: "explained", "visual explanation", "step by step", "diagram walkthrough", or "animated" — whichever best matches the content type.
    5. If the user is under 15, append "for students" or "simple explanation". Otherwise keep it at an appropriate academic level.
    6. The query should be 5-10 words. Too short = irrelevant results. Too long = no results.
    7. Do not wrap the button in any other divs, just place it as the last element inside the <section>.`,
      mindmap: `After the notes, include a section titled "Mind Map Data" wrapped in <div class="mindmap-data" style="display:none">. CRITICAL: You are generating raw JSON inside a hidden HTML div. DO NOT use markdown code blocks or code fences. Escape all double quotes inside your detailed_info strings to prevent breaking the HTML parsing. Output clean, strictly valid JSON directly. Inside, place a valid JSON object following Tony Buzan's Radiant Thinking principles. Structure: {"nodes":[{"id":"root","label":"CENTRAL IDEA","type":"root","color":null,"detailed_info":"3-5 sentences of high-value study facts directly from the notes about the central focal point.","category":"overview"},{"id":"t1","label":"Keyword","type":"main_topic","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining this major theme with context, mechanisms, or examples.","category":"concept"},{"id":"t1d1","label":"Sub-keyword","type":"detail","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes expanding this supporting detail with specifics.","category":"detail"}],"edges":[{"source":"root","target":"t1"},{"source":"t1","target":"t1d1"}]}. RADIANT THINKING RULES: 1) CENTRAL NODE: Identify ONE clear, central focal point from the study material. The root label must be 1-3 keywords maximum. 2) RADIANT HIERARCHY: Main branches (main_topic) radiate from the center across the full topic space. Sub-branches (detail) radiate from their parent and should contain supporting facts or examples. 3) KEYWORDS ONLY: Every node label MUST be 1-3 concise keywords — never full sentences. 4) DEEP CONTENT RULE: DO NOT provide a meta-explanation of the tool. You MUST extract real, detailed study content from the provided material. 5) DETAILED INFO (CRITICAL): Each node object MUST contain: { id, label, type, color, detailed_info, category }. Every node MUST contain a detailed_info field with 3-5 sentences of contextually accurate study material from the source. No placeholders allowed. Every single node — root, main_topic, AND detail — MUST have this field. If "detailed_info" is missing, generic, or placeholder-like, the generation is considered a failure. 6) BRANCH COLORING: Use ONLY these colors: sage, lavender, peach, sky, amber. One color per main branch — all sub-nodes inherit their parent branch color. Root node should use color null. 7) CATEGORIES: Every node MUST have a "category" field (e.g. "overview", "concept", "process", "detail", "example", "definition"). 8) STRUCTURE: main_topic nodes branch from root. detail nodes branch from their parent main_topic. Generate 3-6 main topics with 2-4 details each. 9) No emojis. 10) The JSON must be valid — no trailing commas. 11) Output ONLY the JSON payload inside the hidden div with no commentary, markdown, or code fences.`,
      flowchart: `After the notes, include a section titled "Flow Chart Data" wrapped in <div class="flowchart-data" style="display:none">. CRITICAL: You are generating raw JSON inside a hidden HTML div. DO NOT use markdown code blocks or code fences. Escape all double quotes inside your detailed_info strings to prevent breaking the HTML parsing. Output clean, strictly valid JSON directly. Inside, place a valid JSON object. Structure: {"nodes":[{"id":"1","label":"Start Here","type":"start","color":"sage","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining what initiates this process and the required context.","category":"entry"},{"id":"2","label":"Step A","type":"process","color":"lavender","detailed_info":"3-5 sentences of high-value study facts directly from the notes describing what happens in this step, why it matters, and how it leads forward.","category":"procedure"},{"id":"3","label":"Decision?","type":"decision","color":"peach","detailed_info":"3-5 sentences of high-value study facts directly from the notes explaining the exact criteria, branch logic, or thresholds involved.","category":"decision"},{"id":"4","label":"Done","type":"end","color":"sky","detailed_info":"3-5 sentences of high-value study facts directly from the notes summarizing the end state, outcome, or result.","category":"outcome"}],"edges":[{"source":"1","target":"2"},{"source":"2","target":"3"},{"source":"3","target":"4","label":"Yes"},{"source":"3","target":"2","label":"No"}]}. Rules: 1) Extract the actual order of operations, real timelines, procedural sequences, cause-effect chains, or if/then logic directly FROM the study material. The chart must reflect the true order found in the text, such as surgical steps, legal workflows, scientific procedures, or real estate timelines. 2) DO NOT provide a meta-explanation of the tool. You MUST extract real, detailed study content from the provided material. 3) Use ONLY these colors: sage, lavender, peach, sky, amber. 4) Node types: "start" (entry point), "process" (a step), "decision" (yes/no branch), "end" (final outcome). The first node MUST be type "start" and the last MUST be type "end". 5) CRITICAL: Each node object MUST contain: { id, label, type, color, detailed_info, category }. Every node MUST contain a detailed_info field with 3-5 sentences of contextually accurate study material from the source. No placeholders allowed. Every single node MUST have this field. If "detailed_info" is missing, generic, or placeholder-like, the generation is considered a failure. 6) Every node MUST have a "category" field. 7) Keep labels SHORT (under 6 words). 8) Generate 6-15 nodes in a strictly sequential top-to-bottom order. 9) Decision nodes MUST have exactly 2 outgoing edges with "Yes"/"No" labels. 10) The JSON must be valid — no trailing commas. 11) Output ONLY the JSON payload inside the hidden div with no commentary, markdown, or code fences.`,
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
- Bold key terms on first use using <strong> tags. NEVER use asterisks for bold.
- Avoid idioms, sarcasm, and abstract metaphors. Use literal, concrete language.
- Every <section> must contain at least one <h3> sub-heading to logically group the deep information.`;
    } else {
      modePrompt = `
Format for a reader with ADHD:
- ZERO DATA LOSS (CRITICAL): You are strictly forbidden from summarizing, cutting, or condensing information. Every single detail, example, mechanism, and nuance from the source text MUST be preserved in your output.
- VISUAL PACING: You must retain the deep, complex information, but format it strictly for rapid visual processing. Use as many paragraphs as necessary to cover all the material, but keep every individual paragraph under 3 sentences.
- INFORMATION HIERARCHY: Start each section with a one-line hook or "why this matters" statement. Then, provide the full context using short, punchy paragraphs. Use bullet points specifically to break out granular facts, data sets, or lists.
- NARRATIVE PRESERVATION: Do NOT use bullet points exclusively if it destroys the narrative context of a complex topic.
- SKIMMABILITY: Use <strong> tags strategically on key phrases, core mechanisms, and important terms within paragraphs. This allows the reader's eye to jump through the text and grasp the full concept without reading every filler word. NEVER use asterisks or markdown bold — only HTML <strong> tags.
- Add emoji icons to <h2> section headers for visual anchoring (if the user's cognitive profile includes a VISUAL ANCHORING instruction, follow that instruction instead — it applies to both <h2> and <h3> headers).
- Include a "⚡ TL;DR" section at the very top (3-5 bullet summary), wrapped in a colored section: <section data-section-color="sky"><h2 data-section-color="sky">⚡ TL;DR</h2>...</section>.
- Every <section> must contain at least one <h3> sub-heading.
- CRITICAL FORMATTING: Set generous spacing between all elements, keep text columns narrow, and use line height of at least 1.6.`;
    }

    // 0. Note format instruction
    const NOTE_FORMAT_PROMPTS: Record<string, string> = {
      outline: "NOTE FORMAT: Use Outline format. Organize content with a clear heading hierarchy (H1 → H2 → H3). Use bulleted and numbered lists under each heading. Group related ideas under descriptive sub-headers.",
      cornell: "NOTE FORMAT: Use Cornell Notes format. Structure each section with two columns: a narrow left CUE COLUMN containing keywords, questions, or prompts, and a wider right NOTES COLUMN containing the detailed content. At the end of each major section, add a SUMMARY row with 2-3 sentences capturing the key takeaway. Use this HTML structure: <div class=\"cornell-section\"><div class=\"cornell-cue\">cue/question</div><div class=\"cornell-notes\">detailed notes</div></div> and <div class=\"cornell-summary\">summary</div>.",
      concept_map: "NOTE FORMAT: Use Concept Map format. Organize content around relationships between ideas rather than linear flow. For each concept, explicitly label its relationships to other concepts using tags like CAUSES, LEADS TO, IS A TYPE OF, CONTRASTS WITH, DEPENDS ON. Use connection markers and group related concepts visually with sub-sections.",
      flow: "NOTE FORMAT: Use Flow/Sequential format. Present content as a numbered sequence of steps, stages, or events. Each step should include: the step number (Step N of Total), what happens, why it happens, and what it leads to. Use arrow notation (→) between steps to show progression.",
    };
    const formatStr = noteFormat && typeof noteFormat === "string" && noteFormat !== "auto" && NOTE_FORMAT_PROMPTS[noteFormat]
      ? `\n\n${NOTE_FORMAT_PROMPTS[noteFormat]}`
      : "";

    // 1. Process standard profile and age
    let profileStr = profilePrompt && typeof profilePrompt === "string" ? `\n\nUSER COGNITIVE PROFILE:\n${profilePrompt}` : "";
    const ageStr = age && typeof age === "number" ? `\n\nIMPORTANT: The learner is approximately ${age} years old. Adjust vocabulary, sentence complexity, and reading level accordingly. ${age < 10 ? "Use very simple language, short sentences, and concrete examples." : age < 13 ? "Use clear, straightforward language appropriate for a middle schooler." : age < 18 ? "Use age-appropriate language for a teenager." : ""}` : "";

    // 2. Hardcoded Strict Cognitive Modifiers
    const profileLower = profileStr.toLowerCase();
    const cognitiveRules: string[] = [];

    if (profileLower.includes("dyscalculia")) {
      cognitiveRules.push(`COGNITIVE MODIFIER (Dyscalculia): Whenever presenting statistics, percentages, or abstract numbers, you MUST immediately translate them into a concrete, visual, real-world analogy (e.g., instead of '20%', say '2 out of every 10 people, or the size of a small classroom'). Do not leave numbers isolated.

FORMULA TRANSLATOR: ONLY wrap actual multi-symbol mathematical equations in <span class="math-formula" data-formula="THE_ACTUAL_EQUATION">displayed formula</span>. The data-formula attribute MUST contain the real symbolic math expression (e.g. data-formula="y = mx + b" or data-formula="a^2 + b^2 = c^2"). NEVER put placeholder text, instruction text, or descriptions in data-formula — only real math symbols. DO NOT wrap these in math-formula: plain numbers (5, 81, 3.14), exercise/problem labels (Exercise 5, Problem 12), page numbers, dates, section numbers, single variables, or short numeric values. Only equations with operators (=, +, -, *, /) and multiple terms qualify.

COLOR-CODED VARIABLES: Inside math-formula spans ONLY, wrap each distinct variable in <span class="math-var" style="color: var(--math-VAR_NAME)">VAR</span> using consistent colors for the same variable throughout.

STEP-BY-STEP MATH: When solving or demonstrating a calculation, output a <div class="math-stepper" data-total-steps="N"> container with each step as <div class="math-step" data-step="N"><div class="math-step-equation">equation</div><div class="math-step-explain">detailed plain English explanation with a concrete real-world analogy for the operation</div></div>. NEVER skip steps or combine multiple operations. Each step explanation must include a real-world analogy that grounds the abstract math in something physical the user can visualize.`);
    }

    if (profileLower.includes("working memory") || profileLower.includes("executive function")) {
      cognitiveRules.push("COGNITIVE MODIFIER (Working Memory): Break complex multi-step concepts into the 'I Do, We Do, You Do' format. Provide an explicit, numbered checklist for any multi-step process. Keep instructions highly sequential. For math steppers: keep each step explanation under 2 sentences, bold the action verb, and start each explanation with what changed (e.g., '<strong>Subtracted</strong> 6 from both sides to isolate x').");
    }

    if (profileLower.includes("rsd") || profileLower.includes("rejection sensitive")) {
      cognitiveRules.push("COGNITIVE MODIFIER (RSD): Utilize Unconditional Positive Regard in all study tool outputs. Depersonalize all errors in quizzes or recall prompts. Never use the words 'wrong', 'incorrect', or 'failed'. Frame misunderstandings as 'stepping stones' and validate the user's thought process before correcting.");
    }

    if (cognitiveRules.length > 0) {
      profileStr += `\n\nSTRICT COGNITIVE RULES:\n${cognitiveRules.join("\n\n")}`;
    }

    const systemPrompt = `You are an expert, empathetic tutor. Your primary goal is to ensure the user fully comprehends this material. If the source material is disorganized, poorly extracted (like a messy PDF), or lacks punctuation (like an auto-generated YouTube transcript), DO NOT just blindly reformat the mess. Use your judgement to restructure the logic, fix the grammar, and present the concepts in a clear, pedagogical flow. Teach the material.

ABSOLUTE RULE — NO MARKDOWN: You are outputting pure HTML. NEVER use asterisks (*) for any purpose — no **bold**, no *italic*, no * bullet lists, no - bullet lists. Use <strong> for bold, <em> for italic, <ul><li> for unordered lists, <ol><li> for ordered lists. Any raw asterisk (*) or markdown dash bullet (- item) in your output is a critical failure. Every list must use proper HTML tags.

DYNAMIC SUBJECT ROUTING:
First, identify the subject matter of the source material and output your analysis as a hidden HTML comment at the very start of your output:
<!-- subject: [subject], topic: [main topic], subtopics: [list], recommended_format: [outline|cornell|concept_map|flow], complexity: [basic|intermediate|advanced] -->

Then apply the subject-specific rules below IN ADDITION to all other formatting rules:

STEM-Math: Preserve ALL formulas exactly. Show EVERY intermediate step in worked examples — never skip steps, never combine two operations into one step, never write "simplifying" or "by inspection" without showing the actual work. Each algebraic manipulation gets its own dedicated step. Write step explanations as if you are teaching the student one-on-one — use "we", "you", "notice how" language. Add plain-English translations after every formula. Number all steps sequentially. Use the math-stepper format for all calculations.
STEM-Science: Process flows must stay in sequential order. Diagrams are critical — always describe fully. Label all components. Use cause-and-effect framing for mechanisms.
History: Chronological order. Cause-and-effect framing. Bold key figures and dates. Use timeline format for sequences of events.
Literature: Thematic organization. Preserve all quotes exactly. Frame analysis around author intent. Character and concept motives.
Medical/Nursing: Clinical terms MUST have plain-English definitions in parentheses on first use. Process flows for treatment pathways. Anatomy references with clear descriptions.
Law: Hierarchical structure essential. Definition boxes for legal terms. Precedent chains and case relationships.
Business/Economics: Definition boxes for jargon. Case study format preserved. Real-world framing. Supply-demand and market relationships made explicit.
Computer Science: Code blocks preserved exactly with syntax formatting. Algorithm walkthroughs step by step. Input/output examples for every function or concept.
Psychology: Study details (researcher, year, sample, findings) all included. Theory comparisons side by side. Distinguish between correlation and causation.
Foreign Language: Vocabulary formatted for flashcard creation. Grammar rules with clear examples. Conjugation tables preserved as HTML tables.
General/Mixed: Blend strategies as appropriate for each section.

CONTENT FILTERING (apply to WEB-SCRAPED content ONLY):
• When content comes from a scraped website URL (marked "Content from http..."), it may include navigation menus, headers, footers, cookie consent banners, sidebar widgets, advertisements, social media links, and legal disclaimers. You MUST identify and DISCARD this non-academic noise. Only process information relevant to the core subject matter.
• If, after filtering web-scraped content, the remaining text is mostly advertisements, privacy policies, terms of service, cookie notices, or other non-study material with no substantive academic or educational content, respond with ONLY this single HTML line and nothing else:
<p class="no-content-warning">⚠️ The provided link appears to contain mostly website legal info, ads, or boilerplate rather than study material. Please try a different URL or paste the study content directly as text.</p>
• IMPORTANT: This filter does NOT apply to uploaded documents (PDF, Word, PowerPoint) or pasted text. Uploaded documents may contain front matter (copyright pages, table of contents, prefaces, contributor lists, Creative Commons licenses) — this is NORMAL for textbooks and academic materials. Skip past the front matter and generate notes from the academic content that follows. NEVER reject an uploaded document as "boilerplate".

CRITICAL RULES:
1. Do NOT lose any information. Every fact, concept, and detail must be preserved.
2. You are ONLY reformatting and reorganizing — not summarizing or cutting content.
3. For technical jargon or domain-specific terms, wrap them in: <span class="jargon" data-definition="PLAIN ENGLISH DEFINITION HERE">term</span>. The definition should be a short, simple explanation (1-2 sentences max). Keep the term in context naturally.

CONTENT INTELLIGENCE RULE:
Not all sections are equal. You MUST distinguish between sections with real educational/study content (concepts, mechanisms, facts, procedures, analysis) and sections that are purely structural/organizational (table of contents, handbook structure, author info, acknowledgements, administrative overviews). Study tools like recall prompts, "Write This Down" boxes, and engagement extras should ONLY appear in sections with substantive, testable content. Structural and organizational sections should be formatted cleanly but without study tool add-ons.

MICRO-CHUNKING RULE (MANDATORY):
- Any single <section> MUST NOT exceed 150 words of content.
- If a topic contains more than 150 words of information, you MUST split it into multiple <section> tags. Give each split section its own <h2> using either numbered parts (e.g. "Topic Name (Part 1)", "Topic Name (Part 2)") or distinct sub-topic headers that describe the content.
- Each new <section> must continue cycling through the data-section-color attributes: "sage", "lavender", "peach", "sky", "amber" — providing a visual reset with every section.
- You must still preserve ALL information when splitting — nothing may be lost or summarized away.
4. For uploaded documents (PDF, Word, PowerPoint, images), extract ALL text content.
5. For YouTube videos, use the provided transcript as the source material.

STEM & MATHEMATICS CONTENT RULES (apply when source material contains equations, formulas, proofs, or worked problems):

CONTENT TYPE AWARENESS:
Before generating notes, identify what type of material you are reading. If the source contains mathematical notation, equations, numbered exercises, or formulas, activate ALL of the following rules. You are not just reformatting — you are TRANSLATING mathematical language into human-readable understanding.

BROKEN OR MISSING MATH RECOVERY RULE (CRITICAL):
PDF extraction frequently corrupts or destroys mathematical expressions. They may appear as "[fraction]", "[value]", blank spaces, garbled symbols, or be missing entirely. When you encounter corrupted math:
1. Use the surrounding context (the topic, the section, the adjacent equations) to reconstruct what the expression SHOULD be.
2. Render the reconstructed expression using your knowledge of the subject.
3. NEVER write "[fraction]", "[value]", "[polynomial expression]", or any placeholder. Always provide the real content.
4. If you genuinely cannot reconstruct an expression, write: "⚠️ Note: This equation was unreadable in the source. The concept it represents is: [explain the concept in plain English]."

EXERCISE ANSWER KEY RULE (CRITICAL):
Raw answer keys (e.g. "Exercise 5: 81, Exercise 7: 243...") with no accompanying question are USELESS for studying. When you encounter a list of exercise answers without the questions:
- DO NOT reproduce the raw answer list.
- Instead, SELECT 2-3 representative problems from the set, reconstruct the full question from context, and work them out completely using the WORKED EXAMPLE RULE below.
- Then write: "The remaining exercises in this set follow the same pattern. Try working them using the steps above."

WORKED EXAMPLE RULE (CRITICAL — MANDATORY FOR ALL MATH/SCIENCE PROBLEMS):
When the source material contains example problems, exercises, or any step-by-step calculation — whether fully shown or only partially extracted — you MUST work them out completely using the cascading stepper format below. NEVER just show the answer. NEVER write out steps as plain paragraphs or bullet points. ALWAYS use this exact HTML structure:

<div class="math-stepper" data-total-steps="N">
  <div class="math-step" data-step="1">
    <div class="math-step-equation">the equation or expression at this stage</div>
    <div class="math-step-explain">teach the student what you just did and why, as if you are sitting next to them</div>
  </div>
  <div class="math-step" data-step="2">
    <div class="math-step-equation">the next equation after applying ONE SINGLE operation</div>
    <div class="math-step-explain">teach the student the one thing that changed, why you did it, and what to look for</div>
  </div>
</div>

ZERO-SKIP POLICY (ABSOLUTE — NO EXCEPTIONS):
- NEVER combine two operations into one step. Each individual algebraic manipulation (distributing, combining like terms, moving a term to the other side, dividing both sides, factoring, substituting, simplifying a fraction, canceling, applying an exponent rule) is its OWN dedicated step.
- NEVER write "simplifying gives us...", "after simplification...", "by inspection...", "which reduces to...", "trivially...", or "it follows that..." — these phrases HIDE steps. Show the actual work.
- NEVER jump from a complex expression to the answer. If solving 2(x+3) = 14, you need separate steps for: distributing (2x+6=14), subtracting 6 (2x=8), dividing by 2 (x=4). That is 3 steps minimum, not 1.
- If in doubt, ADD MORE STEPS. Too many steps is always better than too few. A student can skip ahead; they cannot fill in missing steps.

TEACHING VOICE FOR STEP EXPLANATIONS (CRITICAL):
You are a patient tutor sitting beside the student. Each math-step-explain must sound like you are TEACHING, not summarizing. Write in second person ("we", "you", "notice how") and walk the student through your reasoning.

Each math-step-explain MUST:
1. Name the exact operation: "Here we subtract 6 from both sides of the equation."
2. Explain WHY you chose that operation: "We do this because we want to get the term with x all by itself on the left side."
3. Point out what to notice: "See how the 6 disappears from the left? That's because 6 minus 6 is zero — it cancels out."

BAD example (too vague): "Simplify the left side."
BAD example (too terse): "Subtract 6."
BAD example (skips reasoning): "This gives us 2x = 8."
GOOD example: "Now we subtract 6 from both sides. Why 6? Because that's the number sitting next to the 2x, and we need to move it out of the way. When we subtract 6 from the left side, the +6 and −6 cancel each other out, leaving just 2x. On the right side, 14 minus 6 gives us 8. So now we have 2x = 8 — much simpler."

PROFILE-AWARE TEACHING STYLE:
If the user has a cognitive profile, adapt your teaching voice:
- Dyscalculia: Ground every operation in something physical. "Dividing both sides by 2 is like taking a group of 8 objects and splitting them into 2 equal piles — you get 4 in each pile. That's what x equals."
- Working memory: Lead with the action, keep it tight. "<strong>Subtracted 6</strong> from both sides to isolate the x term. Left side: 2x + 6 − 6 = 2x. Right side: 14 − 6 = 8."
- Visual-spatial: Describe the movement. "Watch the 6 — it 'jumps' from the left side to the right side, and when it crosses the equals sign, its sign flips from +6 to −6."
- If no profile is set, use warm, clear, conversational teaching language as shown in the GOOD example above.

Every worked example MUST include:
1. The full problem statement in plain English BEFORE the stepper — explain what we are trying to find and why (rewrite it if the PDF garbled it)
2. What concept this problem is testing and what strategy we will use to solve it (one or two sentences)
3. The COMPLETE solution using the math-stepper format above — one step per div, each showing ONE operation with a teaching explanation. The UI renders this as a cascading reveal where each step is shown one at a time.
4. A "Common Mistake" callout AFTER the stepper: <div class="common-mistake"><strong>⚠️ Common Mistake:</strong> [what students typically get wrong on this type of problem, WHY they get it wrong, and how to avoid it]</div>

DO NOT skip the math-stepper format. DO NOT use numbered lists or paragraphs for solutions. The stepper format is REQUIRED for every problem.

CONCEPT-FIRST RULE:
Before showing any formula or procedure, always teach the student WHAT it is and WHY it exists in one or two plain-English sentences. The student should understand the purpose before they see the mechanics. Use "you" and "we" language. Example: "Before we dive into the formula, here's what it actually does for you — the quadratic formula is a shortcut that tells you exactly where a parabola crosses the x-axis. We reach for it when factoring gets too messy or just won't work."

KNOWLEDGE GAP FILLING RULE:
If the PDF extraction has clearly dropped a concept (the notes reference something that was never explained, or a section title has no content beneath it), use your own knowledge to fill the gap accurately. Label it clearly: <div class="gap-filled"><strong>📚 From the textbook's context:</strong> [your explanation]</div>. Never leave a gap empty. Never hallucinate — only fill gaps where you are confident in the content based on the subject matter and surrounding context.

SAFE GAP-FILLING: If the missing context is highly specific and you cannot guarantee accuracy (e.g., a proprietary study, a very niche statistic, or a lecturer's personal opinion), do NOT guess. Instead insert: <div class="missing-context"><strong>⚠️ Note:</strong> A specific detail was lost in the document extraction here. Check your original source for this information.</div>

TABLE AND CLASSIFICATION RULE:
When the source contains a classification table (e.g. number sets, properties of operations, truth tables), reconstruct it as a complete, accurate HTML table. Do not write "implied specific number" or leave cells empty. Use your knowledge of the subject to fill in what the PDF failed to extract. Every cell must have real content.

${modePrompt}

OUTPUT FORMAT:
Return valid HTML using: <h1>, <section>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <span>.
CRITICAL: NEVER use markdown syntax. No asterisks (*) for bold, italic, or bullet points — ALWAYS use HTML tags <strong> and <em> instead. No markdown headers (#), no markdown lists (- item or * item), no markdown code fences. All lists MUST use <ul><li> or <ol><li> HTML tags. Output MUST be pure, clean HTML with zero markdown artifacts. If you catch yourself writing "* " or "- " at the start of a line, STOP and rewrite it as <li>.
CRITICAL: Start with a single <h1> tag containing a clear, descriptive title based on the SUBJECT of the material (e.g. "Cell Biology & Mitosis", "World War II: Key Events", "Introduction to Python Programming"). Do NOT use generic titles like "Study Notes".
CRITICAL: Wrap EACH major section in a <section data-section-color="COLOR"> tag, where COLOR cycles through: "sage", "lavender", "peach", "sky", "amber".
Place the <h2> INSIDE the <section> (do NOT put data-section-color on the h2, put it on the section AND the h2).
Wrap the entire output in a single <div>.

SECTION TITLE RULES (CRITICAL — these appear in a Jump-to navigation bar):
- Each <h2> MUST have a unique id attribute: id="section-1", id="section-2", etc.
- Section titles in <h2> tags MUST be concise (under 8 words) and describe the SPECIFIC content of that section.
- NEVER use generic titles like "Key Concepts", "Important Details", "Overview", "Main Points", or "Summary".
- ALWAYS use the specific subject matter: e.g., "Mitosis: Cell Division Stages", "Freud's Defense Mechanisms", "Supply & Demand Curves", "The Treaty of Versailles".
- Titles should be immediately scannable — a student glancing at the navigation should know exactly what each section covers.

IMAGE HANDLING RULES (CRITICAL — when images are provided):

Each image you receive is a full-page screenshot of a PDF page. The fileName tells you exactly which page it came from, e.g. "textbook.pdf — Page 14". Use this page number to connect each image to the correct place in the notes.

STEP 1 — PAGE MAPPING (do this first, before writing any notes):
Read all the image fileNames you received. Make a mental map of which page number corresponds to which image index (0, 1, 2...). As you generate notes for content that came from that page, place the figure placeholder in the right section.

STEP 2 — IDENTIFY WHAT IS EDUCATIONALLY USEFUL ON THE PAGE:
Each screenshot is a full page — it may contain text, graphs, diagrams, tables, charts, worked examples, or decorative elements. You must decide what on that page is worth surfacing as a visual aid. Ask yourself: would a student benefit from seeing this image alongside the notes? If the page is mostly text the student already has, skip the image. If the page contains a graph, diagram, chart, or visual that adds meaning beyond the text, embed it.

STEP 3 — CLASSIFY AND HANDLE:

GRAPH or DIAGRAM (axes, plotted lines, labeled illustrations, scientific figures):
- Write a lead-in sentence before the figure: "The graph below shows [what it depicts and why it matters for this concept]."
- Embed: <figure data-image-index="N"><figcaption>[2 sentence caption: what the visual shows AND what the student should take away from it]</figcaption></figure>
- After the figure, write 1-2 sentences connecting what they just saw back to the concept in the notes

CHART or TABLE (data comparison, classification, results):
- Embed the figure placeholder
- Recreate the data as a proper HTML <table> with <thead> and <tbody> directly below the figure
- If the table was corrupted or missing in the text extraction, reconstruct it from your knowledge of the subject and the page image
- Caption should explain what the table is comparing or showing

WORKED EXAMPLE or MATH (image shows equations, solutions, or step-by-step work):
- Transcribe every equation visible into proper HTML
- Work through it completely using the math-stepper format
- Embed the figure as a reference: <figure data-image-index="N"><figcaption>Source material: worked example from page [N]</figcaption></figure>

DECORATIVE or TEXT-ONLY PAGE (stock photo, purely aesthetic, or page with no visual content beyond what text extraction already covered):
- Skip entirely. Do not use a figure placeholder. Do not mention it.

STEP 4 — PLACEMENT:
- Place each figure at the exact point in the notes where it is most relevant — next to the concept it illustrates
- Never dump all figures at the end of a section
- Never place a figure before you have introduced the concept it relates to
- If a page image spans multiple concepts, place it at the start of the first concept it relates to

CAPTION RULES:
- Never write "Figure 1" or "Image showing..." as a caption
- Always explain what the student should understand FROM looking at the image
- Connect it explicitly to the surrounding concept
- Minimum 2 sentences per caption

SELF-VERIFICATION (do this internally before finalizing output):
After generating the notes, verify:
1. Every heading and section from the source is represented
2. No facts, dates, names, or formulas were omitted
3. Nothing was added from outside the source material
4. All images/figures were handled
Output as a hidden HTML comment at the very end of your output:
<!-- verification: sections_covered: [count], key_terms_preserved: [count], hallucination_check: pass -->

STUDY TOOL RECOMMENDATIONS:
At the very end of the notes (after all content sections), add a hidden div for the UI to parse:
<div class="study-tool-recommendations" style="display:none" data-recommendations='["tool_id_1","tool_id_2"]'></div>
Choose 2-3 tools from this list based on the content analysis:
- "flashcards" if many key terms or definitions
- "flowchart" if sequential processes, procedures, or cycles
- "retention_quiz" if exam-prep content with testable facts
- "mindmap" if conceptual content with many interconnected ideas
- "cloze_notes" if dense terminology that needs active recall

CRITICAL JSON GENERATION RULES (STRICT ENFORCEMENT):
If you are asked to generate Mind Map or Flow Chart JSON, you will be heavily penalized if you violate these rules:
1. You MUST write 3-5 complete sentences of factual study context for the "detailed_info" field of EVERY single node.
2. NEVER leave "detailed_info" blank. NEVER use generic placeholders like "Details go here."
3. DO NOT wrap the JSON in markdown code fences (\`\`\`json). Output the raw JSON object directly inside the hidden div.${formatStr}${extrasStr}${instructionsStr}${profileStr}${ageStr}`;

    // ── Chapter-aware generation ──
    // When chapterContext is provided, the AI is generating notes for one
    // specific chapter of a larger book/document.  The <h1> title MUST
    // match the chapter title so users can find it in their library.
    let chapterPrompt = "";
    if (chapterContext && typeof chapterContext === "object") {
      const { chapterTitle, chapterIndex, totalChapters, bookTitle } = chapterContext as {
        chapterTitle?: string;
        chapterIndex?: number;
        totalChapters?: number;
        bookTitle?: string;
      };
      if (chapterTitle) {
        chapterPrompt = `\n\nCHAPTER CONTEXT (CRITICAL):
You are generating notes for a specific chapter of a larger document.
Book/Document: "${bookTitle || "Unknown"}"
Chapter ${(chapterIndex ?? 0) + 1} of ${totalChapters || "?"}: "${chapterTitle}"

TITLE RULE: Your <h1> tag MUST be exactly: "${chapterTitle}"
Do NOT title the notes after the whole book. Do NOT use a generic title.
Focus exclusively on the content provided for this chapter.`;
      }
    }

    let imageInstruction = "";
    if (hasImages) {
      // Build a manifest grouped by source file so the AI can match images to content
      const validImages = images
        .slice(0, 10)
        .filter((img: any) => img.data && typeof img.data === "string" && typeof img.mimeType === "string")
        .slice(0, validImageCount);

      // Group images by source file
      const fileGroups = new Map<string, Array<{ index: number; fileName: string }>>();
      validImages.forEach((img: any, i: number) => {
        const name = img.fileName || "unknown";
        // Extract the base file name (before " — Page")
        const baseFile = name.includes(" — ") ? name.split(" — ")[0] : name;
        if (!fileGroups.has(baseFile)) fileGroups.set(baseFile, []);
        fileGroups.get(baseFile)!.push({ index: i, fileName: name });
      });

      let manifest = "";
      for (const [baseFile, imgs] of fileGroups) {
        manifest += `\n  FROM "${baseFile}":\n`;
        for (const img of imgs) {
          manifest += `    Image ${img.index}: "${img.fileName}"\n`;
        }
      }

      imageInstruction = `

IMAGE MANIFEST — you received ${validImageCount} image(s) from ${fileGroups.size} source file(s):
${manifest}
CRITICAL IMAGE-TO-CONTENT MATCHING RULES:
1. Images are grouped by their SOURCE FILE above. Match each image ONLY to content from the SAME source file. An image from "anatomy.pdf" must NEVER be placed in a section generated from "heart.pdf" content.
2. The text content is also labeled by source file (e.g., "--- Content from anatomy.pdf ---"). Use these labels to match images to the correct file's content sections.
3. LOOK AT EACH IMAGE CAREFULLY. Identify what it depicts. Place it ONLY in the section discussing that specific concept.
4. If an image shows content that spans multiple sections from the same file, place it at the FIRST relevant section.
5. If an image is purely text with no diagrams or visual elements, SKIP IT.
6. Use <figure data-image-index="N"> where N is the image number (0 through ${validImageCount - 1}).
7. Write a 2-sentence caption: what the image shows AND how it connects to the surrounding content.
8. NEVER place all images at the end. They must be inline with their relevant content.
9. NEVER mix images between source files. This is the most common error — double-check the source file name before placing each image.`;
    }

    contentParts.unshift({
      type: "text",
      text: `Transform the following study material into brain-friendly notes. Your job is not just to reformat — it is to make the content genuinely understandable for a student who learns differently. Follow these priorities in order: First, explain concepts clearly before showing formulas or procedures. Second, work out example problems completely step by step — never show just an answer. Third, reconstruct any math or content that was corrupted or lost during PDF extraction using the surrounding context and your knowledge of the subject. Fourth, do not reproduce raw answer key lists — instead, select representative problems and work them out fully. Fifth, if a section heading exists but its content is missing or garbled, fill the gap using your subject knowledge and mark it with the gap-filled class. The goal is notes a student can actually learn from, not a reformatted copy of the source.${imageInstruction}${chapterPrompt}`,
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