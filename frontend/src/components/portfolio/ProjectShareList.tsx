import type { PortfolioPosition } from "@/hooks/usePortfolioData";
import { fmtToken } from "@/utils/portfolioFormatters";

interface ProjectShareListProps {
  positions: PortfolioPosition[];
}

export function ProjectShareList({ positions }: ProjectShareListProps) {
  return (
    <div className="space-y-3">
      {positions.map((pos) => (
        <div key={String(pos.id)} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{pos.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {fmtToken(pos.tokensHeld)} / {fmtToken(pos.totalProjectTokens)}{" "}
                {pos.symbol}
              </p>
            </div>
            <span className="shrink-0 text-xs font-mono font-semibold">
              {pos.projectSharePct.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${Math.min(100, Math.max(0, pos.projectSharePct))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
