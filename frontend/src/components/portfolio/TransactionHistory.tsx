import { Loader2, AlertCircle, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { TxRecord } from "@/store/slices/portfolioSlice";
import { HistoryRow } from "./HistoryRow";

interface TransactionHistoryProps {
  history: TxRecord[];
  filteredHistory: TxRecord[];
  isLoading: boolean;
  isError: boolean;
  historyTab: string;
  onTabChange: (tab: "all" | "invest" | "yield" | "sell") => void;
}

const TABS: Array<{ value: "all" | "invest" | "yield" | "sell"; label: string }> = [
  { value: "all", label: "All" },
  { value: "invest", label: "Invest" },
  { value: "yield", label: "Yield" },
  { value: "sell", label: "Sell" },
];

export function TransactionHistory({
  history,
  filteredHistory,
  isLoading,
  isError,
  historyTab,
  onTabChange,
}: TransactionHistoryProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Transaction History</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isLoading
              ? "Fetching indexed history..."
              : `${history.length} transaction${history.length !== 1 ? "s" : ""} indexed`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg capitalize transition-colors font-medium ${
                historyTab === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium border-b border-border">
          <span className="col-span-1" />
          <span className="col-span-4">Transaction</span>
          <span className="col-span-2 text-right hidden sm:block">Token</span>
          <span className="col-span-3 text-right">Amount</span>
          <span className="col-span-2 text-right">Date</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Reading indexed history...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">
              Failed to load history from the subgraph
            </span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Activity className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs">
              {historyTab === "all"
                ? "No indexed transactions yet."
                : `No indexed ${historyTab} transactions found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredHistory.map((tx, i) => (
              <HistoryRow key={i} tx={tx} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
