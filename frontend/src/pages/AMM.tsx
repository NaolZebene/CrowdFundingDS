import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectProject, flipDirection, setDirection, setInputVal, setSearch } from "@/store/slices/ammSlice";
import { useAmmData } from "@/hooks/useAmmData";
import { useAmmIndexedData, type ChartRange } from "@/hooks/useAmmIndexedData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useWallet } from "@/hooks/useWallet";
import {
  TickerBar,
  ProjectSelector,
  CandlestickChart,
  MarketWatchlist,
  MarketPreview,
  MarketRequirements,
  SwapInterface,
  TradeHistory,
} from "@/components/amm";
import { fmtUSD, fmtSignedPct, currentPriceLabel } from "@/utils/ammFormatters";

function StatsRow({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4 mb-4">
      {stats.map((s) => (
        <Card key={s.label} className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {s.label}
            </p>
            <p className="mt-1 text-lg font-mono font-semibold">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AMM() {
  const dispatch = useAppDispatch();
  const { role } = useWallet();
  const selectedProjectId = useAppSelector((s) => s.amm.selectedProjectId);
  const direction = useAppSelector((s) => s.amm.direction);
  const inputVal = useAppSelector((s) => s.amm.inputVal);
  const search = useAppSelector((s) => s.amm.search);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>("1H");

  const {
    pools,
    pool,
    feeBps,
    usdcBal,
    commitBal,
    outputNum,
    minReceived,
    impact,
    isWriting,
    isTxPending,
    isTxSuccess,
    writeError,
    isConnected,
    lastAction,
    needsUsdcApproval,
    needsCommitApproval,
    hasEnoughInputBalance,
    canSellSelectedPool,
    swap: handleSwap,
  } = useAmmData(selectedProjectId, direction, inputVal);

  const { chartPoints, recentTrades, loading: indexedLoading } =
    useAmmIndexedData(pool?.id ?? selectedProjectId, chartRange);

  const marketList = pools;
  const selectedMarket = marketList.find((c) => c.id === selectedProjectId) ?? marketList[0];
  const indexedMarketCount = pools.filter((c) => c.indexed).length;

  const inputNum = parseFloat(inputVal) || 0;
  const executionPrice =
    inputNum > 0 && outputNum > 0
      ? direction === "buy"
        ? inputNum / outputNum
        : outputNum / inputNum
      : 0;
  const tradeVsPoolPct =
    pool && inputNum > 0
      ? (inputNum / Math.max(direction === "buy" ? pool.poolUsdc : pool.poolCommit, 0.000001)) * 100
      : 0;

  const chartFirst = chartPoints[0];
  const chartLast = chartPoints[chartPoints.length - 1];
  const chartChangePct =
    chartFirst && chartLast && chartFirst.open > 0
      ? ((chartLast.close - chartFirst.open) / chartFirst.open) * 100
      : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0 cursor-pointer">
            <span className="font-bold text-sm">Raise</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button
                  className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                    l.href === "/amm" ? "bg-secondary text-foreground" : ""
                  }`}
                >
                  {l.label}
                </button>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 hidden sm:flex"
              onClick={() => setShowSubmitModal(true)}
            >
              <Plus className="w-3.5 h-3.5" /> List Project
            </Button>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <TickerBar pools={pools} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
              Decentralised Exchange
            </p>
            <h1 className="text-2xl font-bold">Market Place</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trade project CommitTokens against USDC. Constant-product AMM with live pool pricing.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live · Sepolia
          </div>
        </div>

        <StatsRow stats={[
          { label: "Projects", value: marketList.length },
          { label: "Available", value: marketList.length },
          { label: "Tradable", value: marketList.length },
          { label: "Indexed", value: indexedMarketCount },
        ]} />

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {/* Market Watchlist */}
            <MarketWatchlist
              markets={marketList}
              selectedId={selectedMarket?.id ?? selectedProjectId}
              onSelect={(id) => dispatch(selectProject(id))}
              search={search}
              onSearchChange={(v) => dispatch(setSearch(v))}
            />

            {/* Chart + selector */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="flex flex-col border-b border-border bg-black/20">
                <div className="flex items-stretch">
                  <div className="flex-1">
                    <ProjectSelector
                      pools={pools}
                      selectedId={selectedMarket?.id ?? selectedProjectId}
                      onSelect={(id) => dispatch(selectProject(id))}
                      search={search}
                      onSearchChange={(v) => dispatch(setSearch(v))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t border-border/60">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-mono font-bold">
                      {selectedMarket?.price
                        ? fmtUSD(selectedMarket.price)
                        : "—"}
                    </span>
                    {chartChangePct !== 0 && (
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] ${
                          chartChangePct >= 0
                            ? "border-green-500/40 text-green-400 bg-green-500/10"
                            : "border-red-500/40 text-red-400 bg-red-500/10"
                        }`}
                      >
                        {fmtSignedPct(chartChangePct)} ({chartRange})
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {currentPriceLabel(selectedMarket)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(["1H", "6H", "1D", "1W"] as ChartRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setChartRange(r)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                          chartRange === r
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {pools.length > 0 ? (
                <CandlestickChart points={chartPoints} isLoading={indexedLoading} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No market data available
                </div>
              )}
            </Card>

            {/* Trade History - only show when pools exist */}
            {pools.length > 0 && (
              <TradeHistory trades={recentTrades} isLoading={indexedLoading} />
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <MarketPreview pool={selectedMarket} role={role} />
            <MarketRequirements pool={selectedMarket} />

            {pool && (
              <SwapInterface
                pool={pool}
                direction={direction}
                inputVal={inputVal}
                inputNum={inputNum}
                outputNum={outputNum}
                usdcBal={usdcBal}
                commitBal={commitBal}
                userBalance={direction === "buy" ? usdcBal : commitBal}
                executionPrice={executionPrice}
                tradeVsPoolPct={tradeVsPoolPct}
                impact={impact}
                minReceived={minReceived}
                feeBps={feeBps}
                isConnected={isConnected}
                isWriting={isWriting}
                isTxPending={isTxPending}
                isTxSuccess={isTxSuccess}
                writeError={writeError}
                lastAction={lastAction}
                needsUsdcApproval={needsUsdcApproval}
                needsCommitApproval={needsCommitApproval}
                hasEnoughInputBalance={hasEnoughInputBalance}
                canSellSelectedPool={canSellSelectedPool}
                onDirectionChange={(dir) => dispatch(setDirection(dir))}
                onInputChange={(val) => dispatch(setInputVal(val))}
                onFlip={() => dispatch(flipDirection())}
                onSwap={handleSwap}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Raise</span>
          <span>Ethereum Sepolia</span>
        </div>
      </footer>

      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
