import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, RefreshCw, Bell, Loader2, Landmark } from "lucide-react";
import { Link } from "wouter";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import {
  FounderProjectCard,
  FundingNotificationRow,
  EmptyState,
} from "@/components/myprojects";

export default function MyProjects() {
  const { isConnected } = useWallet();
  const { openConnectModal } = useConnectModal();
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const {
    myProjects,
    myProjectsLoading,
    fundingNotifications,
    fundingNotificationsLoading,
    claimInitialMilestoneRelease,
    verifyNextMilestone,
    requestRelease,
    executeRelease,
    clearVeto,
    refetch,
    founderActionError,
    founderActionLoading,
    founderActionId,
  } = usePortfolioData();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-sm tracking-tight">Raise</span>
          </div>

          <div className="hidden md:flex items-center gap-0.5 ml-4 text-xs text-muted-foreground">
            {[
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button
                  className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                    l.href === "/my-projects" ? "bg-secondary text-foreground" : ""
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

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
              Founder Workspace
            </p>
            <h1 className="text-2xl font-bold">My Projects</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:border-primary/40"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                if (!isConnected) {
                  openConnectModal?.();
                  return;
                }
                setShowSubmitModal(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Projects List */}
          <div className="lg:col-span-2 space-y-3">
            {founderActionError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                {founderActionError}
              </div>
            )}

            {!isConnected ? (
              <EmptyState
                isConnected={isConnected}
                onConnect={() => openConnectModal?.()}
                onSubmitProject={() => setShowSubmitModal(true)}
              />
            ) : myProjectsLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 border border-border rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading your projects...</span>
              </div>
            ) : myProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-border rounded-lg">
                <Landmark className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm font-medium">No submitted projects yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  List a project from this wallet and it will appear here.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 h-8 text-xs gap-1.5"
                  onClick={() => setShowSubmitModal(true)}
                >
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

          {/* Notifications Panel */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Funding Notifications
                </p>
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
                  <p className="text-[10px] mt-1">
                    When someone backs your project, it appears here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fundingNotifications.slice(0, 8).map((notification) => (
                    <FundingNotificationRow
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <SubmitProjectModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
      />
    </div>
  );
}
