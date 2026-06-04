import { ArrowRight, ArrowUpDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AmmPool } from "@/hooks/useAmmData";
import { fmtUSD, fmtToken, SLIPPAGE_BPS } from "@/utils/ammFormatters";
import { currentPriceLabel } from "@/utils/ammFormatters";

interface SwapInterfaceProps {
  pool: AmmPool;
  direction: "buy" | "sell";
  inputVal: string;
  inputNum: number;
  outputNum: number;
  usdcBal: number;
  commitBal: number;
  userBalance: number;
  executionPrice: number;
  tradeVsPoolPct: number;
  impact: number;
  minReceived: number;
  feeBps: number;
  isConnected: boolean;
  isWriting: boolean;
  isTxPending: boolean;
  isTxSuccess: boolean;
  writeError: Error | null;
  lastAction: "approve-usdc" | "approve-commit" | "swap" | null;
  needsUsdcApproval: boolean;
  needsCommitApproval: boolean;
  hasEnoughInputBalance: boolean;
  canSellSelectedPool: boolean;
  onDirectionChange: (dir: "buy" | "sell") => void;
  onInputChange: (val: string) => void;
  onFlip: () => void;
  onSwap: () => void;
}

export function SwapInterface({
  pool,
  direction,
  inputVal,
  inputNum,
  outputNum,
  usdcBal,
  commitBal,
  userBalance,
  executionPrice,
  tradeVsPoolPct,
  impact,
  minReceived,
  feeBps,
  isConnected,
  isWriting,
  isTxPending,
  isTxSuccess,
  writeError,
  lastAction,
  needsUsdcApproval,
  needsCommitApproval,
  hasEnoughInputBalance,
  canSellSelectedPool,
  onDirectionChange,
  onInputChange,
  onFlip,
  onSwap,
}: SwapInterfaceProps) {
  const impactColor =
    impact < 1 ? "text-green-400" : impact < 3 ? "text-yellow-400" : "text-red-400";
  const fromLabel = direction === "buy" ? "USDC" : pool.symbol;
  const toLabel = direction === "buy" ? pool.symbol : "USDC";

  function swapButtonLabel() {
    if (!isConnected) return "Connect wallet to swap";
    if (!pool) return "No pools available";
    if (direction === "sell" && !canSellSelectedPool)
      return `No ${pool.symbol} to sell`;
    if (inputNum <= 0) return "Enter an amount";
    if (!hasEnoughInputBalance) return `Insufficient ${fromLabel} balance`;
    if (isTxPending || isWriting) {
      if (lastAction === "approve-usdc") return "Approving USDC…";
      if (lastAction === "approve-commit") return "Approving CommitToken…";
      return "Confirming swap…";
    }
    if (isTxSuccess && lastAction === "swap") return "Swap successful!";
    if (needsUsdcApproval) return "Step 1: Approve USDC";
    if (needsCommitApproval) return "Step 1: Approve CommitToken";
    return (
      <>
        {direction === "buy" ? "Buy" : "Sell"} {pool.symbol}{" "}
        <ArrowRight className="w-4 h-4" /> {toLabel}
      </>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      {/* Exchange-style buy/sell tab header */}
      <div className="grid grid-cols-2">
        {(["buy", "sell"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onDirectionChange(mode)}
            className={`py-3 text-sm font-bold transition-all border-b-2 ${
              direction === mode
                ? mode === "buy"
                  ? "border-green-400 bg-green-500/10 text-green-300"
                  : "border-red-400 bg-red-500/10 text-red-300"
                : "border-transparent text-muted-foreground hover:text-foreground bg-black/20"
            }`}
          >
            {mode === "buy" ? `▲ Buy ${pool.symbol}` : `▼ Sell ${pool.symbol}`}
          </button>
        ))}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                direction === "buy"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {direction === "buy" ? "Market Buy" : "Market Sell"}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono border border-border">
            Fee: {feeBps / 100}%
          </span>
        </div>

        {direction === "sell" && commitBal <= 0 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-300">
            You do not hold {pool.symbol} for this project yet. Buy from the pool
            first or select a project token you already own.
          </div>
        )}

        {(needsUsdcApproval || needsCommitApproval) && inputNum > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-300">
            First approve the AMM to use your {fromLabel}. After that confirms,
            the same button will send the {direction} transaction.
          </div>
        )}

        {!needsUsdcApproval && !needsCommitApproval && inputNum > 0 && (
          <div className="rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] text-green-300">
            Approval is ready. The next wallet confirmation will execute the{" "}
            {direction}.
          </div>
        )}

        {/* from */}
        <div
          className={`rounded-lg p-3 space-y-1.5 border ${
            direction === "buy"
              ? "bg-green-500/5 border-green-500/20"
              : "bg-red-500/5 border-red-500/20"
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {direction === "buy" ? "You pay" : `You sell`}
            </span>
            <button
              className="text-[11px] text-primary hover:underline font-mono"
              onClick={() => onInputChange(userBalance.toFixed(6))}
            >
              Max: {fmtToken(userBalance)} {fromLabel}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.00"
              value={inputVal}
              onChange={(e) => onInputChange(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-mono font-bold outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 shrink-0">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">
                  {fromLabel[0]}
                </span>
              </div>
              <span className="text-sm font-bold">{fromLabel}</span>
            </div>
          </div>
          {/* % buttons */}
          <div className="flex gap-1.5 pt-0.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                disabled={userBalance <= 0}
                className="flex-1 text-[10px] py-1 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-mono"
                onClick={() =>
                  onInputChange(((userBalance * p) / 100).toFixed(6))
                }
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* flip */}
        <div className="flex justify-center -my-1">
          <button
            onClick={onFlip}
            className="p-2 rounded-full bg-card border border-border hover:border-primary/50 transition-all text-muted-foreground hover:text-foreground group shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
          </button>
        </div>

        {/* to */}
        <div className="bg-secondary/60 border border-border rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {direction === "buy" ? `You receive` : "You receive"}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Bal: {fmtToken(direction === "buy" ? commitBal : usdcBal)} {toLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex-1 text-2xl font-mono font-bold ${
                outputNum > 0
                  ? direction === "buy"
                    ? "text-green-400"
                    : "text-red-400"
                  : "text-muted-foreground/30"
              }`}
            >
              {outputNum > 0 ? fmtToken(outputNum) : "0.00"}
            </span>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 shrink-0">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">
                  {toLabel[0]}
                </span>
              </div>
              <span className="text-sm font-bold">{toLabel}</span>
            </div>
          </div>
        </div>

        {/* swap details */}
        {outputNum > 0 && (
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-[11px]">
            <div className="rounded-md border border-border bg-card/80 p-2">
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>Pool starting price</span>
                <span className="font-mono text-foreground">
                  {currentPriceLabel(pool)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-muted-foreground">
                <span>Average price for this swap</span>
                <span
                  className={`font-mono font-semibold ${
                    impact >= 5 ? "text-red-400" : "text-foreground"
                  }`}
                >
                  {fmtUSD(executionPrice)} per {pool.symbol}
                </span>
              </div>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {direction === "buy"
                  ? "USDC entering pool"
                  : `${pool.symbol} entering pool`}
              </span>
              <span className="font-mono text-foreground">
                {tradeVsPoolPct.toFixed(1)}% of current reserve
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Price impact</span>
              <span className={`font-mono font-semibold ${impactColor}`}>
                {impact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Min. received ({SLIPPAGE_BPS / 100}% slippage)</span>
              <span className="font-mono text-foreground">
                {fmtToken(minReceived)} {toLabel}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Fee ({feeBps / 100}%)</span>
              <span className="font-mono text-foreground">
                {fmtUSD((inputNum * feeBps) / 10_000)} {fromLabel}
              </span>
            </div>
          </div>
        )}

        {impact >= 5 && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">
              High price impact ({impact.toFixed(1)}%). The pool only has{" "}
              {fmtUSD(pool.poolUsdc)} USDC and {fmtToken(pool.poolCommit)}{" "}
              {pool.symbol}, so this trade moves far beyond the starting price.
            </p>
          </div>
        )}

        {writeError && (
          <p className="text-[11px] text-red-400 text-center">
            {writeError.message.slice(0, 80)}
          </p>
        )}

        {!hasEnoughInputBalance && inputNum > 0 && (
          <p className="text-[11px] text-red-400 text-center">
            Your wallet only has {fmtToken(userBalance)} {fromLabel}.
          </p>
        )}

        <Button
          className={`w-full h-12 text-sm font-bold gap-2 transition-all ${
            direction === "buy"
              ? "bg-green-500 hover:bg-green-400 text-black"
              : "bg-red-500 hover:bg-red-400 text-white"
          }`}
          disabled={
            !isConnected ||
            !canSellSelectedPool ||
            !hasEnoughInputBalance ||
            inputNum <= 0 ||
            isWriting ||
            isTxPending
          }
          onClick={onSwap}
        >
          {swapButtonLabel()}
        </Button>
      </CardContent>
    </Card>
  );
}
