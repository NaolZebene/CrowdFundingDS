import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AdminSummaryCards({
  totalProjects,
  approvedProjects,
  pendingProjects,
  tvl,
  formatUsd,
}: {
  totalProjects: number;
  approvedProjects: number;
  pendingProjects: number;
  tvl: number;
  formatUsd: (value: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground">Total Projects</p>
          <p className="text-xl font-mono font-bold">{totalProjects}</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground">Approved</p>
          <p className="text-xl font-mono font-bold text-green-400">{approvedProjects}</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground">Pending</p>
          <p className="text-xl font-mono font-bold text-yellow-400">{pendingProjects}</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground">TVL</p>
          <p className="text-xl font-mono font-bold">{formatUsd(tvl)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminTransactionStatus({
  lastAction,
  isBusy,
  isTxSuccess,
  writeError,
}: {
  lastAction: string;
  isBusy: boolean;
  isTxSuccess: boolean;
  writeError: Error | null;
}) {
  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Admin Transaction Status</p>
            <p className="text-xs text-muted-foreground">{lastAction || "No admin action submitted yet."}</p>
          </div>
          <div className="text-xs">
            {isBusy ? (
              <span className="inline-flex items-center gap-1 text-yellow-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Pending...
              </span>
            ) : isTxSuccess ? (
              <span className="inline-flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Confirmed
              </span>
            ) : writeError ? (
              <span className="inline-flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" /> Failed
              </span>
            ) : (
              <span className="text-muted-foreground">Idle</span>
            )}
          </div>
        </CardContent>
      </Card>

      {writeError && (
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-xs text-red-400 break-words">{writeError.message}</CardContent>
        </Card>
      )}
    </>
  );
}
