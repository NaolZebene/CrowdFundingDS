import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowDownLeft,
  Bell,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { usePortfolioData, type FounderProject, type FundingNotification } from "@/hooks/usePortfolioData";
import { useWallet } from "@/hooks/useWallet";

const fmtUSD = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtTimeLeft = (deadline: bigint): string => {
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  const secsLeft = deadlineNum - now;
  if (secsLeft <= 0) return "Expired";
  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};
const pct = (raised: number, goal: number) => goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
const fmtPct = (value: number) => {
  if (value === 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
};
const progressStyle = (value: number) => ({
  width: `${value}%`,
  minWidth: value > 0 ? "2px" : undefined,
});
const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const fmtTime = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
  " · " +
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

function FounderProjectCard({
  project,
  onClaimInitialRelease,
  onVerifyNextMilestone,
  onRequestRelease,
  onExecuteRelease,
  onClearVeto,
  isLoading,
}: {
  project: FounderProject;
  onClaimInitialRelease: () => void;
  onVerifyNextMilestone: () => void;
  onRequestRelease: () => void;
  onExecuteRelease: () => void;
  onClearVeto: () => void;
  isLoading: boolean;
}) {
  const fundedPct = pct(project.raised, project.goal);
  const status = !project.approved
    ? "Pending Approval"
    : project.projectDead
    ? "Dead"
    : project.goalMet
    ? "Funded"
    : project.isExpired
    ? "Closed"
    : "Funding";
  const submittedMilestones = project.milestonesCompleted;
  const nextMilestone = Math.min(submittedMilestones + 1, project.milestones);
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneOverdue = milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;
  const milestoneDaysLeft = milestoneDeadlineSecs > now ? Math.ceil((milestoneDeadlineSecs - now) / 86400) : 0;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{project.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${
              status === "Funded"
                ? "bg-green-500/15 border-green-500/30 text-green-400"
                : status === "Funding"
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : status === "Pending Approval"
                ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                : status === "Dead"
                ? "bg-red-700/20 border-red-700/40 text-red-400"
                : "bg-red-500/15 border-red-500/30 text-red-400"
            }`}>
              {status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
            {project.description || `Project #${project.id.toString()}`}
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">#{project.id.toString()}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold">{fmtUSD(project.raised)}</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {fmtPct(fundedPct)} of {fmtUSD(project.goal)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full ${fundedPct >= 100 ? "bg-green-500" : fundedPct >= 40 ? "bg-primary" : "bg-yellow-500"}`}
            style={progressStyle(fundedPct)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-border">
        <div>
          <p className="text-[11px] font-mono font-semibold">{submittedMilestones}/{project.milestones}</p>
          <p className="text-[10px] text-muted-foreground">Milestones</p>
        </div>
        <div>
          <p className="text-[11px] font-mono font-semibold">{project.isExpired ? "Closed" : fmtTimeLeft(project.fundingDeadline)}</p>
          <p className="text-[10px] text-muted-foreground">Deadline</p>
        </div>
        <div>
          <p className="text-[11px] font-mono font-semibold truncate">{shortAddr(project.treasury)}</p>
          <p className="text-[10px] text-muted-foreground">Treasury</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          size="sm"
          variant={project.canClaimInitialRelease ? "default" : "outline"}
          className="h-8 text-xs gap-1.5"
          disabled={!project.canClaimInitialRelease || isLoading}
          onClick={onClaimInitialRelease}
        >
          {isLoading && project.canClaimInitialRelease ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownLeft className="w-3 h-3" />}
          {project.initialReleaseClaimed ? "First Release Claimed" : "Claim First Release"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={!project.canVerifyNextMilestone || isLoading} onClick={onVerifyNextMilestone}>
          {isLoading && project.canVerifyNextMilestone ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Submit Milestone
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={!project.canRequestRelease || isLoading} onClick={onRequestRelease}>
          {isLoading && project.canRequestRelease ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
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
            {isLoading && project.canClearVeto ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Clear Blocked Release
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={!project.canExecuteRelease || isLoading} onClick={onExecuteRelease}>
            {isLoading && project.canExecuteRelease ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
            Release Funds
          </Button>
        )}
      </div>

      {project.releaseVetoed && (
        <div className="text-[10px] rounded px-2.5 py-1.5 bg-red-500/10 border border-red-500/25 text-red-400">
          Release blocked. {project.canClearVeto
            ? "Clear it with the treasury wallet, then request the vote window again."
            : `Switch to treasury ${shortAddr(project.treasury)} to clear it before the next release can continue.`}
        </div>
      )}

      {/* milestone deadline info */}
      {milestoneDeadlineSecs > 0 && !project.projectDead && (
        <div className={`text-[10px] rounded px-2.5 py-1.5 ${
          milestoneOverdue
            ? "bg-orange-500/10 border border-orange-500/25 text-orange-400"
            : milestoneDaysLeft <= 7
            ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
            : "bg-secondary/40 border border-border text-muted-foreground"
        }`}>
          {milestoneOverdue
            ? `Milestone deadline passed ${Math.ceil((now - milestoneDeadlineSecs) / 86400)}d ago. Backers may trigger a governance vote.`
            : project.timeoutActive
            ? "Governance timeout vote is active. Check the project page."
            : `Submit anytime within ${Math.round(project.milestoneWindow / 86400)}d window (${milestoneDaysLeft}d left).`}
        </div>
      )}

      {project.projectDead && (
        <div className="text-[10px] rounded px-2.5 py-1.5 bg-red-500/10 border border-red-500/25 text-red-400">
          This project was killed by backer governance. Remaining funds are claimable by token holders.
        </div>
      )}

      <div className="text-[10px] text-muted-foreground leading-relaxed">
        {project.projectDead
          ? `Project terminated. ${fmtUSD(project.raised - project.released)} remaining in vault.`
          : project.canClaimInitialRelease
          ? `Goal met. First milestone release available: ${fmtUSD(project.releasable)}.`
          : project.vetoWindowOpen
          ? "Backers can vote in favor of early release at 30% support or vote against during the active vote window."
          : project.releaseVetoed
          ? "Release was blocked by backer votes. The current release request is locked until treasury clears it."
          : project.releaseApproved
          ? "Backers approved this release threshold."
          : project.canExecuteRelease
          ? `Vote window ended. Releasable amount: ${fmtUSD(project.releasable)}.`
          : project.canVerifyNextMilestone
          ? `Ready to submit milestone ${nextMilestone}. After submission, request the backer vote window.`
          : `Released ${fmtUSD(project.released)} of ${fmtUSD(project.raised)}.`}
      </div>
    </div>
  );
}

function FundingNotificationRow({ notification }: { notification: FundingNotification }) {
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${notification.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-secondary/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
        <Coins className="w-3.5 h-3.5 text-green-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">
          {fmtUSD(notification.amount)} funded {notification.projectName}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Backer {shortAddr(notification.investor)} · {fmtTime(new Date(notification.date))}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
    </a>
  );
}

export default function MyProjects() {
  const { isConnected, isWrongNetwork, role } = useWallet();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const {
    myProjects,
    fundingNotifications,
    myProjectsLoading,
    fundingNotificationsLoading,
    founderActionLoading,
    founderActionId,
    founderActionError,
    claimInitialMilestoneRelease,
    verifyNextMilestone,
    requestRelease,
    executeRelease,
    clearVeto,
    refetch,
  } = usePortfolioData();

  if (!isConnected || isWrongNetwork) return <ConnectPrompt />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${l.href === "/my-projects" ? "bg-secondary text-foreground" : ""}`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" className="h-8 px-3 text-xs gap-1.5 hidden sm:flex" onClick={() => setShowSubmitModal(true)}>
              <Plus className="w-3.5 h-3.5" /> List Project
            </Button>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">Founder Workspace</p>
            <h1 className="text-2xl font-bold">My Projects</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:border-primary/40"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowSubmitModal(true)}>
              <Plus className="w-3.5 h-3.5" /> New Project
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-3">
            {founderActionError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                {founderActionError}
              </div>
            )}
            {myProjectsLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 border border-border rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading your projects...</span>
              </div>
            ) : myProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-border rounded-lg">
                <Landmark className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm font-medium">No submitted projects yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">List a project from this wallet and it will appear here.</p>
                <Button size="sm" variant="outline" className="mt-4 h-8 text-xs gap-1.5" onClick={() => setShowSubmitModal(true)}>
                  <Plus className="w-3.5 h-3.5" /> List Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myProjects.map((project) => (
                  <FounderProjectCard
                    key={project.id.toString()}
                    project={project}
                    isLoading={founderActionLoading && founderActionId === project.id}
                    onClaimInitialRelease={() => claimInitialMilestoneRelease(project.id)}
                    onVerifyNextMilestone={() => verifyNextMilestone(project.id)}
                    onRequestRelease={() => requestRelease(project.id)}
                    onExecuteRelease={() => executeRelease(project.id)}
                    onClearVeto={() => clearVeto(project.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Funding Notifications</p>
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              {fundingNotificationsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Checking funding events...</span>
                </div>
              ) : fundingNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Bell className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-xs">No funding notifications yet.</p>
                  <p className="text-[10px] mt-1">When someone backs your project, it appears here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fundingNotifications.slice(0, 8).map((notification) => (
                    <FundingNotificationRow key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
