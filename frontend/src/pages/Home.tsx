import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { simulateContract } from "@wagmi/core";
import { formatUnits, parseUnits } from "viem";
import {
  Search, Plus,
  Coins, TrendingUp, Zap, Clock, Users,
  SlidersHorizontal, ExternalLink, XCircle,
  CheckCircle2, ArrowUpRight, Flame, Timer,
} from "lucide-react";
import { Link } from "wouter";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/hooks/useWallet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSortBy, setSearchQuery } from "@/store/slices/projectsSlice";
import { useMarketsData, type MarketProject } from "@/hooks/useMarketsData";
import { useAmmData } from "@/hooks/useAmmData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { CONTRACTS } from "@/config/contracts";
import { ERC20_ABI, VAULT_ABI } from "@/config/abis";
import { config as wagmiConfig } from "@/config/wagmi";

/* ─── helpers ─── */
const fmtUSD = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;
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
const fmtUSDFull = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function pct(raised: number, goal: number) { return goal > 0 ? Math.min(100, (raised / goal) * 100) : 0; }
function fmtPct(value: number) {
  if (value === 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}
function progressStyle(value: number) {
  return {
    width: `${value}%`,
    minWidth: value > 0 ? "2px" : undefined,
  };
}
function shortAddr(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function fmtDateFromUnix(ts: bigint) { return new Date(Number(ts) * 1000).toLocaleDateString(); }

const SORT_OPTIONS = ["Most Funded", "Ending Soon", "Most Milestones"];
const USDC_DECIMALS = 6;

const CATEGORIES = ["All", "Trending", "Closing Soon", "New"];

/* ─── unique images per project seed ─── */
const PROJECT_IMAGES = [
  "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=400&fit=crop",  // solar/energy
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop",  // medical/health
  "https://images.unsplash.com/photo-1488229297570-58520851e868?w=800&h=400&fit=crop",  // tech/digital
  "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&h=400&fit=crop",  // nature/green
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=400&fit=crop",  // education
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",  // finance/crypto
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop",  // community
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop",  // hardware
];
function projectImg(id: number) {
  return PROJECT_IMAGES[(id - 1) % PROJECT_IMAGES.length];
}

function friendlyTxError(error?: Error | string | null) {
  if (!error) return "";
  const message = typeof error === "string" ? error : error.message;
  if (message.includes("ProjectNotApproved")) return "This project is still pending approval.";
  if (message.includes("DeadlinePassed")) return "This project's funding deadline has passed.";
  if (message.includes("ZeroAmount")) return "Enter an amount greater than 0 USDC.";
  if (message.includes("TransferFailed")) return "USDC transfer failed. Check your balance and vault allowance.";
  if (message.toLowerCase().includes("insufficient funds")) return "Your wallet does not have enough Sepolia ETH for gas.";
  if (message.toLowerCase().includes("user rejected")) return "Transaction rejected in wallet.";
  if (message.toLowerCase().includes("allowance")) return "USDC allowance is too low. Approve the vault first.";
  if (message.toLowerCase().includes("balance")) return "Amount exceeds your Sepolia USDC balance.";
  return message;
}

function ProjectCard({
  project,
  onBack,
  onOpenDetails,
}: {
  project: MarketProject;
  onBack: () => void;
  onOpenDetails: (project: MarketProject) => void;
}) {
  const percent  = pct(project.totalRaised, project.fundingGoal);
  const days     = project.daysLeft;
  const canBack  = project.approved && !project.fundingClosed && !project.projectDead;
  const img      = projectImg(project.id);
  const isTrending = percent >= 60;
  const isClosing  = !project.fundingClosed && days <= 7 && days >= 0;
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneDeadlineDays = milestoneDeadlineSecs > now
    ? Math.ceil((milestoneDeadlineSecs - now) / 86400)
    : 0;
  const milestoneOverdue = milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;
  const submittedMilestones = Math.max(0, project.currentMilestone - 1);

  return (
    <div
      className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-[0_4px_24px_hsl(var(--primary)/0.10)] transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(project)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetails(project); } }}
    >
      {/* thumbnail */}
      <div className="relative h-40 overflow-hidden bg-secondary shrink-0">
        <img src={img} alt={project.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isTrending && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/80 text-white font-semibold">
              <Flame className="w-2.5 h-2.5" /> Trending
            </span>
          )}
          {isClosing && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/70 text-white font-semibold">
              <Timer className="w-2.5 h-2.5" /> {fmtTimeLeft(project.fundingDeadline)}
            </span>
          )}
          {project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-700/90 text-white font-semibold">Dead</span>
          )}
          {project.timeoutActive && !project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/80 text-white font-semibold">Vote open</span>
          )}
          {milestoneOverdue && !project.timeoutActive && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-600/80 text-white font-semibold">Overdue</span>
          )}
          {project.fundingClosed && !project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-600/80 text-white font-semibold">Funded ✓</span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-bold text-sm text-white leading-snug line-clamp-1">{project.name}</h3>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.4rem]">
          {project.description || "No description provided."}
        </p>

        {/* progress */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                percent >= 80 ? "bg-primary" : percent >= 40 ? "bg-primary/70" : "bg-primary/40"
              }`}
              style={progressStyle(percent)}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span className="font-semibold text-foreground">{fmtUSDFull(project.totalRaised)}</span>
            <span className="text-muted-foreground">{fmtPct(percent)} of {fmtUSDFull(project.fundingGoal)}</span>
          </div>
        </div>

        {/* meta row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{submittedMilestones}/{project.milestoneCount} milestones</span>
          {milestoneDeadlineSecs > 0 && !project.projectDead ? (
            <span className={`flex items-center gap-1 ${milestoneOverdue ? "text-orange-400" : milestoneDeadlineDays <= 7 ? "text-yellow-400" : ""}`}>
              <Timer className="w-3 h-3" />
              {milestoneOverdue ? "Overdue" : `${milestoneDeadlineDays}d milestone`}
            </span>
          ) : (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{project.goalMet ? "Funded" : project.isExpired ? "Expired" : `${days}d left`}</span>
          )}
        </div>

        <Button
          size="sm"
          variant={canBack ? "default" : "outline"}
          className="w-full h-8 text-xs font-semibold mt-auto gap-1.5"
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          disabled={!canBack}
        >
          {!project.approved ? "Pending Approval" : project.fundingClosed ? "View Project" : <><Zap className="w-3 h-3" /> Back this Project</>}
        </Button>
      </div>
    </div>
  );
}

function ProjectDetailsModal({
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
}: {
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
}) {
  if (!open || !project) return null;

  const percent = pct(project.totalRaised, project.fundingGoal);
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneDeadlineDays = milestoneDeadlineSecs > now
    ? Math.ceil((milestoneDeadlineSecs - now) / 86400) : 0;
  const milestoneOverdue = milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;
  const timeoutVoteEndsAt = project.timeoutActive ? project.timeoutOpenedAt + 3 * 86400 : 0;
  const timeoutVoteSecsLeft = timeoutVoteEndsAt > now ? timeoutVoteEndsAt - now : 0;
  const timeoutVoteDaysLeft = Math.ceil(timeoutVoteSecsLeft / 86400);
  const timeoutVoteOver = project.timeoutActive && now > timeoutVoteEndsAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative h-56 bg-secondary">
          <img src={projectImg(project.id)} alt={`Project #${project.id}`} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors border border-white/10">
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
            <h2 className="text-xl font-bold text-white drop-shadow-lg">{project.name}</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {project.description || "No project description available."}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono font-semibold">{fmtUSDFull(project.totalRaised)}</span>
              <span className="text-xs text-muted-foreground font-mono">{fmtPct(percent)} of {fmtUSDFull(project.fundingGoal)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={progressStyle(percent)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Founder</p>
              <p className="font-mono">{shortAddr(project.founder)}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Milestones</p>
              <p className="font-mono">{Math.max(0, project.currentMilestone - 1)}/{project.milestoneCount}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Funding Goal</p>
              <p className="font-mono">{fmtUSDFull(project.fundingGoal)}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">Deadline</p>
              <p className="font-mono">{fmtDateFromUnix(project.fundingDeadline)} ({project.goalMet ? "funded" : project.isExpired ? "expired" : fmtTimeLeft(project.fundingDeadline)})</p>
            </div>
          </div>

          {/* ── milestone deadline / timeout panel ── */}
          {(milestoneDeadlineSecs > 0 || project.timeoutActive || project.projectDead) && (
            <div className={`border rounded-lg p-4 space-y-3 ${project.projectDead ? "border-red-500/40 bg-red-500/5" : project.timeoutActive ? "border-yellow-500/40 bg-yellow-500/5" : milestoneOverdue ? "border-orange-500/40 bg-orange-500/5" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {project.projectDead ? "Project Dead — Claim Refund" : project.timeoutActive ? "Governance Vote Active" : milestoneOverdue ? "Milestone Overdue" : "Milestone Deadline"}
                </p>
                {milestoneDeadlineSecs > 0 && !project.projectDead && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${milestoneOverdue ? "bg-orange-500/20 text-orange-400" : milestoneDeadlineDays <= 7 ? "bg-yellow-500/20 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
                    {milestoneOverdue ? "Past deadline" : `${milestoneDeadlineDays}d remaining`}
                  </span>
                )}
              </div>

              {/* active vote */}
              {project.timeoutActive && !timeoutVoteOver && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vote window closes in <span className="font-semibold text-foreground">{timeoutVoteDaysLeft}d</span>. Default = extend. Refund only wins if refund votes strictly exceed extend votes.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-green-500/40 hover:bg-green-500/10 text-green-400"
                      disabled={!isConnected || isTimeoutPending}
                      onClick={() => onVoteTimeout(project.id, true)}>
                      Vote Extend
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-500/40 hover:bg-red-500/10 text-red-400"
                      disabled={!isConnected || isTimeoutPending}
                      onClick={() => onVoteTimeout(project.id, false)}>
                      Vote Refund
                    </Button>
                  </div>
                </div>
              )}

              {/* vote ended, needs execution */}
              {timeoutVoteOver && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Vote window has ended. Anyone can finalise the outcome.</p>
                  <Button size="sm" className="w-full h-8 text-xs" disabled={isTimeoutPending}
                    onClick={() => onExecuteTimeout(project.id)}>
                    {isTimeoutPending ? "Confirming..." : "Finalise Outcome"}
                  </Button>
                </div>
              )}

              {/* overdue, no vote open yet — trigger */}
              {milestoneOverdue && !project.timeoutActive && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Founder missed the milestone deadline. Any backer can open a governance vote.</p>
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs border-orange-500/40 hover:bg-orange-500/10 text-orange-400"
                    disabled={!isConnected || isTimeoutPending}
                    onClick={() => onTriggerTimeout(project.id)}>
                    {isTimeoutPending ? "Confirming..." : "Trigger Timeout Vote"}
                  </Button>
                </div>
              )}

              {/* dead project — refund claim */}
              {project.projectDead && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Backers voted to end this project. Burn your CommitTokens to claim your pro-rata share of remaining funds.</p>
                  <Button size="sm" className="w-full h-8 text-xs bg-red-600 hover:bg-red-700"
                    disabled={!isConnected || isTimeoutPending}
                    onClick={() => onClaimTimeoutRefund(project.id)}>
                    {isTimeoutPending ? "Confirming..." : "Claim Refund"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
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
            {validationError && <p className="text-[11px] text-red-400">{validationError}</p>}
            {!validationError && investError && <p className="text-[11px] text-red-400">{investError}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <p className="text-[10px] text-muted-foreground">Network</p>
              <p className={`text-xs font-mono ${isWrongNetwork ? "text-red-400" : "text-green-400"}`}>
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
            disabled={!project.approved || project.fundingClosed || isWrongNetwork || isInvesting || (isConnected && !canTransact)}
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

/* ─── main ─── */
export default function Home() {
  const { address, isConnected, isWrongNetwork, role } = useWallet();
  const { pools: ammPools } = useAmmData(0, "buy", "");
  const { openConnectModal } = useConnectModal();
  const dispatch       = useAppDispatch();
  const activeSort     = useAppSelector((s) => s.projects.sortBy);
  const query          = useAppSelector((s) => s.projects.searchQuery);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<MarketProject | null>(null);
  const [investAmount, setInvestAmount] = useState("");
  const [actionType, setActionType] = useState<"approve" | "invest" | null>(null);
  const [preflightError, setPreflightError] = useState("");
  const [handledTxHash, setHandledTxHash] = useState<`0x${string}` | undefined>();

  /* ── contract data ── */
  const {
    projects,
    tvl,
    totalRaised,
    activeProjectCount,
    refetch: refetchMarkets,
  } = useMarketsData();
  const openProjects = useMemo(
    () => projects.filter((project) => project.approved && !project.fundingClosed),
    [projects],
  );
  const count = openProjects.length;

  /* ── filter + sort ── */
  const filtered = openProjects
                    .filter((p) =>
                      query === "" ||
                      String(p.id).includes(query) ||
                      p.name.toLowerCase().includes(query.toLowerCase()) ||
                      p.description.toLowerCase().includes(query.toLowerCase()) ||
                      p.metadataUri.toLowerCase().includes(query.toLowerCase())
                    )
    .sort((a, b) => {
      if (activeSort === "Most Funded")     return b.totalRaised - a.totalRaised;
      if (activeSort === "Ending Soon")     return a.daysLeft - b.daysLeft;
      if (activeSort === "Most Milestones") return Math.max(0, b.currentMilestone - 1) - Math.max(0, a.currentMilestone - 1);
      return 0;
    });

  const [activeCategory, setActiveCategory] = useState("All");

  const categoryFiltered = useMemo(() => {
    if (activeCategory === "Trending") return filtered.filter(p => pct(p.totalRaised, p.fundingGoal) >= 60);
    if (activeCategory === "Closing Soon") return filtered.filter(p => p.daysLeft <= 7 && p.daysLeft >= 0 && !p.fundingClosed);
    if (activeCategory === "New") return [...filtered].reverse().slice(0, 6);
    return filtered;
  }, [filtered, activeCategory]);

  const { data: usdcBalanceRaw } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const {
    data: usdcAllowanceRaw,
    refetch: refetchAllowance,
  } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.VAULT] : undefined,
    query: { enabled: !!address },
  });

  const investAmountRaw = useMemo(() => {
    if (!investAmount.trim()) return null;
    try {
      const parsed = parseUnits(investAmount, USDC_DECIMALS);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [investAmount]);

  const usdcBalance = usdcBalanceRaw ? Number(formatUnits(usdcBalanceRaw as bigint, USDC_DECIMALS)) : 0;
  const usdcBalanceBigint = (usdcBalanceRaw as bigint | undefined) ?? 0n;
  const usdcAllowance = (usdcAllowanceRaw as bigint | undefined) ?? 0n;
  const usdcAllowanceFormatted = Number(formatUnits(usdcAllowance, USDC_DECIMALS));
  const requiredAmountFormatted = investAmountRaw ? Number(formatUnits(investAmountRaw, USDC_DECIMALS)) : 0;
  const needsApproval = !!investAmountRaw && usdcAllowance < investAmountRaw;
  const insufficientBalance = !!investAmountRaw && investAmountRaw > usdcBalanceBigint;
  const canTransact = !!investAmountRaw && !insufficientBalance;
  const validationError = isConnected && !investAmountRaw
    ? "Enter a valid USDC amount."
    : insufficientBalance
    ? "Amount exceeds your USDC balance."
    : undefined;

  const {
    writeContract,
    data: investTxHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isTxPending, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: investTxHash });
  const isInvesting = isWriting || isTxPending;

  /* ── timeout actions ── */
  const {
    writeContract: writeTimeout,
    data: timeoutTxHash,
    isPending: isTimeoutWriting,
  } = useWriteContract();
  const { isLoading: isTimeoutTxPending, isSuccess: isTimeoutTxSuccess } =
    useWaitForTransactionReceipt({ hash: timeoutTxHash });
  const isTimeoutPending = isTimeoutWriting || isTimeoutTxPending;

  useEffect(() => {
    if (isTimeoutTxSuccess) refetchMarkets();
  }, [isTimeoutTxSuccess]);

  function handleTriggerTimeout(projectId: number) {
    writeTimeout({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "triggerMilestoneTimeout", args: [BigInt(projectId)] });
  }
  function handleVoteTimeout(projectId: number, extend: boolean) {
    writeTimeout({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "voteTimeout", args: [BigInt(projectId), extend] });
  }
  function handleExecuteTimeout(projectId: number) {
    writeTimeout({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "executeTimeoutOutcome", args: [BigInt(projectId)] });
  }
  function handleClaimTimeoutRefund(projectId: number) {
    writeTimeout({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "claimTimeoutRefund", args: [BigInt(projectId)] });
  }

  useEffect(() => {
    if (!selectedProject) return;
    setInvestAmount("");
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!isTxSuccess) return;
    if (!investTxHash || handledTxHash === investTxHash) return;
    setHandledTxHash(investTxHash);

    if (actionType === "approve") {
      void refetchAllowance();
      // Auto-trigger invest after approval succeeds
      setActionType("invest");
      writeContract({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "invest",
        args: [BigInt(selectedProject!.id), investAmountRaw!, "0x"],
      });
      return;
    }
    if (actionType === "invest") {
      setSelectedProject(null);
      setInvestAmount("");
      setActionType(null);
      void refetchAllowance();
      refetchMarkets();
      // Portfolio will auto-refresh via refetchInterval in usePortfolioData hook
    }
  }, [
    actionType,
    handledTxHash,
    investTxHash,
    isTxSuccess,
    refetchAllowance,
    refetchMarkets,
    selectedProject,
    investAmountRaw,
    writeContract,
  ]);

  useEffect(() => {
    setPreflightError("");
  }, [investAmount, selectedProject?.id]);

  async function handleBackProject() {
    if (!selectedProject?.approved) return;
    if (selectedProject.fundingClosed) return;
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (isWrongNetwork) return;
    if (!address || !investAmountRaw) return;
    if (!canTransact) return;

    if (needsApproval) {
      setPreflightError("");
      try {
        await simulateContract(wagmiConfig, {
          account: address,
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACTS.VAULT, investAmountRaw],
        });
      } catch (error) {
        setPreflightError(friendlyTxError(error instanceof Error ? error : String(error)));
        return;
      }
      setActionType("approve");
      writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.VAULT, investAmountRaw],
      });
      return;
    }

    setPreflightError("");
    try {
      await simulateContract(wagmiConfig, {
        account: address,
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "invest",
        args: [BigInt(selectedProject.id), investAmountRaw, "0x"],
      });
    } catch (error) {
      setPreflightError(friendlyTxError(error instanceof Error ? error : String(error)));
      return;
    }

    setActionType("invest");
    writeContract({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "invest",
      args: [BigInt(selectedProject.id), investAmountRaw, "0x"],
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">Raise</span>
          </div>

          <div className="hidden md:flex items-center gap-0.5 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin", href: "/dashboard" }] : []),
              { label: "Markets",     href: "/" },
              { label: "AMM Swap",    href: "/amm" },
              { label: "Portfolio",   href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                  l.href === "/"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "hover:bg-secondary hover:text-foreground"
                }`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              className="pl-8 h-8 text-xs bg-secondary border-border focus:border-primary/40 transition-colors"
              value={query}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            />
          </div>

          <Button
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 shrink-0 hidden sm:flex font-semibold"
            onClick={() => { if (!isConnected) { openConnectModal?.(); return; } setShowSubmitModal(true); }}
          >
            <Plus className="w-3.5 h-3.5" /> List Project
          </Button>

          <ConnectButton accountStatus="avatar" showBalance={false} />
        </div>
      </nav>

      {/* ── Hero Banner ── */}
      <div className="border-b border-border bg-gradient-to-br from-card via-background to-primary/5">
        <div className="max-w-screen-xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wide uppercase">Live on Sepolia</span>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">On-chain governed</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Fund the future,<br />
              <span className="text-primary">stake your vote.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
              Milestone-gated crowdfunding where backers hold liquid tokens, earn yield, and vote on fund releases — all on-chain.
            </p>
          </div>

          {/* stats pills */}
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            {[
              { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Total Raised",   value: fmtUSD(totalRaised),        color: "text-primary" },
              { icon: <Coins className="w-3.5 h-3.5" />,       label: "TVL",            value: fmtUSD(tvl),                color: "text-emerald-600" },
              { icon: <Users className="w-3.5 h-3.5" />,       label: "Active Projects", value: String(activeProjectCount), color: "text-foreground" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 min-w-[180px]">
                <span className={`${s.color}`}>{s.icon}</span>
                <div>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-6">

        {/* ── Filter / Sort bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:block">Sort:</span>
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => dispatch(setSortBy(s))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    activeSort === s
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Project count label ── */}
        <p className="text-xs text-muted-foreground -mt-2">
          {categoryFiltered.length} project{categoryFiltered.length !== 1 ? "s" : ""}
          {activeCategory !== "All" && <span> · {activeCategory}</span>}
          {query && <span> matching &ldquo;{query}&rdquo;</span>}
        </p>

        {/* ── Project grid ── */}
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-border rounded-2xl text-center bg-secondary/10">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Coins className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No open projects right now</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Approved projects with open funding windows appear here.</p>
          </div>
        ) : categoryFiltered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground text-sm border border-dashed border-border rounded-2xl bg-secondary/10">
            No projects match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {categoryFiltered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpenDetails={setSelectedProject}
                onBack={() => setSelectedProject(p)}
              />
            ))}
          </div>
        )}

        {/* ── AMM Spotlight ── */}
        <section className="pt-6 border-t border-border">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* left: copy */}
              <div className="p-7 flex flex-col justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-widest">Built-in AMM</span>
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight leading-snug mb-3">
                    Trade CommitTokens.<br />
                    <span className="text-primary">Anytime. On-chain.</span>
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                    Every funded project gets its own liquidity pool automatically seeded from the raise.
                    Buy and sell project tokens instantly — no order book, no waiting, no lock-up.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Zap className="w-3.5 h-3.5 text-primary" />,         label: "Instant liquidity",   body: "Swap USDC ↔ CommitTokens in one transaction at the current market price." },
                    { icon: <TrendingUp className="w-3.5 h-3.5 text-primary" />,  label: "Price discovery",     body: "Constant product formula ensures fair pricing with every trade." },
                    { icon: <Users className="w-3.5 h-3.5 text-primary" />,       label: "Governance weight",   body: "Token holders vote on milestone releases. More tokens = more voting power." },
                    { icon: <Coins className="w-3.5 h-3.5 text-primary" />,       label: "Yield accrual",       body: "Hold CommitTokens and earn a share of protocol yield automatically." },
                  ].map((f) => (
                    <div key={f.label} className="flex gap-2.5 p-3 rounded-xl bg-secondary/50 border border-border/60">
                      <div className="mt-0.5 shrink-0">{f.icon}</div>
                      <div>
                        <p className="text-xs font-semibold mb-0.5">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{f.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link href="/amm">
                  <Button className="gap-2 w-full sm:w-auto">
                    <TrendingUp className="w-4 h-4" /> Open AMM Market <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* right: top pools */}
              <div className="bg-gradient-to-br from-primary/5 via-background to-secondary border-l border-border flex flex-col justify-center p-7 gap-4 min-h-[320px]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Top Pools</p>
                  <span className="text-[10px] font-mono text-muted-foreground">{ammPools.length} active</span>
                </div>

                {ammPools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active pools yet — fund a project to seed the first pool.</p>
                ) : (
                  <div className="space-y-2.5">
                    {[...ammPools].sort((a, b) => b.poolUsdc - a.poolUsdc).slice(0, 5).map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors">
                        <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{fmtUSD(p.poolUsdc)} liquidity · {p.swapCount} swaps</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-bold text-primary">${p.price.toFixed(4)}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{fmtUSD(p.volumeUsdc / 1e6)} vol.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA banner ── */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <h3 className="font-bold text-base mb-1">Have a project to fund?</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Submit with milestones, a funding goal, and a deadline. Backers earn yield from day one.
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <Link href="/amm">
              <Button variant="outline" className="h-9 px-4 text-sm gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> AMM Swap
              </Button>
            </Link>
            <Button
              className="h-9 px-5 text-sm gap-1.5"
              onClick={() => { if (!isConnected) { openConnectModal?.(); return; } setShowSubmitModal(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              {isConnected ? "Submit a project" : "Connect wallet"}
            </Button>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-5 px-4 mt-4">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Raise</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/amm"><span className="hover:text-foreground transition-colors cursor-pointer">AMM</span></Link>
            <Link href="/portfolio"><span className="hover:text-foreground transition-colors cursor-pointer">Portfolio</span></Link>
            <a href="https://github.com/NaolZebene/CrowdFundingDS" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <span>Ethereum Sepolia</span>
          </div>
        </div>
      </footer>
      <ProjectDetailsModal
        open={!!selectedProject}
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onBack={handleBackProject}
        investAmount={investAmount}
        onInvestAmountChange={setInvestAmount}
        usdcBalance={usdcBalance}
        usdcAllowance={usdcAllowanceFormatted}
        requiredAmount={requiredAmountFormatted}
        needsApproval={needsApproval}
        canTransact={canTransact}
        validationError={validationError}
        isInvesting={isInvesting}
        isConnected={isConnected}
        isWrongNetwork={isWrongNetwork}
        investError={preflightError || friendlyTxError(writeError)}
        actionType={actionType}
        onTriggerTimeout={handleTriggerTimeout}
        onVoteTimeout={handleVoteTimeout}
        onExecuteTimeout={handleExecuteTimeout}
        onClaimTimeoutRefund={handleClaimTimeoutRefund}
        isTimeoutPending={isTimeoutPending}
      />
      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
