import {
  Loader2,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Coins,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FounderProject } from "@/hooks/usePortfolioData";
import {
  fmtUSD,
  fmtPct,
  progressStyle,
  shortAddr,
  fmtTimeLeft,
} from "@/utils/myProjectsFormatters";

interface FounderProjectCardProps {
  project: FounderProject;
  isLoading: boolean;
  onClaimInitialRelease: () => void;
  onVerifyNextMilestone: () => void;
  onRequestRelease: () => void;
  onExecuteRelease: () => void;
  onClearVeto: () => void;
}

export function FounderProjectCard({
  project,
  isLoading,
  onClaimInitialRelease,
  onVerifyNextMilestone,
  onRequestRelease,
  onExecuteRelease,
  onClearVeto,
}: FounderProjectCardProps) {
  const fundedPct =
    project.goal > 0 ? Math.min(100, (project.raised / project.goal) * 100) : 0;
  const submittedMilestones = Math.max(0, project.milestonesCompleted);

  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneDeadlineDays =
    milestoneDeadlineSecs > now
      ? Math.ceil((milestoneDeadlineSecs - now) / 86400)
      : 0;
  const milestoneOverdue =
    milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;

  const status = project.projectDead
    ? "Dead"
    : project.goalMet
      ? "Funded"
      : project.approved
        ? "Funding"
        : "Pending Approval";

  return (
    <div className="border border-border rounded-2xl bg-card p-4 space-y-3 hover:border-primary/30 transition-colors">
      {/* header */}
      <div className="flex items-start gap-3">
        {project.iconUrl ? (
          <img
            src={project.iconUrl}
            alt=""
            className="w-10 h-10 rounded-lg border border-border object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-muted-foreground">
              {project.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{project.name}</h3>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                status === "Funded"
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : status === "Funding"
                    ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                    : status === "Pending Approval"
                      ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                      : status === "Dead"
                        ? "bg-red-700/20 border-red-700/40 text-red-400"
                        : "bg-red-500/15 border-red-500/30 text-red-400"
              }`}
            >
              {status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
            {project.description || `Project #${project.id.toString()}`}
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          #{project.id.toString()}
        </span>
      </div>

      {/* funding progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold">{fmtUSD(project.raised)}</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {fmtPct(fundedPct)} of {fmtUSD(project.goal)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full ${
              fundedPct >= 100
                ? "bg-green-500"
                : fundedPct >= 40
                  ? "bg-primary"
                  : "bg-yellow-500"
            }`}
            style={progressStyle(fundedPct)}
          />
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-border">
        <div>
          <p className="text-[11px] font-mono font-semibold">
            {submittedMilestones}/{project.milestones}
          </p>
          <p className="text-[10px] text-muted-foreground">Milestones</p>
        </div>
        <div>
          <p className="text-[11px] font-mono font-semibold">
            {project.isExpired ? "Closed" : fmtTimeLeft(project.fundingDeadline)}
          </p>
          <p className="text-[10px] text-muted-foreground">Deadline</p>
        </div>
        <div>
          <p className="text-[11px] font-mono font-semibold truncate">
            {shortAddr(project.treasury)}
          </p>
          <p className="text-[10px] text-muted-foreground">Treasury</p>
        </div>
      </div>

      {/* action buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          size="sm"
          variant={project.canClaimInitialRelease ? "default" : "outline"}
          className="h-8 text-xs gap-1.5"
          disabled={!project.canClaimInitialRelease || isLoading}
          onClick={onClaimInitialRelease}
        >
          {isLoading && project.canClaimInitialRelease ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ArrowDownLeft className="w-3 h-3" />
          )}
          {project.initialReleaseClaimed ? "First Release Claimed" : "Claim First Release"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={!project.canVerifyNextMilestone || isLoading}
          onClick={onVerifyNextMilestone}
        >
          {isLoading && project.canVerifyNextMilestone ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          Submit Milestone
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={!project.canRequestRelease || isLoading}
          onClick={onRequestRelease}
        >
          {isLoading && project.canRequestRelease ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          Request Vote Window
        </Button>
        {project.releaseVetoed ? (
          <Button
            size="sm"
            variant={project.canClearVeto ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
            disabled={!project.canClearVeto || isLoading}
            onClick={onClearVeto}
          >
            {isLoading && project.canClearVeto ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Clear Blocked Release
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={!project.canExecuteRelease || isLoading}
            onClick={onExecuteRelease}
          >
            {isLoading && project.canExecuteRelease ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Coins className="w-3 h-3" />
            )}
            Release Funds
          </Button>
        )}
      </div>

      {/* veto warning */}
      {project.releaseVetoed && (
        <div className="text-[10px] rounded px-2.5 py-1.5 bg-red-500/10 border border-red-500/25 text-red-400">
          Release blocked.{" "}
          {project.canClearVeto
            ? "Clear it with the treasury wallet, then request the vote window again."
            : `Switch to treasury ${shortAddr(project.treasury)} to clear it before the next release can continue.`}
        </div>
      )}

      {/* milestone deadline info */}
      {milestoneDeadlineSecs > 0 && !project.projectDead && (
        <div
          className={`text-[10px] rounded px-2.5 py-1.5 ${
            milestoneOverdue
              ? "bg-orange-500/10 border border-orange-500/25 text-orange-400"
              : milestoneDeadlineDays <= 7
                ? "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400"
                : "bg-blue-500/10 border border-blue-500/25 text-blue-400"
          }`}
        >
          {milestoneOverdue ? (
            <span className="flex items-center gap-1">
              <TriangleAlert className="w-3 h-3" />
              Milestone overdue by {Math.abs(milestoneDeadlineDays)}d
            </span>
          ) : (
            <span>{milestoneDeadlineDays}d until milestone deadline</span>
          )}
        </div>
      )}
    </div>
  );
}
