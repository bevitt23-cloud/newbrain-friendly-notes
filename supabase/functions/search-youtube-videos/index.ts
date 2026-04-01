import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildRationale, parseVideoResults } from "../_shared/youtubeSearchParser.ts";
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

    const { query } = await req.json();
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
      return new Response(JSON.stringify({ error: "Missing video search query." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const INNERTUBE_API_KEY = Deno.env.get("INNERTUBE_API_KEY");
    if (!INNERTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: "YouTube API key not configured. Set INNERTUBE_API_KEY in Supabase secrets." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const searchUrl = `https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_API_KEY}`;
    const searchBody = {
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
        },
      },
      query: normalizedQuery,
      params: "EgIQAQ%3D%3D",
    };

    const resp = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!resp.ok) {
      const details = await resp.text();
      console.error("YouTube search failed:", resp.status, details);
      return new Response(JSON.stringify({ error: "Could not fetch explainer videos right now." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const videos = parseVideoResults(data).map((video, index) => ({
      ...video,
      rationale: buildRationale(normalizedQuery, video.title, video.duration, index),
    }));

    if (videos.length === 0) {
      return new Response(JSON.stringify({ error: "No explainer videos found for this topic." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("search-youtube-videos error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});