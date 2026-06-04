import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioPosition } from "@/hooks/usePortfolioData";
import { fmtUSD } from "@/utils/portfolioFormatters";

interface YieldBreakdownProps {
  positions: PortfolioPosition[];
  totalYieldClaimable: number;
  claimYieldLoading: boolean;
  onClaimYield: () => void;
}

export function YieldBreakdown({
  positions,
  totalYieldClaimable,
  claimYieldLoading,
  onClaimYield,
}: YieldBreakdownProps) {
  if (positions.length === 0) return null;

  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          Yield Breakdown
        </p>
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={String(p.id)} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-primary">
                    {p.symbol[0]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {p.name}
                </span>
              </div>
              <p className="text-xs font-mono font-semibold text-green-400 shrink-0">
                +{fmtUSD(p.yieldClaimable)}
              </p>
            </div>
          ))}
        </div>
        <Separator className="bg-border" />
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold">Total claimable</span>
          <span className="text-sm font-mono font-bold text-green-400">
            +{fmtUSD(totalYieldClaimable)}
          </span>
        </div>
        <Button
          className="w-full h-9 text-xs gap-1.5 rounded-xl shadow-sm shadow-primary/20"
          size="sm"
          onClick={onClaimYield}
          disabled={claimYieldLoading || totalYieldClaimable <= 0}
        >
          {claimYieldLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Claim All
        </Button>
      </CardContent>
    </Card>
  );
}
