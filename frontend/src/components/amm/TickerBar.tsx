import { TrendingUp } from "lucide-react";
import type { AmmPool } from "@/hooks/useAmmData";
import { fmtUSD } from "@/utils/ammFormatters";

interface TickerBarProps {
  pools: AmmPool[];
}

export function TickerBar({ pools }: TickerBarProps) {
  const tradable = pools.filter((p) => p.tradable);
  if (tradable.length === 0) return null;

  return (
    <div className="w-full overflow-hidden border-b border-border bg-black/30">
      <div className="flex gap-8 px-4 py-1.5 overflow-x-auto scrollbar-none">
        {tradable.map((p) => (
          <div key={p.id} className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono font-semibold text-muted-foreground">
              {p.symbol}/USDC
            </span>
            <span className="text-[11px] font-mono font-bold text-green-400">
              {fmtUSD(p.price)}
            </span>
            <span className="text-[10px] font-mono text-green-400 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              Live
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
