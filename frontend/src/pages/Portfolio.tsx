import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Landmark,
  Plus,
  TrendingUp,
  Wallet,
  BarChart2,
  Zap,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { useWallet } from "@/hooks/useWallet";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setHistoryTab } from "@/store/slices/portfolioSlice";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import {
  SummaryCard,
  PositionRow,
  ProjectShareList,
  YieldBreakdown,
  QuickActions,
  TransactionHistory,
} from "@/components/portfolio";
import { fmtUSD } from "@/utils/portfolioFormatters";

export default function Portfolio() {
  const { isConnected, isWrongNetwork, role } = useWallet();
  const dispatch = useAppDispatch();
  const historyTab = useAppSelector((s) => s.portfolio.historyTab);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  /* Contract data & actions */
  const {
    positions,
    totalYieldClaimable,
    isLoading,
    claimYieldLoading,
    vetoLoading,
    approveReleaseLoading,
    approvingId,
    cancelVetoLoading,
    votingId,
    cancellingId,
    refundLoading,
    refundingId,
    timeoutRefundLoading,
    timeoutRefundingId,
    vetoRefundLoading,
    vetoRefundingId,
    claimYield: handleClaimYield,
    castVeto: handleVeto,
    approveRelease: handleApproveRelease,
    cancelVeto: handleCancelVeto,
    refund: handleRefund,
    claimTimeoutRefund: handleClaimTimeoutRefund,
    claimVetoRefund: handleClaimVetoRefund,
    refetch: handleRefreshPositions,
  } = usePortfolioData();

  const {
    history,
    isLoading: historyLoading,
    isError: historyError,
    refetch: handleRefreshHistory,
  } = useTransactionHistory();

  function handleRefresh() {
    handleRefreshPositions();
    handleRefreshHistory();
  }

  /* Derived summary */
  const totalInvested = positions.reduce(
    (s, p) => s + p.tokensHeld * p.entryPrice,
    0
  );
  const totalCurrent = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const filteredHistory =
    historyTab === "all" ? history : history.filter((h) => h.type === historyTab);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center shrink-0 cursor-pointer">
              <span className="font-bold text-sm tracking-wide">Raise</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin"
                ? [{ label: "Admin Dashboard", href: "/dashboard" }]
                : []),
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button
                  className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                    l.href === "/portfolio" ? "bg-secondary text-foreground" : ""
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

      {!isConnected || isWrongNetwork ? (
        <ConnectPrompt />
      ) : (
        <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1.5">
                My Portfolio
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                Positions &amp; Yield
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Yield is harvested from the lender, then proportionally
                distributed by position value.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border hover:border-primary/40 bg-card"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs px-4 shadow-sm shadow-primary/20"
                onClick={handleClaimYield}
                disabled={claimYieldLoading || totalYieldClaimable <= 0}
              >
                {claimYieldLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Claim All Yield
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Portfolio Value"
              value={isLoading ? "..." : fmtUSD(totalCurrent)}
              sub={
                isLoading
                  ? undefined
                  : `${totalPnl >= 0 ? "+" : ""}${fmtUSD(totalPnl)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%) all time`
              }
              subGreen={totalPnl >= 0}
              icon={<Wallet className="w-4 h-4" />}
              accent="from-primary/8"
            />
            <SummaryCard
              label="Total Invested"
              value={isLoading ? "..." : fmtUSD(totalInvested)}
              sub={
                isLoading
                  ? undefined
                  : `${positions.length} active position${positions.length !== 1 ? "s" : ""}`
              }
              icon={<BarChart2 className="w-4 h-4" />}
              accent="from-blue-500/8"
            />
            <SummaryCard
              label="Yield Claimable"
              value={isLoading ? "..." : fmtUSD(totalYieldClaimable)}
              sub="Ready to claim now"
              subGreen
              icon={<Zap className="w-4 h-4" />}
              accent="from-green-500/8"
            />
            <SummaryCard
              label="Active Positions"
              value={isLoading ? "..." : String(positions.length)}
              sub="On Sepolia testnet"
              icon={<TrendingUp className="w-4 h-4" />}
              accent="from-purple-500/8"
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Positions list */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Open Positions</h2>
                <span className="text-[11px] text-muted-foreground">
                  {isLoading
                    ? "Loading..."
                    : `${positions.length} position${positions.length !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* table header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold border-b border-border">
                <span className="col-span-4">Project</span>
                <span className="col-span-2 text-right hidden sm:block">
                  Tokens
                </span>
                <span className="col-span-2 text-right">Value</span>
                <span className="col-span-2 text-right hidden md:block">
                  P&amp;L
                </span>
                <span className="col-span-1 text-right hidden lg:block">
                  Yield
                </span>
                <span className="col-span-1" />
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading positions…</span>
                </div>
              ) : positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                    <BarChart2 className="w-6 h-6 text-muted-foreground opacity-60" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">No positions yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Invest in a project on the Markets page to see your
                      positions here.
                    </p>
                  </div>
                  <Link href="/">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 rounded-xl"
                    >
                      <Activity className="w-3.5 h-3.5" /> Browse Markets
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <PositionRow
                      key={String(pos.id)}
                      pos={pos}
                      onClaimYield={handleClaimYield}
                      onCastVeto={() => handleVeto(pos.id)}
                      onApproveRelease={() => handleApproveRelease(pos.id)}
                      onCancelVeto={() => handleCancelVeto(pos.id)}
                      onRefund={() => handleRefund(pos.id)}
                      onClaimTimeoutRefund={() =>
                        handleClaimTimeoutRefund(pos.id)
                      }
                      onClaimVetoRefund={() => handleClaimVetoRefund(pos.id)}
                      claimLoading={claimYieldLoading}
                      vetoLoading={vetoLoading && votingId === pos.id}
                      approveReleaseLoading={
                        approveReleaseLoading && approvingId === pos.id
                      }
                      cancelVetoLoading={
                        cancelVetoLoading && cancellingId === pos.id
                      }
                      refundLoading={refundLoading && refundingId === pos.id}
                      timeoutRefundLoading={
                        timeoutRefundLoading && timeoutRefundingId === pos.id
                      }
                      vetoRefundLoading={
                        vetoRefundLoading && vetoRefundingId === pos.id
                      }
                      noYield={totalYieldClaimable <= 0}
                    />
                  ))}
                </div>
              )}

              {positions.some((p) => p.vetoOpen) && (
                <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl p-3.5">
                  <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-orange-400">
                      Vote window active
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {positions.some((p) => p.vetoOpen && !p.hasVoted)
                        ? "One or more projects have an open vote window. Expand a position to vote for or against a release."
                        : "You have active votes. You can cancel them from the position detail before the window closes."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* project share */}
              {positions.length > 0 && (
                <Card className="bg-card border-border rounded-2xl">
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">
                      Project Share
                    </p>
                    <ProjectShareList positions={positions} />
                  </CardContent>
                </Card>
              )}

              {/* yield breakdown */}
              <YieldBreakdown
                positions={positions}
                totalYieldClaimable={totalYieldClaimable}
                claimYieldLoading={claimYieldLoading}
                onClaimYield={handleClaimYield}
              />

              {/* quick actions */}
              <QuickActions />
            </div>
          </div>

          {/* Transaction history */}
          <TransactionHistory
            history={history}
            filteredHistory={filteredHistory}
            isLoading={historyLoading}
            isError={historyError}
            historyTab={historyTab}
            onTabChange={(tab) => dispatch(setHistoryTab(tab))}
          />
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Landmark className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Raise</span>
            <span>— Ethereum Sepolia testnet</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Solidity · React · wagmi · Aave</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
      <SubmitProjectModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
      />
    </div>
  );
}
