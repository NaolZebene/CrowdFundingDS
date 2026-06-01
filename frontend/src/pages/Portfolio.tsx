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
  XCircle,
  Shield,
  TrendingDown,
} from "lucide-react";
import { Link } from "wouter";
import { useWallet } from "@/hooks/useWallet";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setHistoryTab } from "@/store/slices/portfolioSlice";
import type { TxRecord } from "@/store/slices/portfolioSlice";
import {
  usePortfolioData,
  type PortfolioPosition,
} from "@/hooks/usePortfolioData";
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
const fmtTimeLeft = (deadline: bigint): string => {
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  const secsLeft = deadlineNum - now;
  if (secsLeft <= 0) return "Expired";
  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
};

/* ─── sub-components ─── */
function SummaryCard({
  label, value, sub, subGreen, icon, accent,
}: {
  label: string; value: string; sub?: string; subGreen?: boolean; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-card border border-border rounded-2xl p-4 flex items-start gap-3 hover:border-primary/30 transition-colors group`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accent ?? "from-primary/5"} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative p-2.5 rounded-xl bg-secondary text-muted-foreground shrink-0">{icon}</div>
      <div className="relative min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
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
  onApproveRelease,
  onCancelVeto,
  onRefund,
  onClaimTimeoutRefund,
  onClaimVetoRefund,
  claimLoading,
  vetoLoading,
  approveReleaseLoading,
  cancelVetoLoading,
  refundLoading,
  timeoutRefundLoading,
  vetoRefundLoading,
  noYield,
}: {
  pos: PortfolioPosition;
  onClaimYield: () => void;
  onCastVeto: () => void;
  onApproveRelease: () => void;
  onCancelVeto: () => void;
  onRefund: () => void;
  onClaimTimeoutRefund: () => void;
  onClaimVetoRefund: () => void;
  claimLoading: boolean;
  vetoLoading: boolean;
  approveReleaseLoading: boolean;
  cancelVetoLoading: boolean;
  refundLoading: boolean;
  timeoutRefundLoading: boolean;
  vetoRefundLoading: boolean;
  noYield: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pnl = (pos.currentPrice - pos.entryPrice) * pos.tokensHeld;
  const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
  const fundedPct = pos.goal > 0 ? Math.min(100, Math.round((pos.raised / pos.goal) * 100)) : 0;
  const hasActiveVeto = pos.vetoOpen && pos.hasVoted;
  const canVote = pos.vetoOpen && !pos.hasVoted;
  const canApprove = pos.vetoOpen && !pos.releaseApproved && !pos.hasApproved;
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(pos.milestoneDeadline);
  const milestoneOverdue = milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !pos.projectDead;
  const milestoneDaysLeft = milestoneDeadlineSecs > now ? Math.ceil((milestoneDeadlineSecs - now) / 86400) : 0;
  const timeoutVoteEndsAt = pos.timeoutActive ? pos.timeoutOpenedAt + 3 * 86400 : 0;
  const timeoutVoteOver = pos.timeoutActive && now > timeoutVoteEndsAt;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-colors ${
      pos.projectDead ? "border-red-500/30 bg-red-500/5"
      : pos.timeoutActive ? "border-yellow-500/30 bg-yellow-500/5"
      : milestoneOverdue ? "border-orange-500/30 bg-orange-500/5"
      : pos.vetoOpen ? "border-orange-500/30 bg-orange-500/5"
      : "border-border hover:border-primary/20"
    }`}>
      {/* main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full grid grid-cols-12 gap-3 items-center px-4 py-3.5 hover:bg-secondary/30 transition-colors text-left"
      >
        {/* project */}
        <div className="col-span-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">{pos.symbol[0]}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-semibold truncate">{pos.name}</p>
              {pos.projectDead && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 font-bold uppercase tracking-wide">
                  Dead
                </span>
              )}
              {pos.timeoutActive && !pos.projectDead && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-bold uppercase tracking-wide">
                  Vote
                </span>
              )}
              {milestoneOverdue && !pos.timeoutActive && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold uppercase tracking-wide">
                  Overdue
                </span>
              )}
              {canVote && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold uppercase tracking-wide">
                  Against
                </span>
              )}
              {canApprove && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold uppercase tracking-wide">
                  In Favor
                </span>
              )}
              {hasActiveVeto && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-bold uppercase tracking-wide">
                  Against
                </span>
              )}
              {pos.vetoOpen && pos.hasApproved && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold uppercase tracking-wide">
                  In Favor
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{pos.symbol}</span>
          </div>
        </div>

        {/* tokens */}
        <div className="col-span-2 text-right hidden sm:block">
          <p className="text-xs font-mono font-semibold">{fmtToken(pos.tokensHeld)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{pos.symbol}</p>
        </div>

        {/* value */}
        <div className="col-span-2 text-right">
          <p className="text-xs font-mono font-semibold">{fmtUSD(pos.marketValue)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">@ {fmtUSD(pos.currentPrice)}</p>
        </div>

        {/* P&L */}
        <div className="col-span-2 text-right hidden md:block">
          <div className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${
            pnl >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {pnl >= 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
          </div>
          <p className={`text-[10px] font-mono ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
          </p>
        </div>

        {/* yield */}
        <div className="col-span-1 text-right hidden lg:block">
          <p className="text-xs font-mono font-semibold text-green-400">+{fmtUSD(pos.yieldClaimable)}</p>
          <p className="text-[10px] text-muted-foreground">yield</p>
        </div>

        {/* chevron */}
        <div className="col-span-1 flex justify-end">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="border-t border-border/60 bg-secondary/20 px-4 py-5 space-y-5">

          {/* milestone deadline info */}
          {milestoneDeadlineSecs > 0 && !pos.projectDead && !pos.timeoutActive && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
              milestoneOverdue
                ? "bg-orange-500/10 border border-orange-500/25 text-orange-400"
                : milestoneDaysLeft <= 7
                ? "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400"
                : "bg-secondary/40 border border-border text-muted-foreground"
            }`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {milestoneOverdue
                ? "Milestone deadline passed — any backer can trigger a vote on the project page."
                : `Next milestone due in ${milestoneDaysLeft} day${milestoneDaysLeft !== 1 ? "s" : ""}.`}
            </div>
          )}

          {/* timeout vote active banner */}
          {pos.timeoutActive && !pos.projectDead && (
            <div className={`flex items-start gap-3 rounded-xl p-3 ${
              timeoutVoteOver
                ? "bg-secondary/40 border border-border"
                : "bg-yellow-500/10 border border-yellow-500/25"
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${timeoutVoteOver ? "text-muted-foreground" : "text-yellow-400"}`} />
              <div>
                <p className={`text-xs font-semibold ${timeoutVoteOver ? "text-foreground" : "text-yellow-400"}`}>
                  {timeoutVoteOver ? "Vote window ended" : "Governance vote open"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {timeoutVoteOver
                    ? "The timeout vote window is over. Anyone can finalise the outcome on the project page."
                    : "Backers are voting to extend the deadline or refund. Cast your vote on the project page."}
                </p>
              </div>
            </div>
          )}

          {/* dead project — claim refund banner */}
          {pos.projectDead && (
            <div className="flex items-start gap-3 rounded-xl p-3 bg-red-500/10 border border-red-500/25">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-400">Project killed by governance</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Backers voted to end this project. Burn your CommitTokens to claim your pro-rata share.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 bg-red-600 hover:bg-red-700 shrink-0"
                onClick={onClaimTimeoutRefund}
                disabled={timeoutRefundLoading}
              >
                {timeoutRefundLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownLeft className="w-3 h-3" />}
                Claim Refund
              </Button>
            </div>
          )}

          {/* vetoed release — claim refund banner */}
          {pos.releaseVetoed && !pos.projectDead && (
            <div className="flex items-start gap-3 rounded-xl p-3 bg-orange-500/10 border border-orange-500/25">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-orange-400">Release blocked by backer votes</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enough backers voted against this release. You can exit and claim a pro-rata refund of remaining funds.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 shrink-0"
                onClick={onClaimVetoRefund}
                disabled={vetoRefundLoading}
              >
                {vetoRefundLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownLeft className="w-3 h-3" />}
                Claim Refund
              </Button>
            </div>
          )}

          {/* veto alert banner */}
          {pos.vetoOpen && (
            <div className={`flex items-start gap-3 rounded-xl p-3 ${
              hasActiveVeto
                ? "bg-yellow-500/10 border border-yellow-500/25"
                : "bg-orange-500/10 border border-orange-500/25"
            }`}>
              <Shield className={`w-4 h-4 shrink-0 mt-0.5 ${
                hasActiveVeto ? "text-yellow-400" : "text-orange-400"
              }`} />
              <div>
                <p className={`text-xs font-semibold ${
                  hasActiveVeto ? "text-yellow-400" : "text-orange-400"
                }`}>
                  {hasActiveVeto ? "Vote cast: Against" : "Vote window open"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {hasActiveVeto
                    ? "You voted against this release. You can retract your vote before the window closes."
                    : "A milestone release is pending. Vote against if you suspect misuse, or vote in favor to release early."}
                </p>
              </div>
            </div>
          )}

          {/* stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Entry Price",   value: fmtUSD(pos.entryPrice),   color: "" },
              { label: "Current Price", value: fmtUSD(pos.currentPrice), color: "" },
              { label: "Project Share", value: `${pos.projectSharePct.toFixed(2)}%`, color: "" },
              { label: "Unrealised P&L", value: `${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)}`,
                color: pnl >= 0 ? "text-green-400" : "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
                <p className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <Separator className="bg-border/60" />

          {/* funding progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Funding — {fmtUSD(pos.raised)} of {fmtUSD(pos.goal)}</span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {fmtTimeLeft(pos.fundingDeadline)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  fundedPct >= 80 ? "bg-gradient-to-r from-green-500 to-emerald-400"
                  : fundedPct >= 40 ? "bg-gradient-to-r from-primary to-blue-400"
                  : "bg-gradient-to-r from-yellow-500 to-orange-400"
                }`}
                style={{ width: `${Math.min(100, fundedPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{fundedPct}% funded</span>
              <span>{fmtUSD(pos.goal)} goal</span>
            </div>
          </div>

          {/* milestones */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Milestones — {pos.milestonesCompleted} of {pos.milestones} completed
            </p>
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

          {/* actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 shadow-sm shadow-primary/20"
              onClick={onClaimYield}
              disabled={claimLoading || noYield}
            >
              {claimLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
              Claim {fmtUSD(pos.yieldClaimable)} Yield
            </Button>

            <Link href="/amm">
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5">
                <ArrowUpRight className="w-3 h-3" /> Trade on AMM
              </Button>
            </Link>

            {/* vote against */}
            {canVote && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={onCastVeto}
                disabled={vetoLoading}
              >
                {vetoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                Vote Against
              </Button>
            )}
            {/* vote in favor */}
            {canApprove && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={onApproveRelease}
                disabled={approveReleaseLoading}
              >
                {approveReleaseLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Vote In Favor Of
              </Button>
            )}

            {/* cancel vote */}
            {hasActiveVeto && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                onClick={onCancelVeto}
                disabled={cancelVetoLoading}
              >
                {cancelVetoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Cancel Vote
              </Button>
            )}

            {/* refund */}
            {pos.refundable && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={onRefund}
                disabled={refundLoading}
              >
                {refundLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownLeft className="w-3 h-3" />}
                Refund Failed Project
              </Button>
            )}
          </div>

          {pos.metadataUri && (
            <p className="text-[10px] text-muted-foreground break-all font-mono">
              {pos.metadataUri}
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

function ProjectShareList({ positions }: { positions: PortfolioPosition[] }) {
  return (
    <div className="space-y-3">
      {positions.map((pos) => (
        <div key={String(pos.id)} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{pos.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {fmtToken(pos.tokensHeld)} / {fmtToken(pos.totalProjectTokens)} {pos.symbol}
              </p>
            </div>
            <span className="shrink-0 text-xs font-mono font-semibold">
              {pos.projectSharePct.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, pos.projectSharePct))}%` }}
            />
          </div>
        </div>
      ))}
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
    harvestYieldLoading,
    harvestYield: handleHarvestYield,
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
    claimYield:          handleClaimYield,
    castVeto:            handleVeto,
    approveRelease:      handleApproveRelease,
    cancelVeto:          handleCancelVeto,
    refund:              handleRefund,
    claimTimeoutRefund:  handleClaimTimeoutRefund,
    claimVetoRefund:     handleClaimVetoRefund,
    refetch:             handleRefreshPositions,
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
  const totalCurrent  = positions.reduce((s, p) => s + p.marketValue, 0);
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
            <div className="flex items-center shrink-0 cursor-pointer">
              <span className="font-bold text-sm tracking-wide">Raise</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets",    href: "/" },
              { label: "AMM Swap",   href: "/amm" },
              { label: "Portfolio",  href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1.5">My Portfolio</p>
            <h1 className="text-2xl font-bold tracking-tight">Positions &amp; Yield</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Yield is harvested from the lender, then proportionally distributed by position value.
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
              variant="outline"
              className="h-9 gap-1.5 text-xs px-4 border-primary/40 hover:bg-primary/10"
              onClick={handleHarvestYield}
              disabled={harvestYieldLoading}
            >
              {harvestYieldLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Harvest Yield
            </Button>
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs px-4 shadow-sm shadow-primary/20"
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
            accent="from-primary/8"
          />
          <SummaryCard
            label="Total Invested"
            value={isLoading ? "..." : fmtUSD(totalInvested)}
            sub={isLoading ? undefined : `${positions.length} active position${positions.length !== 1 ? "s" : ""}`}
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
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold border-b border-border">
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
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                  <BarChart2 className="w-6 h-6 text-muted-foreground opacity-60" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No positions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invest in a project on the Markets page to see your positions here.
                  </p>
                </div>
                <Link href="/">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-xl">
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
                    onClaimTimeoutRefund={() => handleClaimTimeoutRefund(pos.id)}
                    onClaimVetoRefund={() => handleClaimVetoRefund(pos.id)}
                    claimLoading={claimYieldLoading}
                    vetoLoading={vetoLoading && votingId === pos.id}
                    approveReleaseLoading={approveReleaseLoading && approvingId === pos.id}
                    cancelVetoLoading={cancelVetoLoading && cancellingId === pos.id}
                    refundLoading={refundLoading && refundingId === pos.id}
                    timeoutRefundLoading={timeoutRefundLoading && timeoutRefundingId === pos.id}
                    vetoRefundLoading={vetoRefundLoading && vetoRefundingId === pos.id}
                    noYield={totalYieldClaimable <= 0}
                  />
                ))}
              </div>
            )}

            {positions.some((p) => p.vetoOpen) && (
              <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl p-3.5">
                <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-400">Vote window active</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {positions.some((p) => p.vetoOpen && !p.hasVoted)
                      ? "One or more projects have an open vote window. Expand a position to vote for or against a release."
                      : "You have active votes. You can cancel them from the position detail before the window closes."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ── */}
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
            {positions.length > 0 && (
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
                            <span className="text-[9px] font-bold text-primary">{p.symbol[0]}</span>
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{p.name}</span>
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
                    <span className="text-sm font-mono font-bold text-green-400">+{fmtUSD(totalYieldClaimable)}</span>
                  </div>
                  <Button
                    className="w-full h-9 text-xs gap-1.5 rounded-xl shadow-sm shadow-primary/20"
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
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">
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

        {/* ── Transaction history ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Transaction History</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {historyLoading ? "Fetching indexed history..." : `${history.length} transaction${history.length !== 1 ? "s" : ""} indexed`}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
              {(["all", "invest", "yield", "sell"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => dispatch(setHistoryTab(tab))}
                  className={`text-[11px] px-3 py-1.5 rounded-lg capitalize transition-colors font-medium ${
                    historyTab === tab
                      ? "bg-card text-foreground shadow-sm"
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
                <span className="text-xs">Reading indexed history...</span>
              </div>
            ) : historyError ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">Failed to load history from the subgraph</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Activity className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">
                  {historyTab === "all" ? "No indexed transactions yet." : `No indexed ${historyTab} transactions found.`}
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
      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
