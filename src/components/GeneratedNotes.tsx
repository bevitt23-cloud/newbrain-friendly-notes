import { useRef, useEffect, useState } from "react";
import { useBehavioralSensors } from "@/hooks/useBehavioralSensors";
import { motion } from "framer-motion";
import { RotateCcw, Save, Loader2, Sparkles, Download, Map, GitBranch, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextSelectionMenu from "@/components/TextSelectionMenu";
import type { StickyNoteData } from "@/components/TextSelectionMenu";
import JargonTooltip from "@/components/JargonTooltip";
import { useNotesInteractivity } from "@/hooks/useNotesInteractivity";
import { useJargonTooltip } from "@/hooks/useJargonTooltip";
import { useUserPreferences } from "@/hooks/useUserPreferences";

import FunFactLink from "@/components/study-tools/FunFactLink";
import { sanitizeHtml } from "@/lib/sanitize";
import RetentionQuiz from "@/components/study-tools/RetentionQuiz";
import type { QuizQuestion } from "@/hooks/useNoteGeneration";
import MindMap from "@/components/study-tools/MindMap";
import FlowChart from "@/components/study-tools/FlowChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InAppVideoModal from "@/components/InAppVideoModal";
import type { SavedExplainerVideo } from "@/components/InAppVideoModal";
import JumpToNav from "@/components/JumpToNav";
import { useJumpToNav } from "@/hooks/useJumpToNav";
import FloatingImageViewer from "@/components/FloatingImageViewer";
import { useMathSteppers } from "@/hooks/useMathSteppers";

interface GeneratedNotesProps {
  html: string;
  isGenerating: boolean;
  bionicEnabled: boolean;
  dyslexiaMode: boolean;
  dyslexiaSettings: {
    lineSpacing: number;
    fontSize: number;
    letterSpacing: number;
    wordSpacing: number;
  };
  onReset: () => void;
  onSave?: () => void;
  title?: string;
  quizQuestions?: QuizQuestion[];
  isGeneratingQuiz?: boolean;
  stickyNotes?: StickyNoteData[];
  onStickyNotesChange?: (notes: StickyNoteData[]) => void;
  savedVideos?: SavedExplainerVideo[];
  onSaveVideo?: (video: SavedExplainerVideo) => void;
  /** For behavioral telemetry — identifies which note the user is reading */
  noteId?: string;
  /** Source of the content being displayed */
  behaviorSource?: "generated" | "library_note" | "library_material" | "chapter";
  /** Material type when behaviorSource === "library_material" */
  materialType?: string;
}

function applyBionic(html: string): string {
  return html.replace(/>([^<]+)</g, (match, text: string) => {
    const bionicText = text.replace(/\b(\w{2,})\b/g, (word: string) => {
      const boldLen = Math.ceil(word.length * 0.4);
      return `<span class="bionic-bold" style="font-weight:700">${word.slice(0, boldLen)}</span>${word.slice(boldLen)}`;
    });
    return `>${bionicText}<`;
  });
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

const GeneratedNotes = ({
  html,
  isGenerating,
  bionicEnabled,
  dyslexiaMode,
  dyslexiaSettings,
  onReset,
  onSave,
  title,
  quizQuestions,
  isGeneratingQuiz,
  stickyNotes,
  onStickyNotesChange,
  savedVideos,
  onSaveVideo,
  noteId,
  behaviorSource,
  materialType,
}: GeneratedNotesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const [flowChartOpen, setFlowChartOpen] = useState(false);
  const [pipImage, setPipImage] = useState<{ src: string; alt: string } | null>(null);
  const [expandedTableHTML, setExpandedTableHTML] = useState<string | null>(null);
  const { preferences } = useUserPreferences();

  // Toggle dyslexia-active body class from global preferences
  useEffect(() => {
    document.body.classList.toggle("dyslexia-active", preferences.dyslexia_font);
  }, [preferences.dyslexia_font]);

  const jargonTooltip = useJargonTooltip(containerRef, html);

  useNotesInteractivity(containerRef, html);
  useMathSteppers(containerRef, html, isGenerating);
  const { sections: navSections, activeSectionId, scrollToSection } = useJumpToNav(containerRef, html);

  // Research behavioral sensors — tracks scroll thrashing, dwell time, etc.
  useBehavioralSensors(containerRef, {
    note_id: noteId,
    source: behaviorSource,
    material_type: materialType,
  });

  // Wrap every <table> in a scrollable container with an "Expand" button so
  // wide tables stay inside the notes column and the user can click to view
  // the full table in a large dialog.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isGenerating) return;

    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const parent = table.parentElement;
      if (parent && parent.classList.contains("note-table-wrapper")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "note-table-wrapper";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-table-expand";
      btn.title = "Click to enlarge table";
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>Expand';
      wrapper.appendChild(btn);
    });
  }, [html, isGenerating]);

  const handleNoteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Handle explainer video button clicks
    const btn = target.closest("button.watch-explainer") as HTMLElement | null;
    if (btn) {
      e.preventDefault();
      const query = btn.getAttribute("data-query");
      if (query) setVideoQuery(query);
      return;
    }

    // Handle image clicks — open PIP viewer (clicking anywhere on the figure)
    const noteImage = target.closest(".note-image") as HTMLElement;
    if (noteImage) {
      e.preventDefault();
      const img = noteImage.querySelector("img") as HTMLImageElement;
      if (img) {
        setPipImage({ src: img.src, alt: img.alt || "Image" });
      }
      return;
    }

    // Handle table expand — clicking the "Expand" button enlarges the table
    const expandBtn = target.closest(".note-table-expand") as HTMLElement | null;
    if (expandBtn) {
      e.preventDefault();
      const wrapper = expandBtn.closest(".note-table-wrapper");
      const table = wrapper?.querySelector("table");
      if (table) setExpandedTableHTML(table.outerHTML);
      return;
    }
  };

  const processedHtml = sanitizeHtml(bionicEnabled ? applyBionic(html) : html);
  const plainTextContext = html ? stripHtml(html) : undefined;

  // Build font styles from global preferences with prop fallback
  const resolvedDyslexia = preferences.dyslexia_font || dyslexiaMode;
  const resolvedAdhd = preferences.adhd_font;

  const fontFamily = resolvedDyslexia
    ? "'OpenDyslexic', 'Comic Sans MS', sans-serif"
    : resolvedAdhd
      ? "'Lexend', sans-serif"
      : "'Arial', 'Helvetica Neue', sans-serif";

  const dyslexiaStyles: React.CSSProperties = resolvedDyslexia
    ? {
        fontFamily,
        lineHeight: dyslexiaSettings.lineSpacing,
        fontSize: `${dyslexiaSettings.fontSize}rem`,
        letterSpacing: `${dyslexiaSettings.letterSpacing}em`,
        wordSpacing: `${dyslexiaSettings.wordSpacing}em`,
      }
    : { fontFamily };

  // Extract title from h1 first, then h2 fallback
  const autoTitle = title || (() => {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const tmp = document.createElement("div");
      tmp.innerHTML = h1Match[1];
      return tmp.textContent?.trim() || "Study Notes";
    }
    const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      const tmp = document.createElement("div");
      tmp.innerHTML = h2Match[1];
      return tmp.textContent?.replace(/[^\w\s]/g, "").trim() || "Study Notes";
    }
    return "Study Notes";
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6">
      
      {/* Title bar */}
      <div className="mb-5 flex items-start justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-lavender-500 shadow-md">
              <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                {autoTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isGenerating ? "Generating..." : "Highlight text for quick actions"}
              </p>
              {!isGenerating && html &&
              <div className="mt-1">
                  <FunFactLink topic={autoTitle} context={html} />
                </div>
              }
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {!isGenerating && html.includes('mindmap-data') && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMindMapOpen(true)}>
              <Map className="h-3.5 w-3.5" />
              Mind Map
            </Button>
          )}
          {!isGenerating && html.includes('flowchart-data') && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFlowChartOpen(true)}>
              <GitBranch className="h-3.5 w-3.5" />
              Process Flow
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            New
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            const printWindow = window.open("", "_blank");
            if (!printWindow) return;
            const styles = Array.from(document.styleSheets).
            map((sheet) => {
              try {
                return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
              } catch {return "";}
            }).
            join("\n");
            printWindow.document.write(`<!DOCTYPE html><html><head><title>${autoTitle}</title>
              <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
              <link href="https://fonts.cdnfonts.com/css/open-dyslexic" rel="stylesheet">
              <style>${styles}</style>
              <style>
                body { max-width: 720px; margin: 40px auto; padding: 0 24px; }
                @media print { body { margin: 0; } section { break-inside: avoid; } }
              </style></head><body><div class="generated-notes">${processedHtml}</div></body></html>`);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
          }}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          {onSave &&
          <Button size="sm" className="gap-1.5" onClick={onSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          }
        </div>
      </div>

      {/* Notes content */}
      <div className="relative">
        <TextSelectionMenu
          containerRef={containerRef}
          notesContext={plainTextContext}
          onVideoQuery={setVideoQuery}
          stickyNotes={stickyNotes}
          onStickyNotesChange={onStickyNotesChange}
        />
        <JargonTooltip tooltip={jargonTooltip} />
        <div
          ref={containerRef}
          onClick={handleNoteClick}
          className={`generated-notes max-w-none rounded-2xl border border-border p-6 md:p-8 shadow-sm select-text cursor-text bg-card${isGenerating ? ' generating' : ''}`}
          style={dyslexiaStyles}
          dangerouslySetInnerHTML={{ __html: processedHtml }} />

      </div>

      {/* Jump-to section navigation */}
      {!isGenerating && navSections.length >= 2 && (
        <JumpToNav
          sections={navSections}
          activeSectionId={activeSectionId}
          onScrollTo={scrollToSection}
        />
      )}

      {isGenerating &&
      <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Generating your notes...
          </div>
          <div className="mx-auto max-w-md rounded-xl bg-sage-50 dark:bg-sage-500/10 border border-sage-200 dark:border-sage-500/20 px-4 py-3 text-center">
            <p className="text-xs text-sage-600 dark:text-sage-300 leading-relaxed">
              Hang tight! Your notes are being built. Study tools like quizzes, mind maps, and the text selection menu will be ready once generation is complete.
            </p>
          </div>
        </div>
      }

      {/* Retention Quiz */}
      {!isGenerating && quizQuestions && quizQuestions.length > 0 &&
      <RetentionQuiz questions={quizQuestions} topic={autoTitle} notesContext={html} />
      }
      {isGeneratingQuiz && !isGenerating &&
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Generating retention quiz...
        </div>
      }

            {videoQuery && (
              <InAppVideoModal
                searchQuery={videoQuery}
                onClose={() => setVideoQuery(null)}
                savedVideos={savedVideos}
                onSaveVideo={onSaveVideo}
              />
            )}

      {/* PIP Image Viewer */}
      {pipImage && (
        <FloatingImageViewer
          src={pipImage.src}
          alt={pipImage.alt}
          onClose={() => setPipImage(null)}
        />
      )}

      {/* Mind Map Dialog */}
      <Dialog open={mindMapOpen} onOpenChange={setMindMapOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Map className="h-5 w-5 text-lavender-500" />
              Mind Map — {autoTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            <MindMap html={html} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow Chart Dialog */}
      <Dialog open={flowChartOpen} onOpenChange={setFlowChartOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <GitBranch className="h-5 w-5 text-peach-500" />
              Process Flow — {autoTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            <FlowChart html={html} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Enlarged Table Dialog */}
      <Dialog open={!!expandedTableHTML} onOpenChange={(v) => !v && setExpandedTableHTML(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Maximize2 className="h-5 w-5 text-primary" />
              Table View
            </DialogTitle>
          </DialogHeader>
          <div className="generated-notes expanded-table-view flex-1 min-h-0 overflow-auto p-6">
            {expandedTableHTML && (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(expandedTableHTML) }} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>);

};

export default GeneratedNotes;