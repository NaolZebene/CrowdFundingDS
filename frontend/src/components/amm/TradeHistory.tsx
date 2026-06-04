import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AmmTradeItem } from "@/hooks/useAmmIndexedData";
import { fmtUSD, fmtToken, fmtTime } from "@/utils/ammFormatters";

interface TradeHistoryProps {
  trades: AmmTradeItem[];
  isLoading: boolean;
}

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/40 flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" /> Trade History
        </p>
        <span className="text-[10px] text-muted-foreground font-mono">
          {trades.length} txns indexed
        </span>
      </div>
      {/* column headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-secondary/30">
        <span className="col-span-2">Side</span>
        <span className="col-span-3">Address</span>
        <span className="col-span-2 text-right">USDC</span>
        <span className="col-span-2 text-right">Tokens</span>
        <span className="col-span-2 text-right">Price</span>
        <span className="col-span-1 text-right">Time</span>
      </div>
      <CardContent className="p-0">
        {isLoading && trades.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            Syncing trade history...
          </p>
        ) : trades.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            No trades indexed yet. Make a swap to see history.
          </p>
        ) : (
          <div>
            {trades.slice(0, 15).map((t, idx) => {
              const isBuy = t.side === "BUY";
              const isSell = t.side === "SELL";
              const tone = isBuy
                ? "text-green-400"
                : isSell
                  ? "text-red-400"
                  : t.side === "SEED"
                    ? "text-blue-400"
                    : "text-yellow-400";
              const bgTone = isBuy
                ? "hover:bg-green-500/5"
                : isSell
                  ? "hover:bg-red-500/5"
                  : "hover:bg-secondary/40";
              const actor =
                t.user === "0x0000000000000000000000000000000000000000"
                  ? "protocol"
                  : `${t.user.slice(0, 6)}…${t.user.slice(-4)}`;

              return (
                <div
                  key={t.id}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-2 text-[11px] border-b border-border/20 transition-colors ${bgTone} ${
                    idx % 2 === 0 ? "" : "bg-secondary/10"
                  }`}
                >
                  <span className={`col-span-2 font-bold font-mono ${tone}`}>
                    {isBuy ? "▲ BUY" : isSell ? "▼ SELL" : t.side}
                  </span>
                  <span className="col-span-3 font-mono truncate text-muted-foreground text-[10px]">
                    {actor}
                  </span>
                  <span className="col-span-2 text-right font-mono">
                    {fmtUSD(t.usdcAmount)}
                  </span>
                  <span className={`col-span-2 text-right font-mono ${tone}`}>
                    {fmtToken(t.commitAmount)}
                  </span>
                  <span className="col-span-2 text-right font-mono">
                    {t.price > 0 ? fmtUSD(t.price) : "—"}
                  </span>
                  <span className="col-span-1 text-right text-muted-foreground text-[10px]">
                    {fmtTime(t.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
