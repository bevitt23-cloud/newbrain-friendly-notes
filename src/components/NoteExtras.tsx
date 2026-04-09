import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, SlidersHorizontal, Youtube, Network, GitBranch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NoteInclude {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  icon?: LucideIcon;
  color: string;
}

const noteIncludes: NoteInclude[] = [
  { id: "tldr", label: "TL;DR", emoji: "📌", color: "border-sage-500 bg-sage-200 text-sage-700 dark:border-sage-300/40 dark:bg-sage-500/25 dark:text-sage-200" },
  { id: "jargon", label: "Jargon Decoder", emoji: "📖", color: "border-amber-400 bg-amber-200 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/25 dark:text-amber-200" },
  { id: "retention_quiz", label: "Retention Quiz", emoji: "🧩", color: "border-sky-400 bg-sky-200 text-sky-700 dark:border-sky-200/40 dark:bg-sky-300/25 dark:text-sky-200" },
  
  { id: "feynman", label: "Feynman Check", emoji: "🧠", color: "border-peach-500 bg-peach-200 text-peach-600 dark:border-peach-300/40 dark:bg-peach-500/25 dark:text-peach-200" },
  { id: "recall", label: "Recall Prompts", emoji: "💭", color: "border-sky-400 bg-sky-200 text-sky-700 dark:border-sky-200/40 dark:bg-sky-300/25 dark:text-sky-200" },
  { id: "simplify", label: "Write This Down", emoji: "✏️", color: "border-sage-500 bg-sage-200 text-sage-700 dark:border-sage-300/40 dark:bg-sage-500/25 dark:text-sage-200" },
  { id: "why_care", label: "Why Should I Care?", emoji: "🔥", color: "border-amber-400 bg-amber-200 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/25 dark:text-amber-200" },
  {
    id: "mindmap",
    label: "Mind Map",
    description: "Generates an interactive mind map visualization of key concepts and their relationships.",
    icon: Network,
    color: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  {
    id: "flowchart",
    label: "Process Flow",
    description: "Generates a step-by-step flowchart showing how concepts connect in sequence.",
    icon: GitBranch,
    color: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/20 dark:text-violet-200",
  },
  {
    id: "visual_learner",
    label: "Visual Learner (In-App Videos)",
    description: "Shows 3 tailored explainer videos in a built-in player without leaving your notes.",
    icon: Youtube,
    color: "border-red-300 bg-red-100 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-200",
  },
];

interface NoteExtrasProps {
  activeExtras: string[];
  onExtrasChange: (extras: string[]) => void;
  isLowBattery?: boolean;
}

const LOW_BATTERY_EXTRAS = new Set(["tldr", "jargon", "simplify"]);

const NoteExtras = ({ activeExtras, onExtrasChange, isLowBattery = false }: NoteExtrasProps) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: string) => {
    if (activeExtras.includes(id)) {
      onExtrasChange(activeExtras.filter((e) => e !== id));
    } else {
      onExtrasChange([...activeExtras, id]);
    }
  };

  const activeCount = activeExtras.length;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Note Add-ons</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {activeCount} active
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLowBattery && (
              <div className="flex items-center gap-2 pt-3 pb-1 text-xs text-amber-600 dark:text-amber-400">
                <span>🪫</span>
                <span className="font-medium">Low Battery Mode — only lightweight add-ons are active. Switch to Full Battery on your Insights page for all options.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-4">
              {noteIncludes.map((item, i) => {
                const disabledByBattery = isLowBattery && !LOW_BATTERY_EXTRAS.has(item.id);
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => !disabledByBattery && toggle(item.id)}
                    title={disabledByBattery ? `${item.label} — disabled in Low Battery mode` : item.description ?? item.label}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      disabledByBattery
                        ? "border-border bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                        : activeExtras.includes(item.id)
                          ? `${item.color} shadow-sm ring-1 ring-primary/20`
                          : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {item.icon ? <item.icon className="h-3.5 w-3.5" /> : <span>{item.emoji}</span>}
                    {item.label}
                    {disabledByBattery && <span className="text-[9px] opacity-60">🪫</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NoteExtras;
