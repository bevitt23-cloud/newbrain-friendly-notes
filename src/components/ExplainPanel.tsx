import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Loader2, X, Send, ChevronDown, ChevronUp, Sparkles, MessageCircleQuestion, Quote } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
// Add the supabase client import
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExplainPanelProps {
  selectedText: string;
  notesContext?: string;
  open: boolean;
  onClose: () => void;
}

const ASSISTANT_SECTION_THEMES = [
  {
    card: "border-sage-200 bg-sage-50 dark:border-sage-300/20 dark:bg-sage-500/10",
    badge: "bg-sage-100 text-sage-700 dark:bg-sage-400/15 dark:text-sage-200",
    icon: "text-sage-500 dark:text-sage-300",
  },
  {
    card: "border-sky-200 bg-sky-50 dark:border-sky-300/20 dark:bg-sky-400/10",
    badge: "bg-sky-100 text-sky-400 dark:bg-sky-400/15 dark:text-sky-200",
    icon: "text-sky-400 dark:text-sky-200",
  },
  {
    card: "border-lavender-200 bg-lavender-50 dark:border-lavender-300/20 dark:bg-lavender-400/10",
    badge: "bg-lavender-100 text-lavender-500 dark:bg-lavender-400/15 dark:text-lavender-200",
    icon: "text-lavender-500 dark:text-lavender-200",
  },
  {
    card: "border-peach-200 bg-peach-50 dark:border-peach-300/20 dark:bg-peach-400/10",
    badge: "bg-peach-100 text-peach-500 dark:bg-peach-400/15 dark:text-peach-200",
    icon: "text-peach-500 dark:text-peach-200",
  },
] as const;

function splitIntoSections(content: string): string[] {
  return content
    .split(/(?:\n\s*\n|<br\s*\/?>\s*<br\s*\/?>)/i)
    .map((section) => section.trim())
    .filter(Boolean);
}

function renderSectionContent(section: string): ReactNode {
  if (/<[a-z][\s\S]*>/i.test(section)) {
    return <div className="explain-rich-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section) }} />;
  }

  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines.every((line) => /^[-•*]/.test(line) || /^\d+[.)]/.test(line))) {
    return (
      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{line.replace(/^([-•*]|\d+[.)])\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="text-sm leading-relaxed text-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

const ExplainPanel = ({ selectedText, notesContext, open, onClose }: ExplainPanelProps) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (open && selectedText) {
      setChatMessages([]);
      setChatInput("");
      setMinimized(false);
      void handleExplain();
    }
  }, [open, selectedText]);

  const handleExplain = async () => {
    setIsExplaining(true);
    try {
      // Get the active user session token
      const { data: { session } } = await supabase.auth.getSession();
      const token =
        session?.access_token ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Use the secure token here
          },
          body: JSON.stringify({ text: selectedText, context: notesContext?.slice(0, 2000) }),
        }
      );
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setChatMessages([{ role: "assistant", content: data.explanation }]);
    } catch {
      setChatMessages([{ role: "assistant", content: "Could not explain this text. Please try again." }]);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleFollowUp = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: question }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      // Get the active user session token
      const { data: { session } } = await supabase.auth.getSession();
      const token =
        session?.access_token ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Use the secure token here
          },
          body: JSON.stringify({
            text: selectedText,
            followUp: question,
            chatHistory: newMessages,
            context: notesContext?.slice(0, 2000),
          }),
        }
      );
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.explanation }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-3xl px-4 pb-4"
        >
          <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/30">
            <div
              className="cursor-pointer border-b border-sage-200/70 bg-gradient-to-r from-sage-50 via-sky-50 to-lavender-50 px-5 py-3.5 dark:border-sage-300/15 dark:from-sage-500/12 dark:via-sky-400/10 dark:to-lavender-400/10"
              onClick={() => setMinimized(!minimized)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <Lightbulb className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary shadow-sm dark:bg-background/50">
                        <Sparkles className="h-3 w-3" /> Explain This
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:bg-background/40">
                        <Quote className="h-3 w-3" /> Selected text
                      </span>
                    </div>
                    <p className="line-clamp-2 max-w-2xl text-sm font-medium leading-relaxed text-foreground">
                      “{selectedText}”
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground dark:hover:bg-background/40">
                    {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground dark:hover:bg-background/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {!minimized && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-[28rem] space-y-4 overflow-y-auto px-5 py-4">
                    {isExplaining && chatMessages.length === 0 && (
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Thinking...
                      </div>
                    )}

                    {chatMessages.map((msg, i) => {
                      if (msg.role === "assistant") {
                        const theme = ASSISTANT_SECTION_THEMES[i % ASSISTANT_SECTION_THEMES.length];
                        const sections = splitIntoSections(msg.content);

                        return (
                          <div key={i} className="space-y-3">
                            {sections.map((section, sectionIndex) => (
                              <div
                                key={`${i}-${sectionIndex}`}
                                className={`rounded-2xl border p-4 shadow-sm ${theme.card}`}
                              >
                                <div className="mb-3 flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${theme.badge}`}>
                                    <MessageCircleQuestion className={`h-3.5 w-3.5 ${theme.icon}`} />
                                    {sectionIndex === 0 ? "Main idea" : `Detail ${sectionIndex}`}
                                  </span>
                                </div>
                                {renderSectionContent(section)}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={i}
                          className="ml-6 rounded-2xl border border-border bg-secondary/55 px-4 py-3 text-sm text-secondary-foreground"
                        >
                          {msg.content}
                        </div>
                      );
                    })}

                    {isChatLoading && (
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Thinking...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="border-t border-border bg-muted/20 px-5 py-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 px-4 py-2.5 dark:bg-background/60">
                      <input
                        id="explain-follow-up"
                        name="explainFollowUp"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleFollowUp();
                          }
                        }}
                      />
                      <button
                        onClick={handleFollowUp}
                        disabled={!chatInput.trim() || isChatLoading}
                        className="rounded-xl p-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExplainPanel;