import { Plus, RefreshCw, ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PageHeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  onSubmitProject: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function PageHeader({
  isConnected,
  onConnect,
  onSubmitProject,
  onRefresh,
  isRefreshing,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link href="/portfolio">
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Projects</h1>
          <p className="text-xs text-muted-foreground">
            Manage your fundraising projects and milestones
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/amm">
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> AMM Swap
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => {
            if (!isConnected) {
              onConnect();
              return;
            }
            onSubmitProject();
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          {isConnected ? "New Project" : "Connect Wallet"}
        </Button>
      </div>
    </div>
  );
}
