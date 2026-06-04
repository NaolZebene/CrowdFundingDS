import { ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";
import type { TxRecord } from "@/store/slices/portfolioSlice";
import { fmtUSD, fmtToken, fmtTime } from "@/utils/portfolioFormatters";

interface HistoryRowProps {
  tx: TxRecord;
}

export function HistoryRow({ tx }: HistoryRowProps) {
  const isInvest = tx.type === "invest";
  const isYield = tx.type === "yield";
  const isSell = tx.type === "sell";

  const icon = isInvest ? (
    <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
  ) : isYield ? (
    <Zap className="w-3.5 h-3.5 text-green-400" />
  ) : (
    <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
  );

  const label = isInvest ? "Invested" : isYield ? "Yield Claimed" : "Sold via AMM";
  const amountColor = isYield ? "text-green-400" : isSell ? "text-purple-400" : "";

  return (
    <div className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-secondary/40 transition-colors rounded-lg">
      <div className="col-span-1 flex justify-center">
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="col-span-4">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tx.project}</p>
      </div>
      <div className="col-span-2 text-right hidden sm:block">
        <p className="text-[11px] font-mono">{tx.symbol}</p>
        {tx.tokens > 0 && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {fmtToken(tx.tokens)} tkn
          </p>
        )}
      </div>
      <div className="col-span-3 text-right">
        <p className={`text-xs font-mono font-semibold ${amountColor}`}>
          {isYield ? "+" : isSell ? "+" : "-"}
          {fmtUSD(tx.amount)}
        </p>
        {tx.price > 0 && (
          <p className="text-[10px] text-muted-foreground font-mono">
            @ {fmtUSD(tx.price)}
          </p>
        )}
      </div>
      <div className="col-span-2 text-right">
        <p className="text-[10px] text-muted-foreground font-mono">
          {fmtTime(new Date(tx.date))}
        </p>
      </div>
    </div>
  );
}
