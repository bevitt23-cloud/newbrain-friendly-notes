import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, Loader2, X } from "lucide-react";

const TOOL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-tool`;

/* ─── Color map matching our design tokens ─── */
const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  sage: { bg: "bg-sage-100 dark:bg-sage-500/15", border: "border-sage-300 dark:border-sage-300/30", text: "text-sage-800 dark:text-sage-200" },
  lavender: { bg: "bg-lavender-100 dark:bg-lavender-500/15", border: "border-lavender-300 dark:border-lavender-300/30", text: "text-lavender-800 dark:text-lavender-200" },
  peach: { bg: "bg-peach-100 dark:bg-peach-500/15", border: "border-peach-300 dark:border-peach-300/30", text: "text-peach-800 dark:text-peach-200" },
  sky: { bg: "bg-sky-100 dark:bg-sky-300/15", border: "border-sky-300 dark:border-sky-300/30", text: "text-sky-800 dark:text-sky-200" },
};
const DEFAULT_COLOR = { bg: "bg-muted", border: "border-border", text: "text-foreground" };
const getColor = (c?: string) => (c && COLOR_MAP[c]) || DEFAULT_COLOR;

/* ─── Types ─── */
interface MindmapNode {
  label: string;
  color?: string;
  children?: MindmapNode[];
}

interface FlowNode {
  id: string;
  label: string;
  type: "start" | "end" | "process" | "decision";
  color?: string;
}
interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}
interface FlowchartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function parseData(raw: string): { kind: "mindmap"; data: MindmapNode } | { kind: "flowchart"; data: FlowchartData } | null {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.nodes && parsed.edges) return { kind: "flowchart", data: parsed };
    if (parsed.label) return { kind: "mindmap", data: parsed };
    return null;
  } catch {
    return null;
  }
}

/* ─── Explanation Panel ─── */
function ExplanationBubble({ label, notesContext, onClose }: { label: string; notesContext?: string; onClose: () => void }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(TOOL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            tool: "socratic",
            notesHtml: notesContext || label,
            conversationHistory: [
              { role: "user", content: `Briefly explain this concept in 2-3 simple sentences: "${label}". Be concise and supportive.` },
            ],
          }),
        });
        if (!resp.ok) throw new Error("Failed");
        const data = await resp.json();
        if (!cancelled) setExplanation(data.result || "No explanation available.");
      } catch {
        if (!cancelled) setExplanation("Couldn't load explanation. Try again!");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [label, notesContext]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      className="absolute z-50 w-72 rounded-2xl border border-border bg-card shadow-xl p-4"
      style={{ top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">💡 Deeper Look</p>
        <button onClick={onClose} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs font-semibold text-primary mb-1.5">"{label}"</p>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Thinking...</span>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground">{explanation}</p>
      )}
    </motion.div>
  );
}

/* ─── Interactive Node Wrapper ─── */
function InteractiveNode({ label, notesContext, children }: { label: string; notesContext?: string; children: React.ReactNode }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    setShowExplanation((prev) => !prev);
  }, []);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowExplanation(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div ref={wrapperRef} className="relative inline-flex flex-col items-center">
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
      <AnimatePresence>
        {showExplanation && (
          <ExplanationBubble
            label={label}
            notesContext={notesContext}
            onClose={() => setShowExplanation(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Mind Map Component ─── */
function MindMapView({ node, depth = 0, parentColor, notesContext }: { node: MindmapNode; depth?: number; parentColor?: string; notesContext?: string }) {
  const [expanded, setExpanded] = useState(true);
  const color = node.color || parentColor;
  const c = getColor(color);

  if (depth === 0) {
    return (
      <div className="flex flex-col items-center gap-6">
        <InteractiveNode label={node.label} notesContext={notesContext}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full border-2 border-primary bg-gradient-to-br from-sage-100 via-lavender-100 to-peach-100 dark:from-sage-500/20 dark:via-lavender-500/20 dark:to-peach-500/20 px-6 py-3 text-center font-bold text-foreground shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
          >
            {node.label}
          </motion.div>
        </InteractiveNode>
        {node.children && (
          <div className="flex flex-wrap justify-center gap-6">
            {node.children.map((child, i) => (
              <MindMapView key={i} node={child} depth={1} parentColor={child.color || color} notesContext={notesContext} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: depth * 0.05 }}
      className="flex flex-col items-center"
    >
      <InteractiveNode label={node.label} notesContext={notesContext}>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`rounded-2xl border-2 ${c.border} ${c.bg} px-4 py-2 text-sm font-semibold ${c.text} shadow-sm transition-all hover:shadow-md cursor-pointer`}
        >
          {node.label}
          {node.children && node.children.length > 0 && (
            <span className="ml-1.5 text-xs opacity-50">{expanded ? "▾" : "▸"}</span>
          )}
        </button>
      </InteractiveNode>
      <AnimatePresence>
        {expanded && node.children && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 flex flex-col items-center gap-2 border-l-2 border-dashed border-border pl-4"
          >
            {node.children.map((child, i) => (
              <MindMapView key={i} node={child} depth={depth + 1} parentColor={color} notesContext={notesContext} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Flowchart Component ─── */
function FlowchartView({ data, notesContext }: { data: FlowchartData; notesContext?: string }) {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const outEdges = new Map<string, FlowEdge[]>();
  data.edges.forEach((e) => {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  });

  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    order.push(id);
    (outEdges.get(id) || []).forEach((e) => visit(e.to));
  };
  const startNodes = data.nodes.filter((n) => n.type === "start");
  (startNodes.length ? startNodes : [data.nodes[0]]).forEach((n) => visit(n.id));
  data.nodes.forEach((n) => visit(n.id));

  const getShapeClass = (type: string) => {
    switch (type) {
      case "start":
      case "end":
        return "rounded-full px-5 py-2.5";
      case "decision":
        return "rounded-xl rotate-0 px-4 py-3 border-dashed";
      default:
        return "rounded-2xl px-4 py-2.5";
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {order.map((nodeId, i) => {
        const node = nodeMap.get(nodeId);
        if (!node) return null;
        const c = getColor(node.color);
        const edges = outEdges.get(nodeId) || [];

        return (
          <div key={nodeId} className="flex flex-col items-center">
            <InteractiveNode label={node.label} notesContext={notesContext}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`border-2 ${c.border} ${c.bg} ${getShapeClass(node.type)} text-sm font-semibold ${c.text} shadow-sm transition-all hover:shadow-md cursor-pointer`}
              >
                {node.type === "decision" ? `◇ ${node.label}` : node.label}
              </motion.div>
            </InteractiveNode>
            {edges.length > 0 && (
              <div className="flex flex-col items-center">
                {edges.map((edge, ei) => (
                  <div key={ei} className="flex flex-col items-center">
                    <div className="h-4 w-0.5 bg-border" />
                    {edge.label && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded-full border border-border -my-1 z-10">
                        {edge.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Visualizer ─── */
export default function Visualizer({ data, notesContext }: { data: string; notesContext?: string }) {
  const [zoom, setZoom] = useState(1);
  const [parsed, setParsed] = useState<ReturnType<typeof parseData>>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const result = parseData(data);
    if (result) {
      setParsed(result);
      setError(false);
    } else {
      setError(true);
    }
  }, [data]);

  if (error) {
    const cleaned = data.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Raw Output</p>
        <pre className="whitespace-pre-wrap text-xs text-foreground bg-muted/50 rounded-lg p-3 overflow-auto max-h-[40vh]">
          {cleaned}
        </pre>
      </div>
    );
  }

  if (!parsed) return null;

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">💡 Click any node for a deeper explanation</p>
        <div className="flex gap-1.5">
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-2xl border border-border bg-card overflow-auto max-h-[60vh] p-6">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}>
          {parsed.kind === "mindmap" ? (
            <MindMapView node={parsed.data} notesContext={notesContext} />
          ) : (
            <FlowchartView data={parsed.data} notesContext={notesContext} />
          )}
        </div>
      </div>
    </div>
  );
}
