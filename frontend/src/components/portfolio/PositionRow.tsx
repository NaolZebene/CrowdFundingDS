import { useState } from "react";
import {
  ChevronDown,
  Clock,
  XCircle,
  AlertCircle,
  Shield,
  CheckCircle2,
  CircleDot,
  Coins,
  ArrowUpRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import type { PortfolioPosition } from "@/hooks/usePortfolioData";
import { fmtUSD, fmtToken, fmtTimeLeft } from "@/utils/portfolioFormatters";
import { MilestoneBar } from "./MilestoneBar";

interface PositionRowProps {
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
}

export function PositionRow({
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
}: PositionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const pnl = (pos.currentPrice - pos.entryPrice) * pos.tokensHeld;
  const pnlPct =
    ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
  const fundedPct =
    pos.goal > 0 ? Math.min(100, Math.round((pos.raised / pos.goal) * 100)) : 0;
  const hasActiveVeto = pos.vetoOpen && pos.hasVoted;
  const canVote = pos.vetoOpen && !pos.hasVoted;
  const canApprove = pos.vetoOpen && !pos.releaseApproved && !pos.hasApproved;

  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(pos.milestoneDeadline);
  const milestoneOverdue =
    milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !pos.projectDead;
  const milestoneDaysLeft =
    milestoneDeadlineSecs > now
      ? Math.ceil((milestoneDeadlineSecs - now) / 86400)
      : 0;
  const timeoutVoteEndsAt = pos.timeoutActive
    ? pos.timeoutOpenedAt + 3 * 86400
    : 0;
  const timeoutVoteOver = pos.timeoutActive && now > timeoutVoteEndsAt;

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-colors ${
        pos.projectDead
          ? "border-red-500/30 bg-red-500/5"
          : pos.timeoutActive
            ? "border-yellow-500/30 bg-yellow-500/5"
            : milestoneOverdue
              ? "border-orange-500/30 bg-orange-500/5"
              : pos.vetoOpen
                ? "border-orange-500/30 bg-orange-500/5"
                : "border-border hover:border-primary/20"
      }`}
    >
      {/* main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full grid grid-cols-12 gap-3 items-center px-4 py-3.5 hover:bg-secondary/30 transition-colors text-left"
      >
        {/* project */}
        <div className="col-span-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">
              {pos.symbol[0]}
            </span>
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
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {pos.symbol}
            </span>
          </div>
        </div>

        {/* tokens */}
        <div className="col-span-2 text-right hidden sm:block">
          <p className="text-xs font-mono font-semibold">
            {fmtToken(pos.tokensHeld)}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            {pos.symbol}
          </p>
        </div>

        {/* value */}
        <div className="col-span-2 text-right">
          <p className="text-xs font-mono font-semibold">
            {fmtUSD(pos.marketValue)}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            @ {fmtUSD(pos.currentPrice)}
          </p>
        </div>

        {/* P&L */}
        <div className="col-span-2 text-right hidden md:block">
          <div
            className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${
              pnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {pnl >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {pnl >= 0 ? "+" : ""}
            {fmtUSD(pnl)}
          </div>
          <p
            className={`text-[10px] font-mono ${
              pnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(1)}%
          </p>
        </div>

        {/* yield */}
        <div className="col-span-1 text-right hidden lg:block">
          <p className="text-xs font-mono font-semibold text-green-400">
            +{fmtUSD(pos.yieldClaimable)}
          </p>
          <p className="text-[10px] text-muted-foreground">yield</p>
        </div>

        {/* chevron */}
        <div className="col-span-1 flex justify-end">
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="border-t border-border/60 bg-secondary/20 px-4 py-5 space-y-5">
          {/* milestone deadline info */}
          {milestoneDeadlineSecs > 0 && !pos.projectDead && !pos.timeoutActive && (
            <div
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                milestoneOverdue
                  ? "bg-orange-500/10 border border-orange-500/25 text-orange-400"
                  : milestoneDaysLeft <= 7
                    ? "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400"
                    : "bg-secondary/40 border border-border text-muted-foreground"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {milestoneOverdue
                ? "Milestone deadline passed — any backer can trigger a vote on the project page."
                : `Next milestone due in ${milestoneDaysLeft} day${milestoneDaysLeft !== 1 ? "s" : ""}.`}
            </div>
          )}

          {/* timeout vote active banner */}
          {pos.timeoutActive && !pos.projectDead && (
            <div
              className={`flex items-start gap-3 rounded-xl p-3 ${
                timeoutVoteOver
                  ? "bg-secondary/40 border border-border"
                  : "bg-yellow-500/10 border border-yellow-500/25"
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  timeoutVoteOver ? "text-muted-foreground" : "text-yellow-400"
                }`}
              />
              <div>
                <p
                  className={`text-xs font-semibold ${
                    timeoutVoteOver ? "text-foreground" : "text-yellow-400"
                  }`}
                >
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
                <p className="text-xs font-semibold text-red-400">
                  Project killed by governance
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Backers voted to end this project. Burn your CommitTokens to
                  claim your pro-rata share.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 bg-red-600 hover:bg-red-700 shrink-0"
                onClick={onClaimTimeoutRefund}
                disabled={timeoutRefundLoading}
              >
                {timeoutRefundLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3" />
                )}
                Claim Refund
              </Button>
            </div>
          )}

          {/* vetoed release — claim refund banner */}
          {pos.releaseVetoed && !pos.projectDead && (
            <div className="flex items-start gap-3 rounded-xl p-3 bg-orange-500/10 border border-orange-500/25">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-orange-400">
                  Release blocked by backer votes
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enough backers voted against this release. You can exit and
                  claim a pro-rata refund of remaining funds.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 shrink-0"
                onClick={onClaimVetoRefund}
                disabled={vetoRefundLoading}
              >
                {vetoRefundLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3" />
                )}
                Claim Refund
              </Button>
            </div>
          )}

          {/* veto alert banner */}
          {pos.vetoOpen && (
            <div
              className={`flex items-start gap-3 rounded-xl p-3 ${
                hasActiveVeto
                  ? "bg-yellow-500/10 border border-yellow-500/25"
                  : "bg-orange-500/10 border border-orange-500/25"
              }`}
            >
              <Shield
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  hasActiveVeto ? "text-yellow-400" : "text-orange-400"
                }`}
              />
              <div>
                <p
                  className={`text-xs font-semibold ${
                    hasActiveVeto ? "text-yellow-400" : "text-orange-400"
                  }`}
                >
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
              { label: "Entry Price", value: fmtUSD(pos.entryPrice), color: "" },
              { label: "Current Price", value: fmtUSD(pos.currentPrice), color: "" },
              {
                label: "Project Share",
                value: `${pos.projectSharePct.toFixed(2)}%`,
                color: "",
              },
              {
                label: "Unrealised P&L",
                value: `${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)}`,
                color: pnl >= 0 ? "text-green-400" : "text-red-400",
              },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {s.label}
                </p>
                <p className={`text-sm font-mono font-semibold ${s.color}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <Separator className="bg-border/60" />

          {/* funding progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Funding — {fmtUSD(pos.raised)} of {fmtUSD(pos.goal)}
              </span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {fmtTimeLeft(pos.fundingDeadline)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  fundedPct >= 80
                    ? "bg-gradient-to-r from-green-500 to-emerald-400"
                    : fundedPct >= 40
                      ? "bg-gradient-to-r from-primary to-blue-400"
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
              Milestones — {pos.milestonesCompleted} of {pos.milestones}{" "}
              completed
            </p>
            <MilestoneBar
              completed={pos.milestonesCompleted}
              total={pos.milestones}
            />
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
                  <span className="text-[9px] text-muted-foreground">
                    M{i + 1}
                  </span>
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
              {claimLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Coins className="w-3 h-3" />
              )}
              Claim {fmtUSD(pos.yieldClaimable)} Yield
            </Button>

            <Link href="/amm">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5"
              >
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
                {vetoLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
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
                {approveReleaseLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
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
                {cancelVetoLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
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
                {refundLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3" />
                )}
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
