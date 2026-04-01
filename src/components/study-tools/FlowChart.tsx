import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useTelemetry } from "@/hooks/useTelemetry";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
import { exportDiagramToPdf } from "@/lib/exportDiagramPdf";

/* ── Palette mapping ── */
const COLOR_MAP_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  sage:     { bg: "hsl(var(--sage-100))",     border: "hsl(var(--sage-400))",     text: "hsl(var(--sage-700))" },
  lavender: { bg: "hsl(var(--lavender-100))", border: "hsl(var(--lavender-400))", text: "hsl(var(--lavender-600))" },
  peach:    { bg: "hsl(var(--peach-100))",    border: "hsl(var(--peach-400))",    text: "hsl(var(--peach-500))" },
  sky:      { bg: "hsl(var(--sky-100))",      border: "hsl(var(--sky-400))",      text: "hsl(var(--sky-400))" },
  amber:    { bg: "hsl(var(--amber-100))",    border: "hsl(var(--amber-400))",    text: "hsl(var(--amber-500))" },
};

const COLOR_MAP_DARK: Record<string, { bg: string; border: string; text: string }> = {
  sage:     { bg: "hsl(152 20% 12%)",  border: "hsl(152 24% 28%)",  text: "hsl(152 16% 78%)" },
  lavender: { bg: "hsl(250 18% 13%)",  border: "hsl(250 22% 30%)",  text: "hsl(250 16% 78%)" },
  peach:    { bg: "hsl(18 22% 12%)",   border: "hsl(18 26% 28%)",   text: "hsl(18 16% 78%)" },
  sky:      { bg: "hsl(200 24% 12%)",  border: "hsl(200 28% 28%)",  text: "hsl(200 16% 78%)" },
  amber:    { bg: "hsl(36 20% 12%)",   border: "hsl(36 24% 26%)",   text: "hsl(36 16% 78%)" },
};

function getColorMap() {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return COLOR_MAP_DARK;
  }
  return COLOR_MAP_LIGHT;
}

/* ── Types ── */
interface FlowChartNode {
  id: string;
  label: string;
  type: "start" | "process" | "decision" | "end";
  color?: string;
  detailed_info?: string;
}
interface FlowChartEdge {
  source?: string;
  target?: string;
  from?: string;
  to?: string;
  label?: string;
}
interface FlowChartData {
  nodes: FlowChartNode[];
  edges: FlowChartEdge[];
}

/* ── Normalize edges (handle from/to OR source/target) ── */
function normalizeEdge(e: FlowChartEdge): { source: string; target: string; label?: string } {
  return {
    source: e.source || e.from || "",
    target: e.target || e.to || "",
    label: e.label,
  };
}

/* ── Shape renderers ── */
function DiamondShape({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return (
    <div
      className="flex items-center justify-center aspect-square"
      style={{
        ...style,
        minWidth: 110,
        padding: "24px",
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        textAlign: "center",
      }}
    >
      <div className="max-w-[100px] flex items-center justify-center">{children}</div>
    </div>
  );
}

function RoundedPill({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return (
    <div style={{ ...style, borderRadius: 999, padding: "10px 24px", minWidth: 100, textAlign: "center" }}>
      {children}
    </div>
  );
}

function RectangleShape({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return (
    <div style={{ ...style, borderRadius: 12, padding: "12px 20px", minWidth: 120, textAlign: "center" }}>
      {children}
    </div>
  );
}

/* ── Custom node component ── */
function FlowChartNodeComponent({ data }: { data: Record<string, unknown> }) {
  const COLOR_MAP = getColorMap();
  const palette = COLOR_MAP[(data.color as string) || "sage"] || COLOR_MAP.sage;
  const nodeType = data.nodeType as string;
  const isFocused = data.isFocused as boolean;
  const isFaded = data.isFaded as boolean;

  const baseStyle: React.CSSProperties = {
    background: palette.bg,
    border: `${isFocused ? 3 : 2}px solid ${palette.border}`,
    fontFamily: data.fontFamily as string,
    letterSpacing: `${data.letterSpacing}em`,
    lineHeight: data.lineSpacing as number,
    opacity: isFaded ? 0.15 : 1,
    boxShadow: isFocused ? `0 0 0 3px ${palette.border}40` : `0 2px 6px -2px ${palette.border}20`,
  };

  const labelContent = (
    <div className="flex items-center gap-1.5 justify-center">
      <span className="text-xs font-semibold leading-snug" style={{ color: palette.text }}>
        {data.label as string}
      </span>
    </div>
  );

  let shape: React.ReactNode;
  if (nodeType === "decision") {
    shape = <DiamondShape style={baseStyle}>{labelContent}</DiamondShape>;
  } else if (nodeType === "start" || nodeType === "end") {
    shape = <RoundedPill style={baseStyle}>{labelContent}</RoundedPill>;
  } else {
    shape = <RectangleShape style={baseStyle}>{labelContent}</RectangleShape>;
  }

  return (
    <div className="relative cursor-pointer">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-none !w-0 !h-0" />
      {shape}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none !w-0 !h-0" />
    </div>
  );
}

const nodeTypes = { flowchartNode: FlowChartNodeComponent };

/* ── Detail Panel ── */
function DetailPanel({
  node,
  onClose,
  fontFamily,
}: {
  node: FlowChartNode;
  onClose: () => void;
  fontFamily: string;
}) {
  const COLOR_MAP = getColorMap();
  const palette = COLOR_MAP[node.color || "sage"] || COLOR_MAP.sage;
  const detail = node.detailed_info || (node as any).detailed_description || (node as any).description || (node as any).details || "No additional details available for this step.";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="absolute top-4 right-4 z-50 w-80 max-h-[80%] overflow-y-auto rounded-2xl border shadow-xl"
        style={{ background: "hsl(var(--card))", borderColor: palette.border, fontFamily }}
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b" style={{ borderColor: palette.border, background: palette.bg }}>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: palette.text }}>{node.type}</span>
            <h3 className="text-sm font-bold mt-0.5" style={{ color: palette.text }}>{node.label}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10">
            <X size={16} style={{ color: palette.text }} />
          </button>
        </div>
        <div className="p-4 text-sm leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>{detail}</div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Dagre layout ── */
function layoutWithDagre(
  data: FlowChartData,
  focusedId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 });

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const normalizedEdges = data.edges.map(normalizeEdge).filter((e) => e.source && e.target);

  // Build focus path
  const focusPath = new Set<string>();
  if (focusedId) {
    focusPath.add(focusedId);
    const parentMap = new Map<string, string>();
    for (const e of normalizedEdges) parentMap.set(e.target, e.source);
    let current = focusedId;
    while (parentMap.has(current)) {
      current = parentMap.get(current)!;
      focusPath.add(current);
    }
    const childrenMap = new Map<string, string[]>();
    for (const e of normalizedEdges) {
      if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
      childrenMap.get(e.source)!.push(e.target);
    }
    (childrenMap.get(focusedId) || []).forEach((c) => focusPath.add(c));
  }

  // Add nodes to dagre
  for (const n of data.nodes) {
    const w = n.type === "decision" ? 130 : n.type === "start" || n.type === "end" ? 120 : 140;
    const h = n.type === "decision" ? 110 : 50;
    g.setNode(n.id, { width: w, height: h });
  }

  // Add edges to dagre
  for (const e of normalizedEdges) {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  // Build React Flow nodes
  const flowNodes: Node[] = data.nodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.type === "decision" ? 130 : n.type === "start" || n.type === "end" ? 120 : 140;
    const h = n.type === "decision" ? 110 : 50;
    return {
      id: n.id,
      type: "flowchartNode",
      position: { x: (pos?.x || 0) - w / 2, y: (pos?.y || 0) - h / 2 },
      data: {
        label: n.label,
        nodeType: n.type,
        color: n.color,
        isFocused: focusedId === n.id,
        isFaded: focusedId !== null && !focusPath.has(n.id),
      },
    };
  });

  // Build edges
  const flowEdges: Edge[] = normalizedEdges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => {
      const sourceNode = nodeMap.get(e.source);
      const color = sourceNode?.color ? (getColorMap()[sourceNode.color]?.border || "hsl(var(--border))") : "hsl(var(--primary))";
      const edgeFaded = focusedId !== null && (!focusPath.has(e.source) || !focusPath.has(e.target));

      return {
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        style: {
          stroke: color,
          strokeWidth: 2,
          opacity: edgeFaded ? 0.1 : 0.8,
        },
        labelStyle: { fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
        type: "smoothstep",
        markerEnd: { type: "arrowclosed" as const, color },
      };
    });

  return { nodes: flowNodes, edges: flowEdges };
}

/* ── Main component ── */
export default function FlowChart({ html }: { html: string }) {
  const { preferences } = useUserPreferences();
  const { track } = useTelemetry();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const parsedData = useMemo<FlowChartData | null>(() => {
    if (!html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const dataDiv = doc.querySelector(".flowchart-data");
      if (!dataDiv) return null;

      const rawText = dataDiv.textContent || "";
      const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = cleanJson.indexOf("{");
      const end = cleanJson.lastIndexOf("}");
      if (start === -1 || end === -1) return null;

      const validJsonStr = cleanJson.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(validJsonStr);
    } catch {
      return null;
    }
  }, [html]);

  const isDyslexia = preferences.dyslexia_font;
  const fontFamily = isDyslexia
    ? "'OpenDyslexic', 'Comic Sans MS', sans-serif"
    : preferences.adhd_font
      ? "'Lexend', sans-serif"
      : "'Arial', 'Helvetica Neue', sans-serif";
  const letterSpacing = isDyslexia ? preferences.letter_spacing : 0;
  const lineSpacing = isDyslexia ? preferences.line_spacing : 1.4;
  const padding = isDyslexia ? 16 : 10;

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };
    const result = layoutWithDagre(parsedData, focusedId);
    return {
      nodes: result.nodes.map((n) => ({
        ...n,
        data: { ...n.data, fontFamily, letterSpacing, lineSpacing, padding, isDyslexia },
      })),
      edges: result.edges,
    };
  }, [parsedData, focusedId, fontFamily, letterSpacing, lineSpacing, padding, isDyslexia]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const focusedNode = useMemo(() => {
    if (!focusedId || !parsedData) return null;
    return parsedData.nodes.find((n) => n.id === focusedId) || null;
  }, [focusedId, parsedData]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setFocusedId((prev) => (prev === node.id ? null : node.id));
    track("flowchart_node_click", { nodeId: node.id, label: (node.data as any)?.label });
  }, [track]);

  const onPaneClick = useCallback(() => setFocusedId(null), []);

  const handleExportPdf = useCallback(async () => {
    if (!containerRef.current || !parsedData) return;
    setIsExporting(true);
    setFocusedId(null);
    await new Promise((r) => setTimeout(r, 300));
    const firstLabel = parsedData.nodes.find((n) => n.type === "start")?.label || "Flow Chart";
    await exportDiagramToPdf(containerRef.current, `Flow Chart - ${firstLabel}`, parsedData.nodes, fontFamily);
    setIsExporting(false);
  }, [parsedData, fontFamily]);

  if (!parsedData) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No flow chart data found. Try enabling the Flow Chart add-on before generating notes.
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ fontFamily }} ref={containerRef}>
      <button
        onClick={handleExportPdf}
        disabled={isExporting}
        className="absolute top-3 right-3 z-40 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {isExporting ? "Generating..." : "Download PDF"}
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="hsl(var(--border) / 0.15)" />
        <Controls showInteractive={false} className="!bg-card !border-border !shadow-md" />
        <MiniMap
          nodeColor={(n) => {
            const c = n.data?.color as string;
            return c ? (getColorMap()[c]?.bg || "hsl(var(--muted))") : "hsl(var(--primary))";
          }}
          className="!bg-card !border-border"
          maskColor="hsl(var(--background) / 0.7)"
        />
      </ReactFlow>

      {focusedNode && (
        <DetailPanel node={focusedNode} onClose={() => setFocusedId(null)} fontFamily={fontFamily} />
      )}

      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full text-center px-4 text-[10px] text-muted-foreground/60 pointer-events-none select-none">
        Click a step to view details · Click background to reset · Drag to rearrange · Scroll to zoom
      </p>
    </div>
  );
}
