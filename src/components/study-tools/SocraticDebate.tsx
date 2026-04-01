import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Flag, MessageCircle } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { useTelemetry } from "@/hooks/useTelemetry";
import { supabase } from "@/integrations/supabase/client";

const DEBATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-tool`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SocraticDebate({ notesHtml }: { notesHtml: string }) {
  const { track } = useTelemetry();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (userMsg?: string) => {
    const text = userMsg || input.trim();
    if (!text && started) return;

    const newMessages: Message[] = started
      ? [...messages, { role: "user", content: text }]
      : [];

    if (started) {
      setMessages(newMessages);
      const userTurns = newMessages.filter((m) => m.role === "user").length;
      track("socratic_turn", { turnNumber: userTurns, topic: notesHtml.slice(0, 100) });
    }
    setInput("");
    setLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      const resp = await fetch(DEBATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tool: "socratic",
          notesHtml,
          conversationHistory: newMessages,
        }),
      });

      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setMessages([...newMessages, { role: "assistant", content: data.result }]);
      if (!started) setStarted(true);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Hmm, I had trouble thinking. Try again!" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleYield = () => {
    const totalTurns = messages.filter((m) => m.role === "user").length;
    track("socratic_session_end", { totalTurns, topic: notesHtml.slice(0, 100) });
    sendMessage("I yield! Please reveal the key answer and summarize what we discussed.");
  };

  return (
    <div className="flex flex-col h-[55vh]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-lavender-200 to-lavender-300 dark:from-lavender-500/30 dark:to-lavender-400/20 flex items-center justify-center text-sm">
            🧐
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Socrates Bot</p>
            <p className="text-[10px] text-muted-foreground">Argue with me to learn</p>
          </div>
        </div>
        {started && (
          <button
            onClick={handleYield}
            className="flex items-center gap-1.5 rounded-full border border-peach-200 dark:border-peach-200/30 bg-peach-50 dark:bg-peach-500/10 px-3 py-1.5 text-xs font-semibold text-peach-500 dark:text-peach-300 hover:bg-peach-100 dark:hover:bg-peach-500/20 transition-colors"
          >
            <Flag className="h-3 w-3" />
            Yield
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {!started && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-lavender-100 to-peach-100 dark:from-lavender-500/20 dark:to-peach-500/15 flex items-center justify-center text-2xl">
              🧐
            </div>
            <p className="text-sm font-semibold text-foreground">Ready to debate?</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              I'll challenge your understanding of the material. Defend your knowledge!
            </p>
            <button
              onClick={() => sendMessage("Start the debate!")}
              className="rounded-xl bg-gradient-to-r from-lavender-400 to-lavender-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
            >
              <MessageCircle className="inline h-4 w-4 mr-1.5" />
              Start Debate
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-primary to-sage-500 text-primary-foreground rounded-br-md"
                  : "bg-lavender-50 dark:bg-lavender-500/10 border border-lavender-200 dark:border-lavender-200/30 text-foreground rounded-bl-md"
              }`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>")) }}
            />
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-lavender-50 dark:bg-lavender-500/10 border border-lavender-200 dark:border-lavender-200/30 px-4 py-3 flex gap-1">
              <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="h-2 w-2 rounded-full bg-lavender-400" />
              <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="h-2 w-2 rounded-full bg-lavender-400" />
              <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="h-2 w-2 rounded-full bg-lavender-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {started && (
        <div className="mt-3 flex gap-2">
          <input
            id="socratic-message"
            name="socraticMessage"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Defend your understanding..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-sm disabled:opacity-40 transition-all hover:shadow-md"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
