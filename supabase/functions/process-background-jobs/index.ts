import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/callAI.ts";

type BackgroundJob = {
  id: string;
  user_id: string;
  content_chunk: string;
  folder: string;
  tags: string[] | null;
  instructions: string | null;
  learning_mode: string | null;
  extras: string[] | null;
  profile_prompt: string | null;
  age: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-background-job-secret",
};

function buildModePrompt(learningMode: string | null): string {
  if (learningMode === "dyslexia") {
    return `
Format for a reader with dyslexia:
- Use short, simple sentences.
- Use clear section headers and frequent sub-headings.
- Prefer bullet points over dense paragraphs.
- Keep each bullet concise and easy to scan.
- Use plain language and avoid unnecessary jargon.
- Every <section> must contain at least one <h3> sub-heading.
- Break paragraphs after every 1-2 sentences maximum.`;
  }

  return `
Format for a reader with ADHD:
- Use chunked, color-coded sections with clear headers.
- Start each section with a one-line hook or "why this matters" statement.
- Use bullet points, not paragraphs.
- Keep each bullet under 20 words.
- Add emoji icons to section headers for visual anchoring.
- Include a "⚡ TL;DR" section at the very top (3-5 bullet summary).
- Every <section> must contain at least one <h3> sub-heading to further categorize the information.
- Break paragraphs after every 1-2 sentences maximum to maximize white space.
- CRITICAL FORMATTING FOR ADHD READABILITY:
  - Set generous spacing between all elements — no dense walls of text.
  - Keep text columns narrow. Never let content stretch across the full width.
  - Use line height of at least 1.6 between lines.
  - Add visual breathing room between sections.`;
}

function buildSystemPrompt(job: BackgroundJob): string {
  const modePrompt = buildModePrompt(job.learning_mode);
  const extrasList = Array.isArray(job.extras) && job.extras.length > 0
    ? `\n\nExtra study tools requested: ${job.extras.join(", ")}. Include all requested tools in the output.`
    : "";
  const instructionsStr = job.instructions
    ? `\n\nUser instructions (highest priority): ${job.instructions}`
    : "";
  const profileStr = job.profile_prompt
    ? `\n\nUser cognitive profile: ${job.profile_prompt}`
    : "";
  const ageStr = typeof job.age === "number"
    ? `\n\nThe learner is approximately ${job.age} years old. Adjust vocabulary and complexity accordingly.`
    : "";

  return `You are an expert study note generator. Your job is to transform raw study material into comprehensive, well-organized notes.

CRITICAL RULES:
1. Do NOT lose any information. Every fact, concept, and detail must be preserved.
2. You are ONLY reformatting and reorganizing — not summarizing or cutting content.
3. For technical jargon or domain-specific terms, wrap them in: <span class="jargon" data-definition="PLAIN ENGLISH DEFINITION HERE">term</span>. The definition should be a short, simple explanation (1-2 sentences max). Keep the term in context naturally.

MICRO-CHUNKING RULE (MANDATORY):
- Any single <section> MUST NOT exceed 150 words of content.
- If a topic contains more than 150 words of information, you MUST split it into multiple <section> tags.
- Each new <section> must continue cycling through the data-section-color attributes: "sage", "lavender", "peach", "sky", "amber".
- You must still preserve ALL information when splitting — nothing may be lost or summarized away.

${modePrompt}

OUTPUT FORMAT:
Return valid HTML using: <h1>, <section>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <span>.
CRITICAL: NEVER use markdown syntax like **bold** or *italic* — ALWAYS use HTML tags <strong> and <em> instead. Output MUST be pure HTML, not markdown.
CRITICAL: Start with a single <h1> tag containing a clear, descriptive title based on the subject.
CRITICAL: Wrap EACH major section in a <section data-section-color="COLOR"> tag, where COLOR cycles through: "sage", "lavender", "peach", "sky", "amber".
Wrap the entire output in a single <div>.${extrasList}${instructionsStr}${profileStr}${ageStr}`;
}

function cleanGeneratedHtml(raw: string): string {
  return raw
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const raw = titleMatch?.[1] ?? "Background Processed Notes";
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Background Processed Notes";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("PROCESS_BACKGROUND_JOBS_SECRET");
  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: "Missing PROCESS_BACKGROUND_JOBS_SECRET configuration." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const providedSecret = req.headers.get("x-background-job-secret");
  if (providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: claimedRows, error: claimRpcError } = await supabaseAdmin
      .rpc("claim_next_background_job");

    if (claimRpcError) throw claimRpcError;

    if (!claimedRows || claimedRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending jobs found." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const job = claimedRows[0] as BackgroundJob;

    try {
      const aiResult = await callAI({
        systemPrompt: buildSystemPrompt(job),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transform ALL the content from the following material into brain-friendly study notes. Extract every piece of information.",
              },
              {
                type: "text",
                text: job.content_chunk,
              },
            ],
          },
        ],
        maxTokens: 8192,
      });

      const html = cleanGeneratedHtml(aiResult.content);

      if (!html) {
        throw new Error("AI returned empty content.");
      }

      const title = extractTitle(html);

      const { error: saveError } = await supabaseAdmin
        .from("saved_notes")
        .insert({
          user_id: job.user_id,
          title,
          content: html,
          source_type: "generated",
          learning_mode: job.learning_mode || "adhd",
          folder: job.folder || "Unsorted",
          tags: job.tags || [],
          sticky_notes: [],
          saved_videos: [],
        });

      if (saveError) throw saveError;

      const { error: completeError } = await supabaseAdmin
        .from("background_jobs")
        .update({ status: "completed", error_message: null })
        .eq("id", job.id);

      if (completeError) throw completeError;

      return new Response(
        JSON.stringify({
          message: "Processed one background job.",
          job_id: job.id,
          saved_note_title: title,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (jobError) {
      const msg = jobError instanceof Error ? jobError.message : "Unknown processing error";
      await supabaseAdmin
        .from("background_jobs")
        .update({ status: "failed", error_message: msg.slice(0, 1000) })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({ error: msg, job_id: job.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("process-background-jobs error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
