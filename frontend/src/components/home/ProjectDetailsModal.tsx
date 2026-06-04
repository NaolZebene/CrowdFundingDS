import { XCircle, CheckCircle2, ExternalLink, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MarketProject } from "@/hooks/useMarketsData";
import {
  fmtUSDFull,
  fmtPct,
  pct,
  progressStyle,
  shortAddr,
  fmtDateFromUnix,
  fmtTimeLeft,
  getProjectImage,
} from "@/utils/homeFormatters";

interface ProjectDetailsModalProps {
  open: boolean;
  project: MarketProject | null;
  onClose: () => void;
  onBack: () => void;
  investAmount: string;
  onInvestAmountChange: (value: string) => void;
  usdcBalance: number;
  usdcAllowance: number;
  requiredAmount: number;
  needsApproval: boolean;
  canTransact: boolean;
  validationError?: string;
  isInvesting: boolean;
  isConnected: boolean;
  isWrongNetwork: boolean;
  investError?: string;
  actionType: "approve" | "invest" | null;
  onTriggerTimeout: (projectId: number) => void;
  onVoteTimeout: (projectId: number, extend: boolean) => void;
  onExecuteTimeout: (projectId: number) => void;
  onClaimTimeoutRefund: (projectId: number) => void;
  isTimeoutPending: boolean;
}

export function ProjectDetailsModal({
  open,
  project,
  onClose,
  onBack,
  investAmount,
  onInvestAmountChange,
  usdcBalance,
  usdcAllowance,
  requiredAmount,
  needsApproval,
  canTransact,
  validationError,
  isInvesting,
  isConnected,
  isWrongNetwork,
  investError,
  actionType,
  onTriggerTimeout,
  onVoteTimeout,
  onExecuteTimeout,
  onClaimTimeoutRefund,
  isTimeoutPending,
}: ProjectDetailsModalProps) {
  if (!open || !project) return null;

  const percent = pct(project.totalRaised, project.fundingGoal);
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneDeadlineDays =
    milestoneDeadlineSecs > now
      ? Math.ceil((milestoneDeadlineSecs - now) / 86400)
      : 0;
  const milestoneOverdue =
    milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;
  const timeoutVoteEndsAt = project.timeoutActive
    ? project.timeoutOpenedAt + 3 * 86400
    : 0;
  const timeoutVoteSecsLeft = timeoutVoteEndsAt > now ? timeoutVoteEndsAt - now : 0;
  const timeoutVoteDaysLeft = Math.ceil(timeoutVoteSecsLeft / 86400);
  const timeoutVoteOver = project.timeoutActive && now > timeoutVoteEndsAt;
  const img = getProjectImage(project);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative h-56 bg-secondary">
          <img
            src={img}
            alt={`Project #${project.id}`}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors border border-white/10"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <div className="absolute left-4 bottom-4 right-12">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-white/80 font-mono">
                Project #{project.id}
              </span>
              {project.approved ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/40 text-green-300 font-medium">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {project.fundingClosed ? "Funding Closed" : "Approved"}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/20 border border-yellow-500/40 text-yellow-300">
                  Pending Approval
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {project.iconUrl && (
                <img
                  src={project.iconUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg border border-white/20 bg-black/30 object-cover shrink-0"
                />
              )}
              <h2 className="text-xl font-bold text-white drop-shadow-lg">
                {project.name}
              </h2>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {project.description || "No project description available."}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono font-semibold">
                {fmtUSDFull(project.totalRaised)}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {fmtPct(percent)} of {fmtUSDFull(project.fundingGoal)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={progressStyle(percent)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Founder</p>
              <p className="font-mono">{shortAddr(project.founder)}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Milestones</p>
              <p className="font-mono">
                {Math.max(0, project.currentMilestone - 1)}/{project.milestoneCount}
              </p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Funding Goal</p>
              <p className="font-mono">{fmtUSDFull(project.fundingGoal)}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Deadline</p>
              <p className="font-mono">
                {fmtDateFromUnix(project.fundingDeadline)} (
                {project.goalMet
                  ? "funded"
                  : project.isExpired
                    ? "expired"
                    : fmtTimeLeft(project.fundingDeadline)}
                )
              </p>
            </div>
          </div>

          {/* Milestone deadline / timeout panel */}
          {(milestoneDeadlineSecs > 0 || project.timeoutActive || project.projectDead) && (
            <div
              className={`border rounded-lg p-4 space-y-3 ${
                project.projectDead
                  ? "border-red-500/40 bg-red-500/5"
                  : project.timeoutActive
                    ? "border-yellow-500/40 bg-yellow-500/5"
                    : milestoneOverdue
                      ? "border-orange-500/40 bg-orange-500/5"
                      : "border-border bg-secondary/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {project.projectDead
                    ? "Project Dead — Claim Refund"
                    : project.timeoutActive
                      ? "Governance Vote Active"
                      : milestoneOverdue
                        ? "Milestone Overdue"
                        : "Milestone Deadline"}
                </p>
                {milestoneDeadlineSecs > 0 && !project.projectDead && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      milestoneOverdue
                        ? "bg-orange-500/20 text-orange-400"
                        : milestoneDeadlineDays <= 7
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {milestoneOverdue ? "Past deadline" : `${milestoneDeadlineDays}d remaining`}
                  </span>
                )}
              </div>

              {/* Active vote */}
              {project.timeoutActive && !timeoutVoteOver && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vote window closes in{" "}
                    <span className="font-semibold text-foreground">
                      {timeoutVoteDaysLeft}d
                    </span>
                    . Default = extend. Refund only wins if refund votes strictly exceed
                    extend votes.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-green-500/40 hover:bg-green-500/10 text-green-400"
                      disabled={!isConnected || isTimeoutPending}
                      onClick={() => onVoteTimeout(project.id, true)}
                    >
                      Vote Extend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-red-500/40 hover:bg-red-500/10 text-red-400"
                      disabled={!isConnected || isTimeoutPending}
                      onClick={() => onVoteTimeout(project.id, false)}
                    >
                      Vote Refund
                    </Button>
                  </div>
                </div>
              )}

              {/* Vote ended, needs execution */}
              {timeoutVoteOver && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vote window has ended. Anyone can finalise the outcome.
                  </p>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={isTimeoutPending}
                    onClick={() => onExecuteTimeout(project.id)}
                  >
                    {isTimeoutPending ? "Confirming..." : "Finalise Outcome"}
                  </Button>
                </div>
              )}

              {/* Overdue, no vote open yet — trigger */}
              {milestoneOverdue && !project.timeoutActive && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Founder missed the milestone deadline. Any backer can open a governance
                    vote.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs border-orange-500/40 hover:bg-orange-500/10 text-orange-400"
                    disabled={!isConnected || isTimeoutPending}
                    onClick={() => onTriggerTimeout(project.id)}
                  >
                    {isTimeoutPending ? "Confirming..." : "Trigger Timeout Vote"}
                  </Button>
                </div>
              )}

              {/* Dead project — refund claim */}
              {project.projectDead && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Backers voted to end this project. Burn your CommitTokens to claim your
                    pro-rata share of remaining funds.
                  </p>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-red-600 hover:bg-red-700"
                    disabled={!isConnected || isTimeoutPending}
                    onClick={() => onClaimTimeoutRefund(project.id)}
                  >
                    {isTimeoutPending ? "Confirming..." : "Claim Refund"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* URLs section */}
          <div className="space-y-2">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Project Icon URL</p>
              {project.iconUrl ? (
                <a
                  href={project.iconUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary break-all inline-flex items-center gap-1 hover:underline"
                >
                  {project.iconUrl} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Not provided</p>
              )}
            </div>

            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Metadata URI</p>
              {project.offchainMetadataUri ? (
                <a
                  href={project.offchainMetadataUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary break-all inline-flex items-center gap-1 hover:underline"
                >
                  {project.offchainMetadataUri} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Not provided</p>
              )}
            </div>

            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Additional Files URL</p>
              {project.additionalFilesUrl ? (
                <a
                  href={project.additionalFilesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary break-all inline-flex items-center gap-1 hover:underline"
                >
                  {project.additionalFilesUrl} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Not provided</p>
              )}
            </div>
          </div>

          {/* Investment form */}
          <div className="bg-secondary/30 border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Investment Amount (USDC)</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Balance: {usdcBalance.toFixed(2)}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              step="0.000001"
              value={investAmount}
              onChange={(e) => onInvestAmountChange(e.target.value)}
              placeholder="e.g. 100"
              className="bg-secondary border-border text-sm"
            />
            {validationError && (
              <p className="text-[11px] text-red-400">{validationError}</p>
            )}
            {!validationError && investError && (
              <p className="text-[11px] text-red-400">{investError}</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[10px] text-muted-foreground">Network</p>
              <p
                className={`text-xs font-mono ${
                  isWrongNetwork ? "text-red-400" : "text-green-400"
                }`}
              >
                {isConnected ? (isWrongNetwork ? "Wrong" : "Sepolia") : "Connect"}
              </p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[10px] text-muted-foreground">USDC Balance</p>
              <p className="text-xs font-mono">{usdcBalance.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[10px] text-muted-foreground">Vault Allowance</p>
              <p className="text-xs font-mono">{usdcAllowance.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[10px] text-muted-foreground">Required</p>
              <p className="text-xs font-mono">{requiredAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onBack}
            disabled={
              !project.approved ||
              project.fundingClosed ||
              isWrongNetwork ||
              isInvesting ||
              (isConnected && !canTransact)
            }
          >
            <Coins className="w-3.5 h-3.5" />
            {!project.approved
              ? "Pending Approval"
              : project.fundingClosed
                ? "Funding Closed"
                : !isConnected
                  ? "Connect Wallet"
                  : isWrongNetwork
                    ? "Wrong Network"
                    : isInvesting
                      ? actionType === "approve"
                        ? "Approving..."
                        : "Confirming..."
                      : needsApproval
                        ? "Approve USDC"
                        : "Back this Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
