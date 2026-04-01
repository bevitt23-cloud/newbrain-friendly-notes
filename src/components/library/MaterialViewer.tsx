import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FlashcardDeck from "@/components/study-tools/FlashcardDeck";
import ClozeNotes from "@/components/study-tools/ClozeNotes";

import MindMap from "@/components/study-tools/MindMap";
import FlowChart from "@/components/study-tools/FlowChart";
import SocraticDebate from "@/components/study-tools/SocraticDebate";

interface MaterialViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialType: string;
  content: Record<string, unknown>;
  title: string;
}

const typeLabel: Record<string, string> = {
  flashcard: "🃏 Flash Cards",
  mindmap: "🗺️ Mind Map",
  flowchart: "📊 Flow Chart",
  cloze: "📝 Fill-in-the-Blank",
  socratic: "💬 Debate",
};

export default function MaterialViewer({ open, onOpenChange, materialType, content, title }: MaterialViewerProps) {
  const raw = typeof content?.raw === "string" ? content.raw : JSON.stringify(content);

  const renderContent = () => {
    switch (materialType) {
      case "flashcard": return <FlashcardDeck data={raw} />;
      case "cloze": return <ClozeNotes data={raw} />;
      case "mindmap": return <div className="h-[500px]"><MindMap data={raw} /></div>;
      case "flowchart": return <div className="h-[500px]"><FlowChart data={raw} /></div>;
      default: return <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{raw}</pre>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-sm">{typeLabel[materialType] || materialType}</span>
            <span className="text-muted-foreground font-normal">—</span>
            <span className="truncate">{title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
