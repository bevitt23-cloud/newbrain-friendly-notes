// Shared AI caller with Gemini-first, Claude-fallback logic.
// Works for both streaming and non-streaming calls.

export interface CallAIOptions {
  systemPrompt: string;
  messages: Array<{ role: string; content: string | any[] }>;
  stream?: boolean;
  maxTokens?: number;
  model?: string; // ignored — always uses gemini then claude
}

interface CallAIResult {
  // For non-streaming: the response body as text content
  content: string;
}

interface CallAIStreamResult {
  body: ReadableStream<Uint8Array>;
}

/**
 * Convert OpenAI-style messages to Claude Messages API format.
 * Claude requires system to be a top-level param, not in messages.
 * Claude messages must alternate user/assistant and content must be string or content blocks.
 * Handles image_url types by converting to Anthropic's media_type/base64 format.
 */
function toClaudeMessages(messages: Array<{ role: string; content: string | any[] }>) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      // If content is an array, convert each part to Claude format
      if (Array.isArray(m.content)) {
        const blocks = m.content.map((part: any) => {
          // Handle text content
          if (part.type === "text") {
            return { type: "text" as const, text: part.text };
          }
          // Handle image_url by converting to Anthropic format
          if (part.type === "image_url") {
            const url = part.image_url?.url || "";
            // Check if it's a data URI (base64 embedded image)
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.*)$/);
              if (match) {
                const mimeType = match[1];
                const base64Data = match[2];
                return {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: base64Data,
                  },
                };
              }
            }
            // For non-data URIs, fall back to text representation (URLs not supported by Claude for images)
            return { type: "text" as const, text: `[Image: ${url}]` };
          }
          // For unknown types, convert to text
          return { type: "text" as const, text: JSON.stringify(part) };
        });
        return { role: m.role === "assistant" ? "assistant" : "user", content: blocks };
      }
      return { role: m.role === "assistant" ? "assistant" : "user", content: m.content as string };
    });
}

// ─── Non-streaming call ───

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const { systemPrompt, messages, maxTokens = 4096 } = opts;

  const GOOGLE_API_KEY = Deno.env.get("GEMINI_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_KEY");

  // ── Attempt 1: Gemini (OpenAI-compatible endpoint) ──
  if (GOOGLE_API_KEY) {
    try {
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GOOGLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.5-flash",
            messages: allMessages,
            stream: false,
            max_tokens: maxTokens,
          }),
        },
      );

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "";
        return { content };
      }

      console.error("Gemini error:", resp.status, await resp.text());
    } catch (err) {
      console.error("Gemini call threw:", err);
    }
  }

  // ── Attempt 2: Claude ──
  if (ANTHROPIC_API_KEY) {
    try {
      const claudeMessages = toClaudeMessages(messages);

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: claudeMessages,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const content =
          data.content?.map((b: any) => b.text).join("") || "";
        return { content };
      }

      console.error("Claude error:", resp.status, await resp.text());
    } catch (err) {
      console.error("Claude call threw:", err);
    }
  }

  throw new Error(
    "All AI models are currently unavailable. Please try again in a moment.",
  );
}

// ─── Streaming call (returns raw Response body) ──
// Tries Gemini streaming first, falls back to Claude (non-streaming wrapped as SSE).

export async function callAIStream(
  opts: CallAIOptions,
): Promise<CallAIStreamResult> {
  const { systemPrompt, messages, maxTokens } = opts;

  const GOOGLE_API_KEY = Deno.env.get("GEMINI_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_KEY");

  // ── Attempt 1: Gemini streaming ──
  if (GOOGLE_API_KEY) {
    try {
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GOOGLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.5-flash",
            messages: allMessages,
            stream: true,
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
          }),
        },
      );

      if (resp.ok && resp.body) {
        return { body: resp.body };
      }

      console.error("Gemini stream error:", resp.status, await resp.text());
    } catch (err) {
      console.error("Gemini stream threw:", err);
    }
  }

  // ── Attempt 2: Claude streaming ──
  if (ANTHROPIC_API_KEY) {
    try {
      const claudeMessages = toClaudeMessages(messages);

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens || 8192,
          system: systemPrompt,
          messages: claudeMessages,
          stream: true,
        }),
      });

      if (resp.ok && resp.body) {
        // Claude SSE uses a different event format — transform to OpenAI-compatible SSE
        const reader = resp.body.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async pull(controller) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }

              const text = decoder.decode(value, { stream: true });
              // Parse Claude SSE events and convert to OpenAI format
              const lines = text.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                try {
                  const evt = JSON.parse(jsonStr);
                  if (evt.type === "content_block_delta" && evt.delta?.text) {
                    const oaiChunk = {
                      choices: [{ delta: { content: evt.delta.text } }],
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(oaiChunk)}\n\n`),
                    );
                  }
                } catch {
                  // skip unparseable lines
                }
              }
            }
          },
        });

        return { body: stream };
      }

      console.error("Claude stream error:", resp.status, await resp.text());
    } catch (err) {
      console.error("Claude stream threw:", err);
    }
  }

  throw new Error(
    "All AI models are currently unavailable. Please try again in a moment.",
  );
}
