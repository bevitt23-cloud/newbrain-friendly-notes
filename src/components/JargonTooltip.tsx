import type { JargonTooltipState } from "@/hooks/useJargonTooltip";

interface JargonTooltipProps {
  tooltip: JargonTooltipState | null;
}

const JargonTooltip = ({ tooltip }: JargonTooltipProps) => {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none fixed z-[70] w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-full"
      style={{
        left: Math.min(Math.max(tooltip.x, 160), window.innerWidth - 160),
        top: Math.max(tooltip.y, 12),
      }}
    >
      <div className="rounded-xl border border-border bg-popover px-3 py-2.5 shadow-xl shadow-black/10">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {tooltip.term}
        </p>
        <p className="text-sm leading-snug text-popover-foreground">
          {tooltip.definition}
        </p>
      </div>
      <div className="mx-auto h-3 w-3 -translate-y-[1px] rotate-45 border-b border-r border-border bg-popover" />
    </div>
  );
};

export default JargonTooltip;
