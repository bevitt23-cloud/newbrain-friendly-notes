import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { hierarchy } from "d3-hierarchy";
import { motion, AnimatePresence } from "framer-motion";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useTelemetry } from "@/hooks/useTelemetry";
import { X, Download, Loader2 } from "lucide-react";
import { exportDiagramToPdf } from "@/lib/exportDiagramPdf";

/* ── Palette ── */
const PALETTES = ["sage", "lavender", "peach", "sky", "amber"] as const;

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

const ROOT_STYLE = {
  bg: "hsl(var(--primary))",
  border: "hsl(var(--primary))",
  text: "hsl(var(--primary-foreground))",
};

/* ── Types ── */
interface MindMapNode {
  id: string;
  label: string;
  type: "root" | "main_topic" | "detail";
  color?: string;
  detailed_info?: string;
  detailed_description?: string;
  category?: string;
}
interface MindMapEdge {
  source: string;
  target: string;
}
// Flat format from AI
interface MindMapDataFlat {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}
// Nested format (legacy — some prompts may still produce this)
interface MindMapDataNested {
  label: string;
  children?: MindMapDataNested[];
  color?: string;
  detailed_info?: string;
}

/* ── Convert nested format to flat ── */
function flattenNested(nested: MindMapDataNested): MindMapDataFlat {
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];
  let counter = 1;

  function walk(item: MindMapDataNested, parentId: string | null, depth: number, inheritedColor?: string) {
    const id = String(counter++);
    const color = item.color || inheritedColor;
    const type: MindMapNode["type"] = depth === 0 ? "root" : depth === 1 ? "main_topic" : "detail";
    nodes.push({
      id,
      label: item.label,
      type,
      color,
      detailed_info: item.detailed_info || (item as any).detailed_description || (item as any).description,
    });
    if (parentId) edges.push({ source: parentId, target: id });
    if (item.children) {
      for (const child of item.children) {
        walk(child, id, depth + 1, color);
      }
    }
  }
  walk(nested, null, 0);
  return { nodes, edges };
}

/* ── Bubble Node ── */
function BubbleNode({ data }: { data: Record<string, unknown> }) {
  const nodeType = data.nodeType as string;
  const COLOR_MAP = getColorMap();
  const palette = nodeType === "root" ? ROOT_STYLE : COLOR_MAP[(data.color as string) || "sage"] || COLOR_MAP.sage;
  const isRoot = nodeType === "root";
  const isDetail = nodeType === "detail";
  const isFocused = data.isFocused as boolean;
  const isFaded = data.isFaded as boolean;
  const depth = (data.depth as number) || 0;

  const size = isRoot
    ? { minW: 140, minH: 70, px: 24, py: 16 }
    : isDetail
    ? { minW: 80, minH: 36, px: 14, py: 8 }
    : { minW: 100, minH: 46, px: 18, py: 10 };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: isFaded ? 0.1 : 1, y: [0, -2, 0] }}
      transition={{
        scale: { type: "spring", stiffness: 400, damping: 20, delay: depth * 0.05 },
        opacity: { duration: 0.25 },
        y: { repeat: Infinity, duration: 3 + Math.random() * 2, ease: "easeInOut" },
      }}
      className="relative cursor-pointer select-none"
      style={{
        minWidth: size.minW,
        minHeight: size.minH,
        padding: `${(data.padding as number) || size.py}px ${((data.padding as number) || size.py) + 8}px`,
        background: palette.bg,
        border: `${isRoot ? 3 : isFocused ? 3 : 2}px solid ${palette.border}`,
        borderRadius: isRoot ? "50% / 40%" : isDetail ? "24px" : "50% / 45%",
        boxShadow: isFocused
          ? `0 0 0 3px ${palette.border}40, 0 6px 16px -4px ${palette.border}30`
          : isRoot
          ? `0 0 0 2px ${palette.border}, 0 6px 16px -6px ${palette.border}30`
          : `0 3px 8px -3px ${palette.border}20`,
        fontFamily: data.fontFamily as string,
        letterSpacing: `${data.letterSpacing}em`,
        lineHeight: data.lineSpacing as number,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-none !w-0 !h-0" />
      <div className="flex items-center justify-center gap-1.5 text-center">
        <span
          className={`${isRoot ? "text-sm font-bold" : isDetail ? "text-[10px] font-medium" : "text-xs font-semibold"} leading-snug`}
          style={{ color: palette.text }}
        >
          {data.label as string}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none !w-0 !h-0" />
    </motion.div>
  );
}

const nodeTypes = { bubbleNode: BubbleNode };

/* ── Detail Panel ── */
function DetailPanel({ node, onClose, fontFamily }: { node: MindMapNode; onClose: () => void; fontFamily: string }) {
  const COLOR_MAP = getColorMap();
  const palette = node.type === "root" ? ROOT_STYLE : COLOR_MAP[node.color || "sage"] || COLOR_MAP.sage;
  const detail = node.detailed_info || node.detailed_description || (node as any).description || (node as any).details || "No additional details available for this topic.";

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
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: palette.text }}>{node.category || node.type}</span>
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

/* ── Radial layout using d3-hierarchy ── */
function radialLayout(
  data: MindMapDataFlat,
  collapsedIds: Set<string>,
  focusedId: string | null,
  prefs: { fontFamily: string; letterSpacing: number; lineSpacing: number; padding: number }
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  for (const e of data.edges) {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
    childrenMap.get(e.source)!.push(e.target);
  }

  const root = data.nodes.find((n) => n.type === "root");
  if (!root) return { nodes: [], edges: [] };

  // Assign branch colors
  const mainChildren = childrenMap.get(root.id) || [];
  const branchColors = new Map<string, string>();
  function assignColor(id: string, color: string) {
    branchColors.set(id, color);
    if (!collapsedIds.has(id)) {
      (childrenMap.get(id) || []).forEach((c) => assignColor(c, color));
    }
  }
  mainChildren.forEach((cid, i) => {
    const node = nodeMap.get(cid);
    assignColor(cid, node?.color || PALETTES[i % PALETTES.length]);
  });

  // Build focus path
  const focusPath = new Set<string>();
  if (focusedId) {
    focusPath.add(focusedId);
    const parentMap = new Map<string, string>();
    for (const e of data.edges) parentMap.set(e.target, e.source);
    let current = focusedId;
    while (parentMap.has(current)) {
      current = parentMap.get(current)!;
      focusPath.add(current);
    }
    (childrenMap.get(focusedId) || []).forEach((c) => focusPath.add(c));
  }

  // Build hierarchy for d3
  interface HierNode { id: string; children?: HierNode[] }
  function buildTree(id: string, depth: number): HierNode {
    const kids = collapsedIds.has(id) ? [] : (childrenMap.get(id) || []);
    return { id, children: kids.length > 0 ? kids.map((c) => buildTree(c, depth + 1)) : undefined };
  }
  const treeData = buildTree(root.id, 0);
  const h = hierarchy(treeData);

  // Compute radial positions
  const depthCount = new Map<number, number>();
  h.each((node) => {
    depthCount.set(node.depth, (depthCount.get(node.depth) || 0) + 1);
  });

  // Assign angles — each node gets an equal slice of its parent's arc
  const flowNodes: Node[] = [];
  const angleMap = new Map<string, number>();
  const depthMap = new Map<string, number>();

  // Use leaf-count based angle allocation for balanced spacing
  const totalLeaves = h.leaves().length || 1;

  function assignAngles(node: any, startAngle: number, arcSpan: number) {
    const myLeafCount = node.leaves().length || 1;
    const myAngle = startAngle + arcSpan / 2;
    angleMap.set(node.data.id, myAngle);
    depthMap.set(node.data.id, node.depth);

    if (node.children) {
      let childStart = startAngle;
      for (const child of node.children) {
        const childLeaves = child.leaves().length || 1;
        const childArc = arcSpan * (childLeaves / myLeafCount);
        assignAngles(child, childStart, childArc);
        childStart += childArc;
      }
    }
  }

  assignAngles(h, 0, 2 * Math.PI);

  // Convert to positions
  const baseRadius = 220;
  h.each((node: any) => {
    const id = node.data.id;
    const n = nodeMap.get(id);
    if (!n) return;

    const angle = angleMap.get(id) || 0;
    const depth = node.depth;
    const radius = depth * baseRadius;
    const x = depth === 0 ? 0 : radius * Math.cos(angle - Math.PI / 2);
    const y = depth === 0 ? 0 : radius * Math.sin(angle - Math.PI / 2);

    const color = branchColors.get(id) || n.color;
    const halfW = n.type === "root" ? 70 : n.type === "detail" ? 50 : 60;
    const halfH = n.type === "root" ? 35 : n.type === "detail" ? 22 : 25;

    flowNodes.push({
      id,
      type: "bubbleNode",
      position: { x: x - halfW, y: y - halfH },
      data: {
        label: n.label,
        nodeType: n.type,
        color,
        depth,
        collapsed: collapsedIds.has(id),
        isFocused: focusedId === id,
        isFaded: focusedId !== null && !focusPath.has(id),
        ...prefs,
      },
    });
  });

  // Build edges
  const flowEdges: Edge[] = [];
  const visibleIds = new Set(flowNodes.map((n) => n.id));

  for (const e of data.edges) {
    if (visibleIds.has(e.source) && visibleIds.has(e.target)) {
      const sourceDepth = depthMap.get(e.source) || 0;
      const color = branchColors.get(e.target) || branchColors.get(e.source);
      const palette = color ? getColorMap()[color] : null;
      const strokeWidth = Math.max(1.5, 3.5 - sourceDepth * 0.6);
      const edgeFaded = focusedId !== null && (!focusPath.has(e.source) || !focusPath.has(e.target));

      flowEdges.push({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: "simplebezier",
        style: {
          stroke: palette?.border || "hsl(var(--primary))",
          strokeWidth,
          opacity: edgeFaded ? 0.05 : 0.6,
        },
      });
    }
  }

  return { nodes: flowNodes, edges: flowEdges };
}

/* ── Main component ── */
export default function MindMap({ html }: { html: string }) {
  const { preferences } = useUserPreferences();
  const { track } = useTelemetry();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const parsedData = useMemo<MindMapDataFlat | null>(() => {
    if (!html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const dataDiv = doc.querySelector(".mindmap-data");
      if (!dataDiv) return null;

      const rawText = dataDiv.textContent || "";
      const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = cleanJson.indexOf("{");
      const end = cleanJson.lastIndexOf("}");
      if (start === -1 || end === -1) return null;

      const validJsonStr = cleanJson.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
      const parsed = JSON.parse(validJsonStr);

      // Handle both flat {nodes, edges} and nested {label, children} formats
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        return parsed as MindMapDataFlat;
      }
      if (parsed.label) {
        return flattenNested(parsed as MindMapDataNested);
      }
      return null;
    } catch {
      return null;
    }
  }, [html]);

  const fontFamily = preferences.dyslexia_font
    ? "'OpenDyslexic', 'Comic Sans MS', sans-serif"
    : preferences.adhd_font
      ? "'Lexend', sans-serif"
      : "'EB Garamond', 'Georgia', serif";
  const letterSpacing = preferences.dyslexia_font ? preferences.letter_spacing : 0;
  const lineSpacing = preferences.dyslexia_font ? preferences.line_spacing : 1.4;
  const padding = preferences.dyslexia_font ? 16 : 10;

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };
    return radialLayout(parsedData, collapsedIds, focusedId, { fontFamily, letterSpacing, lineSpacing, padding });
  }, [parsedData, collapsedIds, focusedId, fontFamily, letterSpacing, lineSpacing, padding]);

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
    track("mindmap_node_click", { nodeId: node.id, label: (node.data as any)?.label });
    track("mindmap_branch_expand", { nodeId: node.id, label: (node.data as any)?.label });
  }, [track]);

  const onPaneClick = useCallback(() => setFocusedId(null), []);

  const handleExportPdf = useCallback(async () => {
    if (!containerRef.current || !parsedData) return;
    setIsExporting(true);
    setFocusedId(null);
    await new Promise((r) => setTimeout(r, 300));
    const rootLabel = parsedData.nodes.find((n) => n.type === "root")?.label || "Mind Map";
    await exportDiagramToPdf(containerRef.current, rootLabel, parsedData.nodes, fontFamily);
    setIsExporting(false);
  }, [parsedData, fontFamily]);

  if (!parsedData) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No mind map data found. Try enabling the Mind Map study tool before generating notes.
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
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="hsl(var(--border) / 0.15)" />
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

      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 pointer-events-none select-none w-full text-center px-4">
        Click a bubble to focus & view details · Click background to reset · Drag to rearrange
      </p>
    </div>
  );
}
