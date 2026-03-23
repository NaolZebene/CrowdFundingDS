import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Landmark,
  Plus,
  TrendingUp,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  CircleDot,
  AlertCircle,
  Wallet,
  BarChart2,
  Zap,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Activity,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { useWallet } from "@/hooks/useWallet";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setHistoryTab } from "@/store/slices/portfolioSlice";
import type { TxRecord } from "@/store/slices/portfolioSlice";
import { usePortfolioData, type PortfolioPosition } from "@/hooks/usePortfolioData";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { CONTRACTS } from "@/config/contracts";

/* ─── helpers ─── */
const fmtUSD = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtToken = (n: number) => (n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(2));
const fmtTime = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
  " · " +
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

/* ─── sub-components ─── */
function SummaryCard({
  label, value, sub, subGreen, icon,
}: {
  label: string; value: string; sub?: string; subGreen?: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 rounded-md bg-secondary text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-mono font-bold leading-tight">{value}</p>
        {sub && (
          <p className={`text-[11px] font-mono mt-0.5 ${subGreen ? "text-green-400" : "text-muted-foreground"}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function MilestoneBar({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < completed ? "bg-primary" : "bg-secondary"}`}
        />
      ))}
    </div>
  );
}

function PositionRow({
  pos,
  onClaimYield,
  onCastVeto,
  claimLoading,
  vetoLoading,
  noYield,
}: {
  pos: PortfolioPosition;
  onClaimYield: () => void;
  onCastVeto: () => void;
  claimLoading: boolean;
  vetoLoading: boolean;
  noYield: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pnl = (pos.currentPrice - pos.entryPrice) * pos.tokensHeld;
  const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
  const posValue = pos.tokensHeld * pos.currentPrice;
  const fundedPct = pos.goal > 0 ? Math.round((pos.raised / pos.goal) * 100) : 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
      >
        {/* project */}
        <div className="col-span-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{pos.symbol[0]}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold truncate">{pos.name}</p>
              {pos.vetoOpen && !pos.hasVoted && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400 font-semibold">
                  VETO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted-foreground">{pos.symbol}</span>
            </div>
          </div>
        </div>

        {/* tokens */}
        <div className="col-span-2 text-right hidden sm:block">
          <p className="text-xs font-mono font-semibold">{fmtToken(pos.tokensHeld)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{pos.symbol}</p>
        </div>

        {/* value */}
        <div className="col-span-2 text-right">
          <p className="text-xs font-mono font-semibold">{fmtUSD(posValue)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">@ {fmtUSD(pos.currentPrice)}</p>
        </div>

        {/* P&L */}
        <div className="col-span-2 text-right hidden md:block">
          <p className={`text-xs font-mono font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
          </p>
          <p className={`text-[10px] font-mono ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
          </p>
        </div>

        {/* yield */}
        <div className="col-span-1 text-right hidden lg:block">
          <p className="text-xs font-mono font-semibold text-green-400">
            +{fmtUSD(pos.yieldClaimable)}
          </p>
          <p className="text-[10px] text-muted-foreground">claimable</p>
        </div>

        {/* chevron */}
        <div className="col-span-1 flex justify-end">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-secondary/30 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Entry Price</p>
              <p className="text-sm font-mono font-semibold">{fmtUSD(pos.entryPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Price</p>
              <p className="text-sm font-mono font-semibold">{fmtUSD(pos.currentPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tokens Held</p>
              <p className="text-sm font-mono font-semibold">{fmtToken(pos.tokensHeld)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">P&L</p>
              <p className={`text-sm font-mono font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Funding progress — {fundedPct}% of {fmtUSD(pos.goal)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" /> {pos.daysLeft}d left
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full ${fundedPct >= 80 ? "bg-green-500" : fundedPct >= 40 ? "bg-primary" : "bg-yellow-500"}`}
                style={{ width: `${Math.min(100, fundedPct)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Milestones — {pos.milestonesCompleted} of {pos.milestones} completed
              </p>
              {pos.vetoOpen && !pos.hasVoted && (
                <span className="text-[10px] text-orange-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Veto window open
                </span>
              )}
            </div>
            <MilestoneBar completed={pos.milestonesCompleted} total={pos.milestones} />
            <div className="flex gap-1.5 pt-0.5">
              {Array.from({ length: pos.milestones }).map((_, i) => (
                <div key={i} className="flex-1 flex items-center gap-1">
                  {i < pos.milestonesCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                  ) : i === pos.milestonesCompleted ? (
                    <CircleDot className="w-3 h-3 text-yellow-400 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-border shrink-0" />
                  )}
                  <span className="text-[9px] text-muted-foreground">M{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={onClaimYield}
              disabled={claimLoading || noYield}
            >
              {claimLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Coins className="w-3 h-3" />
              )}
              Claim {fmtUSD(pos.yieldClaimable)} Yield
            </Button>
            <Link href="/amm">
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5">
                <ArrowUpRight className="w-3 h-3" /> Trade on AMM
              </Button>
            </Link>
            {pos.vetoOpen && !pos.hasVoted && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1.5 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={onCastVeto}
                disabled={vetoLoading}
              >
                {vetoLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                Cast Veto Vote
              </Button>
            )}
            {pos.vetoOpen && pos.hasVoted && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 px-2">
                <CheckCircle2 className="w-3 h-3 text-green-400" /> Vote cast
              </span>
            )}
          </div>

          {pos.metadataUri && (
            <p className="text-[10px] text-muted-foreground break-all">
              Metadata: {pos.metadataUri}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ tx }: { tx: TxRecord }) {
  const isInvest = tx.type === "invest";
  const isYield  = tx.type === "yield";
  const isSell   = tx.type === "sell";

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
          <p className="text-[10px] text-muted-foreground font-mono">{fmtToken(tx.tokens)} tkn</p>
        )}
      </div>
      <div className="col-span-3 text-right">
        <p className={`text-xs font-mono font-semibold ${amountColor}`}>
          {isYield ? "+" : isSell ? "+" : "-"}{fmtUSD(tx.amount)}
        </p>
        {tx.price > 0 && (
          <p className="text-[10px] text-muted-foreground font-mono">@ {fmtUSD(tx.price)}</p>
        )}
      </div>
      <div className="col-span-2 text-right">
        <p className="text-[10px] text-muted-foreground font-mono">{fmtTime(new Date(tx.date))}</p>
      </div>
    </div>
  );
}

/* ─── Allocation pie (SVG) ─── */
function AllocationChart({ positions }: { positions: PortfolioPosition[] }) {
  const total = positions.reduce((s, p) => s + p.tokensHeld * p.currentPrice, 0);
  if (total === 0) return null;

  const colors = ["hsl(var(--primary))", "#3b82f6", "#a855f7", "#f59e0b", "#10b981", "#ef4444"];
  const data = positions.map((p, i) => ({
    label: p.symbol,
    value: (p.tokensHeld * p.currentPrice) / total,
    color: colors[i % colors.length],
  }));

  const cx = 60; const cy = 60; const r = 50; const inner = 30;
  let startAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = d.value * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + inner * Math.cos(startAngle);
    const iy1 = cy + inner * Math.sin(startAngle);
    const ix2 = cx + inner * Math.cos(endAngle);
    const iy2 = cy + inner * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
    startAngle = endAngle;
    return { ...d, path };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
        {slices.map((s) => (
          <path key={s.label} d={s.path} fill={s.color} opacity={0.9} />
        ))}
        <text x="60" y="57" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">
          {positions.length}
        </text>
        <text x="60" y="67" textAnchor="middle" fill="gray" fontSize="6">
          positions
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-[11px] font-mono text-muted-foreground w-8">{d.label}</span>
            <span className="text-[11px] font-mono font-semibold">{(d.value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main page ─── */
export default function Portfolio() {
  const { isConnected, isWrongNetwork, role } = useWallet();
  const dispatch   = useAppDispatch();
  const historyTab = useAppSelector((s) => s.portfolio.historyTab);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  /* ── contract data & actions ── */
  const {
    positions,
    totalYieldClaimable,
    isLoading,
    claimYieldLoading,
    vetoLoading,
    votingId,
    claimYield: handleClaimYield,
    castVeto:   handleVeto,
    refetch:    handleRefreshPositions,
  } = usePortfolioData();

  const {
    history,
    isLoading: historyLoading,
    isError:   historyError,
    refetch:   handleRefreshHistory,
  } = useTransactionHistory();

  function handleRefresh() {
    handleRefreshPositions();
    handleRefreshHistory();
  }

  /* ── derived summary ── */
  const totalInvested = positions.reduce((s, p) => s + p.tokensHeld * p.entryPrice, 0);
  const totalCurrent  = positions.reduce((s, p) => s + p.tokensHeld * p.currentPrice, 0);
  const totalPnl      = totalCurrent - totalInvested;
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const filteredHistory =
    historyTab === "all" ? history : history.filter((h) => h.type === historyTab);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 shrink-0 cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-wide">CrowdVault</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets",    href: "/" },
              { label: "AMM Swap",   href: "/amm" },
              { label: "Portfolio",  href: "/portfolio" },
              { label: "Governance", href: "/governance" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                  l.href === "/portfolio" ? "bg-secondary text-foreground" : ""
                }`}>
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

      {(!isConnected || isWrongNetwork) ? <ConnectPrompt /> : (
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">My Portfolio</p>
            <h1 className="text-2xl font-bold">Positions & Yield</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:border-primary/40"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleClaimYield}
              disabled={claimYieldLoading || totalYieldClaimable <= 0}
            >
              {claimYieldLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Coins className="w-3.5 h-3.5" />
              )}
              Claim All Yield
            </Button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Portfolio Value"
            value={isLoading ? "..." : fmtUSD(totalCurrent)}
            sub={isLoading ? undefined : `${totalPnl >= 0 ? "+" : ""}${fmtUSD(totalPnl)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%) all time`}
            subGreen={totalPnl >= 0}
            icon={<Wallet className="w-4 h-4" />}
          />
          <SummaryCard
            label="Total Invested"
            value={isLoading ? "..." : fmtUSD(totalInvested)}
            sub={isLoading ? undefined : `${positions.length} active position${positions.length !== 1 ? "s" : ""}`}
            icon={<BarChart2 className="w-4 h-4" />}
          />
          <SummaryCard
            label="Yield Claimable"
            value={isLoading ? "..." : fmtUSD(totalYieldClaimable)}
            sub="Ready to claim now"
            subGreen
            icon={<Zap className="w-4 h-4" />}
          />
          <SummaryCard
            label="Active Positions"
            value={isLoading ? "..." : String(positions.length)}
            sub="On Sepolia testnet"
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Positions list ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Open Positions</h2>
              <span className="text-[11px] text-muted-foreground">
                {isLoading ? "Loading..." : `${positions.length} position${positions.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {/* table header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium border-b border-border">
              <span className="col-span-4">Project</span>
              <span className="col-span-2 text-right hidden sm:block">Tokens</span>
              <span className="col-span-2 text-right">Value</span>
              <span className="col-span-2 text-right hidden md:block">P&amp;L</span>
              <span className="col-span-1 text-right hidden lg:block">Yield</span>
              <span className="col-span-1" />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading positions…</span>
              </div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart2 className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm font-medium">No positions found</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Invest in a project on the Markets page to see your positions here.
                </p>
                <Link href="/">
                  <Button size="sm" variant="outline" className="mt-4 h-8 text-xs gap-1.5">
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
                    claimLoading={claimYieldLoading}
                    vetoLoading={vetoLoading && votingId === pos.id}
                    noYield={totalYieldClaimable <= 0}
                  />
                ))}
              </div>
            )}

            {positions.some((p) => p.vetoOpen && !p.hasVoted) && (
              <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/25 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-400">Veto window open</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    One of your projects has an active veto vote. Expand the position to cast your vote before the window closes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">

            {/* allocation */}
            {positions.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">
                    Allocation
                  </p>
                  <AllocationChart positions={positions} />
                </CardContent>
              </Card>
            )}

            {/* yield breakdown */}
            {positions.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Yield Breakdown
                  </p>
                  <div className="space-y-2">
                    {positions.map((p) => (
                      <div key={String(p.id)} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-primary">{p.symbol[0]}</span>
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono font-semibold text-green-400">
                            +{fmtUSD(p.yieldClaimable)}
                          </p>
                        </div>
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
                    className="w-full h-8 text-xs gap-1.5"
                    size="sm"
                    onClick={handleClaimYield}
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
            )}

            {/* quick actions */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                  Quick Actions
                </p>
                {[
                  { label: "Browse New Projects", href: "/",    icon: <Activity className="w-3.5 h-3.5" /> },
                  { label: "Swap CommitTokens",   href: "/amm", icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
                  {
                    label: "View on Etherscan",
                    href: `https://sepolia.etherscan.io/address/${CONTRACTS.VAULT}`,
                    icon: <ExternalLink className="w-3.5 h-3.5" />,
                    external: true,
                  },
                ].map((a) => (
                  a.external ? (
                    <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer">
                      <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-xs font-medium group">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">{a.icon}</span>
                          {a.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </a>
                  ) : (
                    <Link key={a.label} href={a.href}>
                      <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-xs font-medium group">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">{a.icon}</span>
                          {a.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </Link>
                  )
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Transaction history (mock) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Transaction History</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {historyLoading ? "Fetching on-chain events…" : `${history.length} transaction${history.length !== 1 ? "s" : ""} on-chain`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(["all", "invest", "yield", "sell"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => dispatch(setHistoryTab(tab))}
                  className={`text-[11px] px-2.5 py-1 rounded capitalize transition-colors font-medium ${
                    historyTab === tab
                      ? "bg-secondary text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
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

            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Reading on-chain events…</span>
              </div>
            ) : historyError ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">Failed to load history — check RPC connection</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Activity className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">
                  {historyTab === "all" ? "No transactions found on-chain yet." : `No ${historyTab} transactions found.`}
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

      </main>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Landmark className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">CrowdVault</span>
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
      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
