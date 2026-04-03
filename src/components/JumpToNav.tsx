import { useState } from "react";
import { List, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NavSection } from "@/hooks/useJumpToNav";

interface JumpToNavProps {
  sections: NavSection[];
  activeSectionId: string | null;
  onScrollTo: (id: string) => void;
  className?: string;
}

const JumpToNav = ({
  sections,
  activeSectionId,
  onScrollTo,
  className = "",
}: JumpToNavProps) => {
  const [expanded, setExpanded] = useState(false);

  // Don't render if there are fewer than 2 sections
  if (sections.length < 2) return null;

  const truncate = (text: string, max = 25) =>
    text.length > max ? text.slice(0, max) + "\u2026" : text;

  return (
    <div
      className={`fixed right-4 top-1/2 -translate-y-1/2 z-[45] flex flex-col items-end ${className}`}
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          /* ── Collapsed icon button ── */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            onClick={() => setExpanded(true)}
            title="Jump to section"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/90 shadow-lg backdrop-blur-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <List className="h-4.5 w-4.5" />
          </motion.button>
        ) : (
          /* ── Expanded panel ── */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: 12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.95 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-56 max-h-[60vh] overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xl backdrop-blur-md flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Jump to
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Section list */}
            <ul className="overflow-y-auto py-1.5 px-1.5 flex-1 scrollbar-thin">
              {sections.map((section) => {
                const isActive = section.id === activeSectionId;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => {
                        onScrollTo(section.id);
                        setExpanded(false);
                      }}
                      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      {/* Active indicator dot */}
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                          isActive
                            ? "bg-primary"
                            : "bg-transparent group-hover:bg-muted-foreground/30"
                        }`}
                      />
                      <span className="truncate">{truncate(section.title)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JumpToNav;
