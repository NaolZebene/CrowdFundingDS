import { useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useWallet } from "@/hooks/useWallet";
import { useMarketsData } from "@/hooks/useMarketsData";
import { AMM_ABI, ERC20_ABI, MOCK_LENDER_ABI, REVENUE_ROUTER_ABI, VAULT_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  Shield,
  Settings,
  PackageCheck,
  Layers,
  KeyRound,
  CircleDollarSign,
  TrendingUp,
  Wallet,
  BarChart3,
  ArrowUpRight,
  Landmark,
  Coins,
  PiggyBank,
} from "lucide-react";
import { AdminSidebar, type AdminSection } from "@/components/dashboard/AdminSidebar";
import { AccessDenied, DashboardShell } from "@/components/dashboard/DashboardLayout";
import { AdminSummaryCards, AdminTransactionStatus } from "@/components/dashboard/AdminOverviewComponents";

const USDC_DECIMALS = 6;
const FALLBACK_SEED_YIELD_AMOUNT = 10_000n; // 0.01 USDC

const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

function isAddressLike(v: string): v is `0x${string}` {
  return v.startsWith("0x") && v.length === 42;
}

function AdminDashboardView() {
  const [section, setSection] = useState<AdminSection>("overview");
  const { projects, tvl } = useMarketsData();
  const pending = useMemo(() => projects.filter((p) => !p.approved), [projects]);
  const approved = useMemo(() => projects.filter((p) => p.approved), [projects]);

  const [submissionFeeInput, setSubmissionFeeInput] = useState("");
  const [releaseFeeInput, setReleaseFeeInput] = useState("");
  const [revenueRouterInput, setRevenueRouterInput] = useState("");
  const [lenderInput, setLenderInput] = useState("");
  const [newVaultAdminInput, setNewVaultAdminInput] = useState("");
  const [ammFeeInput, setAmmFeeInput] = useState("");
  const [newAmmAdminInput, setNewAmmAdminInput] = useState("");
  const [lastAction, setLastAction] = useState("");

  const { data: vaultAdmin, refetch: refetchVaultAdmin } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "admin" });
  const { data: vaultPendingAdmin, refetch: refetchVaultPending } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "pendingAdmin" });
  const { data: projectSubmissionFee, refetch: refetchSubmissionFee } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "projectSubmissionFee" });
  const { data: releaseFeeBps, refetch: refetchReleaseFee } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "releaseFeeBps" });
  const { data: revenueRouter, refetch: refetchRevenueRouter } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "revenueRouter" });
  const { data: lender, refetch: refetchLender } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "lender" });
  const connectedLender = String(lender ?? "");
  const configuredLenderMatches = String(lender ?? "").toLowerCase() === CONTRACTS.LENDER.toLowerCase();
  const canSeedYield = isAddressLike(connectedLender);
  const routerConfiguredInVault = String(revenueRouter ?? "").toLowerCase() === CONTRACTS.ROUTER.toLowerCase();

  const { data: routerAdmin, refetch: refetchRouterAdmin } = useReadContract({ address: CONTRACTS.ROUTER, abi: REVENUE_ROUTER_ABI, functionName: "admin" });
  const { data: routerRevenueReceived, refetch: refetchRouterRevenueReceived } = useReadContract({ address: CONTRACTS.ROUTER, abi: REVENUE_ROUTER_ABI, functionName: "totalRevenueReceived" });
  const { data: routerTotalCollected, refetch: refetchRouterTotalCollected } = useReadContract({ address: CONTRACTS.ROUTER, abi: REVENUE_ROUTER_ABI, functionName: "totalCollected" });
  const { data: routerUsdcBalance, refetch: refetchRouterUsdcBalance } = useReadContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CONTRACTS.ROUTER] });
  const { data: lenderYieldAmount } = useReadContract({
    address: isAddressLike(connectedLender) ? connectedLender as `0x${string}` : undefined,
    abi: MOCK_LENDER_ABI,
    functionName: "YIELD_AMOUNT",
    query: { enabled: isAddressLike(connectedLender) },
  });
  const { data: lenderAvailableYield, refetch: refetchLenderAvailableYield } = useReadContract({
    address: isAddressLike(connectedLender) ? connectedLender as `0x${string}` : undefined,
    abi: MOCK_LENDER_ABI,
    functionName: "yieldBalance",
    query: { enabled: isAddressLike(connectedLender) },
  });

  const { data: ammAdmin, refetch: refetchAmmAdmin } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "admin" });
  const { data: ammPendingAdmin, refetch: refetchAmmPending } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "pendingAdmin" });
  const { data: ammFeeBps, refetch: refetchAmmFee } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "feeBps" });

  const { data: vaultUsdcBalance, refetch: refetchVaultUsdc } = useReadContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CONTRACTS.VAULT] });
  const { data: lenderUsdcBalance, refetch: refetchLenderUsdc } = useReadContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CONTRACTS.LENDER] });
  const { data: ammUsdcBalance, refetch: refetchAmmUsdc } = useReadContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CONTRACTS.AMM] });
  const { data: treasuryUsdcBalance, refetch: refetchTreasuryUsdc } = useReadContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CONTRACTS.TREASURY] });
  const { data: vaultYieldIndex } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "yieldIndex" });

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isBusy = isWriting || isTxPending;

  useEffect(() => {
    if (!isTxSuccess) return;
    void refetchVaultAdmin();
    void refetchVaultPending();
    void refetchSubmissionFee();
    void refetchReleaseFee();
    void refetchRevenueRouter();
    void refetchLender();
    void refetchAmmAdmin();
    void refetchAmmPending();
    void refetchAmmFee();
    void refetchRouterAdmin();
    void refetchRouterRevenueReceived();
    void refetchRouterTotalCollected();
    void refetchRouterUsdcBalance();
    void refetchVaultUsdc();
    void refetchLenderUsdc();
    void refetchAmmUsdc();
    void refetchTreasuryUsdc();
    void refetchLenderAvailableYield();
  }, [
    isTxSuccess,
    refetchAmmAdmin,
    refetchAmmFee,
    refetchAmmPending,
    refetchLender,
    refetchReleaseFee,
    refetchRevenueRouter,
    refetchRouterAdmin,
    refetchRouterRevenueReceived,
    refetchRouterTotalCollected,
    refetchRouterUsdcBalance,
    refetchVaultUsdc,
    refetchLenderUsdc,
    refetchAmmUsdc,
    refetchTreasuryUsdc,
    refetchLenderAvailableYield,
    refetchSubmissionFee,
    refetchVaultAdmin,
    refetchVaultPending,
  ]);

  function runAction(label: string, run: () => void) {
    setLastAction(label);
    run();
  }

  const adminFunctions = [
    "CrowdVault.setSubmissionFee(uint256)",
    "CrowdVault.setReleaseFeeBps(uint256)",
    "CrowdVault.setRevenueRouter(address)",
    "CrowdVault.setLender(address)",
    "CrowdVault.harvestYield()",
    "CrowdVault.transferAdmin(address)",
    "CrowdVault.approveProject(uint256)",
    "RevenueRouter.collect()",
    "CommitmentAMM.setFee(uint256)",
    "CommitmentAMM.transferAdmin(address)",
  ];

  const toN = (v: unknown) => v ? Number(formatUnits(v as bigint, USDC_DECIMALS)) : 0;
  const vaultUSDC      = toN(vaultUsdcBalance);
  const lenderUSDC     = toN(lenderUsdcBalance);
  const ammUSDC        = toN(ammUsdcBalance);
  const treasuryUSDC   = toN(treasuryUsdcBalance);
  const routerUSDC     = toN(routerUsdcBalance);
  const routerCollectable = (routerUsdcBalance as bigint | undefined) ?? 0n;
  const availableYield = (lenderAvailableYield as bigint | undefined) ?? 0n;
  const seedYieldAmount = (lenderYieldAmount as bigint | undefined) ?? FALLBACK_SEED_YIELD_AMOUNT;
  const yieldIndexFmt  = vaultYieldIndex ? Number(formatUnits(vaultYieldIndex as bigint, 18)).toFixed(6) : "1.000000";
  const totalProtocolUSDC = vaultUSDC + lenderUSDC + ammUSDC + treasuryUSDC + routerUSDC;
  const totalRaisedAll = projects.reduce((s, p) => s + p.totalRaised, 0);
  const totalReleasedAll = projects.reduce((s, p) => s + p.totalReleased, 0);
  const lockedInVault = Math.max(0, totalRaisedAll - totalReleasedAll);
  const releasePct = totalRaisedAll > 0 ? (totalReleasedAll / totalRaisedAll) * 100 : 0;
  const feeBps = Number(releaseFeeBps ?? 0);
  const estFeeEarned = (totalReleasedAll * feeBps) / 10000;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
      <AdminSidebar section={section} onSection={setSection} />

      <div className="space-y-4 min-w-0">
        <AdminSummaryCards
          totalProjects={projects.length}
          approvedProjects={approved.length}
          pendingProjects={pending.length}
          tvl={tvl}
          formatUsd={fmtUSD}
        />

        <AdminTransactionStatus
          lastAction={lastAction}
          isBusy={isBusy}
          isTxSuccess={isTxSuccess}
          writeError={writeError}
        />

        {section === "overview" && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Current Admin State</p>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">Vault Admin</p><p className="font-mono break-all">{String(vaultAdmin ?? "-")}</p></div>
                <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">Vault Pending Admin</p><p className="font-mono break-all">{String(vaultPendingAdmin ?? "-")}</p></div>
                <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">AMM Admin</p><p className="font-mono break-all">{String(ammAdmin ?? "-")}</p></div>
                <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">AMM Pending Admin</p><p className="font-mono break-all">{String(ammPendingAdmin ?? "-")}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {section === "approvals" && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><PackageCheck className="w-4 h-4 text-primary" /> Pending Project Approvals</p>
              <Separator />
              {pending.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending projects right now.</p>
              ) : (
                pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border border-border rounded-md p-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">Project #{p.id} · Goal {fmtUSD(p.fundingGoal)} · {p.daysLeft}d left</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isBusy}
                      onClick={() => runAction(`Approve Project #${p.id}`, () => {
                        writeContract({
                          address: CONTRACTS.VAULT,
                          abi: VAULT_ABI,
                          functionName: "approveProject",
                          args: [BigInt(p.id)],
                        });
                      })}
                    >
                      Approve
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {section === "financials" && (
          <div className="space-y-5">

            {/* ── KPI bar ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Protocol USDC (all contracts)",
                  value: fmtUSD(totalProtocolUSDC),
                  sub: "vault + lender + AMM + treasury + router",
                  icon: <Landmark className="w-4 h-4" />,
                  color: "text-green-400",
                  accent: "from-green-500/8",
                },
                {
                  label: "Total Raised (all projects)",
                  value: fmtUSD(totalRaisedAll),
                  sub: `${projects.length} project${projects.length !== 1 ? "s" : ""}`,
                  icon: <TrendingUp className="w-4 h-4" />,
                  color: "text-blue-400",
                  accent: "from-blue-500/8",
                },
                {
                  label: "Total Released to Founders",
                  value: fmtUSD(totalReleasedAll),
                  sub: `${releasePct.toFixed(1)}% of raised`,
                  icon: <ArrowUpRight className="w-4 h-4" />,
                  color: "text-yellow-400",
                  accent: "from-yellow-500/8",
                },
                {
                  label: "Est. Release Fees Earned",
                  value: fmtUSD(estFeeEarned),
                  sub: `${feeBps} bps release fee`,
                  icon: <PiggyBank className="w-4 h-4" />,
                  color: "text-primary",
                  accent: "from-primary/8",
                },
              ].map((k) => (
                <Card key={k.label} className="bg-card border-border overflow-hidden group hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${k.accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className="relative flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-secondary ${k.color} shrink-0`}>{k.icon}</div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{k.label}</p>
                        <p className={`text-xl font-mono font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── USDC distribution ── */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">USDC Distribution Across Contracts</p>
                </div>
                <Separator />
                <div className="space-y-3">
                  {[
                    { label: "Vault",       value: vaultUSDC,    color: "bg-blue-500",   icon: <Shield className="w-3.5 h-3.5 text-blue-400" />,    addr: CONTRACTS.VAULT },
                    { label: "Lender",      value: lenderUSDC,   color: "bg-green-500",  icon: <PiggyBank className="w-3.5 h-3.5 text-green-400" />, addr: CONTRACTS.LENDER },
                    { label: "AMM",         value: ammUSDC,      color: "bg-purple-500", icon: <Layers className="w-3.5 h-3.5 text-purple-400" />,   addr: CONTRACTS.AMM },
                    { label: "Treasury",    value: treasuryUSDC, color: "bg-yellow-500", icon: <Landmark className="w-3.5 h-3.5 text-yellow-400" />, addr: CONTRACTS.TREASURY },
                    { label: "Rev. Router", value: routerUSDC,   color: "bg-orange-500", icon: <CircleDollarSign className="w-3.5 h-3.5 text-orange-400" />, addr: CONTRACTS.ROUTER },
                  ].map((row) => {
                    const pct = totalProtocolUSDC > 0 ? (row.value / totalProtocolUSDC) * 100 : 0;
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-medium">{row.icon}{row.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground font-mono text-[11px] hidden sm:inline">{row.addr.slice(0, 8)}…{row.addr.slice(-6)}</span>
                            <span className="font-mono font-semibold">{fmtUSD(row.value)}</span>
                            <span className="text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.color} transition-all duration-700`}
                            style={{ width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground font-medium">Total</span>
                    <span className="font-mono font-bold">{fmtUSD(totalProtocolUSDC)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Fund flow summary ── */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Fund Flow Summary</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Lender Balance",      value: fmtUSD(lenderUSDC),       color: "text-blue-400",   note: "USDC held by lender" },
                    { label: "Locked in Vault",    value: fmtUSD(lockedInVault),    color: "text-green-400",  note: "raised − released" },
                    { label: "Released to Founders",value: fmtUSD(totalReleasedAll), color: "text-yellow-400", note: `${releasePct.toFixed(1)}% of raised` },
                    { label: "Yield Index",        value: yieldIndexFmt,            color: "text-purple-400", note: "per-unit yield multiplier" },
                  ].map((item) => (
                    <div key={item.label} className="border border-border rounded-xl p-3 space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{item.label}</p>
                      <p className={`font-mono text-base font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.note}</p>
                    </div>
                  ))}
                </div>

                {/* raise-vs-release progress */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Release progress (all projects)</span>
                    <span className="font-mono">{releasePct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700"
                      style={{ width: `${Math.min(releasePct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{fmtUSD(totalReleasedAll)} released</span>
                    <span>{fmtUSD(totalRaisedAll)} total raised</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Per-project breakdown ── */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Per-Project Financials</p>
                </div>
                <Separator />
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No projects yet.</p>
                ) : (
                  <div className="space-y-2">
                    {/* header row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-3">
                      <span>Project</span>
                      <span className="text-right">Goal</span>
                      <span className="text-right">Raised</span>
                      <span className="text-right">Released</span>
                      <span className="text-right">Locked</span>
                      <span className="text-right">Progress</span>
                    </div>
                    {projects.map((p) => {
                      const locked = Math.max(0, p.totalRaised - p.totalReleased);
                      const fundPct = p.fundingGoal > 0 ? Math.min(100, (p.totalRaised / p.fundingGoal) * 100) : 0;
                      const relPct  = p.totalRaised > 0 ? Math.min(100, (p.totalReleased / p.totalRaised) * 100) : 0;
                      const statusColor = p.goalMet ? "text-green-400" : p.isExpired ? "text-red-400" : p.approved ? "text-blue-400" : "text-yellow-400";
                      const statusLabel = p.goalMet ? "Funded" : p.isExpired ? "Expired" : p.approved ? "Active" : "Pending";
                      return (
                        <div key={p.id} className="border border-border rounded-xl p-3 space-y-2 hover:border-primary/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{p.id}</span>
                                <span className="text-sm font-semibold truncate">{p.name}</span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor} bg-current/10 shrink-0`} style={{ backgroundColor: "transparent", border: "1px solid currentColor" }}>
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{p.founder.slice(0, 10)}…{p.founder.slice(-6)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-mono font-bold">{fmtUSD(p.totalRaised)}</p>
                              <p className="text-[10px] text-muted-foreground">of {fmtUSD(p.fundingGoal)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                            <div className="bg-secondary/40 rounded-md p-1.5">
                              <p className="text-muted-foreground">Released</p>
                              <p className="font-mono font-semibold text-yellow-400">{fmtUSD(p.totalReleased)}</p>
                            </div>
                            <div className="bg-secondary/40 rounded-md p-1.5">
                              <p className="text-muted-foreground">Locked</p>
                              <p className="font-mono font-semibold text-green-400">{fmtUSD(locked)}</p>
                            </div>
                            <div className="bg-secondary/40 rounded-md p-1.5">
                              <p className="text-muted-foreground">Milestones</p>
                              <p className="font-mono font-semibold">{Math.max(0, p.currentMilestone - 1)}/{p.milestoneCount}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Funding</span><span>{fundPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${fundPct}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>Release</span><span>{relPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all" style={{ width: `${relPct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Fee config summary ── */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Fee Configuration</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="border border-border rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Submission Fee</p>
                    <p className="font-mono text-base font-bold mt-1">{projectSubmissionFee ? Number(formatUnits(projectSubmissionFee as bigint, USDC_DECIMALS)).toFixed(2) : "0.00"} <span className="text-muted-foreground text-[11px]">USDC</span></p>
                  </div>
                  <div className="border border-border rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Release Fee</p>
                    <p className="font-mono text-base font-bold mt-1">{feeBps} <span className="text-muted-foreground text-[11px]">bps ({(feeBps / 100).toFixed(2)}%)</span></p>
                  </div>
                  <div className="border border-border rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Router Collected</p>
                    <p className="font-mono text-base font-bold mt-1">{fmtUSD(routerTotalCollected ? Number(formatUnits(routerTotalCollected as bigint, USDC_DECIMALS)) : 0)}</p>
                  </div>
                  <div className="border border-border rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">AMM Fee</p>
                    <p className="font-mono text-base font-bold mt-1">{String(ammFeeBps ?? 0)} <span className="text-muted-foreground text-[11px]">bps</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {section === "revenue" && (
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><CircleDollarSign className="w-4 h-4 text-primary" /> Revenue Router</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground mb-1">Revenue Received</p>
                    <p className="font-mono text-base">{fmtUSD(routerRevenueReceived ? Number(formatUnits(routerRevenueReceived as bigint, USDC_DECIMALS)) : 0)}</p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground mb-1">Available to Collect</p>
                    <p className="font-mono text-base">{fmtUSD(routerUsdcBalance ? Number(formatUnits(routerUsdcBalance as bigint, USDC_DECIMALS)) : 0)}</p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground mb-1">Total Collected</p>
                    <p className="font-mono text-base">{fmtUSD(routerTotalCollected ? Number(formatUnits(routerTotalCollected as bigint, USDC_DECIMALS)) : 0)}</p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground mb-1">Router Admin</p>
                    <p className="font-mono break-all">{String(routerAdmin ?? "-")}</p>
                  </div>
                </div>
                <div className="rounded-md border border-border p-3 text-xs">
                  <p className="text-muted-foreground mb-1">Vault Revenue Router</p>
                  <p className="font-mono break-all">{String(revenueRouter ?? "-")}</p>
                  <p className={`mt-2 text-[10px] ${routerConfiguredInVault ? "text-green-400" : "text-yellow-400"}`}>
                    {routerConfiguredInVault ? "Vault is connected to configured router" : `Configured router: ${CONTRACTS.ROUTER}`}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={revenueRouterInput} onChange={(e) => setRevenueRouterInput(e.target.value)} placeholder="Revenue Router address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(revenueRouterInput)} onClick={() => runAction("Set Revenue Router", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setRevenueRouter", args: [revenueRouterInput as `0x${string}`] }))}>Set Revenue Router</Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" disabled={isBusy} onClick={() => setRevenueRouterInput(CONTRACTS.ROUTER)}>Use Configured Router</Button>
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || routerConfiguredInVault} onClick={() => runAction("Connect Configured Router", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setRevenueRouter", args: [CONTRACTS.ROUTER] }))}>Connect Configured Router</Button>
                  <Button size="sm" className="h-9 text-xs md:col-span-2" disabled={isBusy || routerCollectable === 0n} onClick={() => runAction("Collect Router Revenue", () => writeContract({ address: CONTRACTS.ROUTER, abi: REVENUE_ROUTER_ABI, functionName: "collect" }))}>Collect Revenue</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {section === "vault" && (
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Fee Controls (Vault)</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground">Current Submission Fee</p>
                    <p className="font-mono text-sm">{projectSubmissionFee ? Number(formatUnits(projectSubmissionFee as bigint, USDC_DECIMALS)).toFixed(2) : "0.00"} USDC</p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground">Current Release Fee</p>
                    <p className="font-mono text-sm">{String(releaseFeeBps ?? 0)} bps</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={submissionFeeInput} onChange={(e) => setSubmissionFeeInput(e.target.value)} placeholder="Submission fee in USDC (e.g. 50)" />
                  <Button
                    size="sm"
                    className="h-9 text-xs"
                    disabled={isBusy}
                    onClick={() => {
                      let fee: bigint;
                      try {
                        fee = parseUnits(submissionFeeInput || "0", USDC_DECIMALS);
                      } catch {
                        return;
                      }
                      runAction("Set Submission Fee", () => {
                        writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setSubmissionFee", args: [fee] });
                      });
                    }}
                  >Set Submission Fee</Button>
                  <Input value={releaseFeeInput} onChange={(e) => setReleaseFeeInput(e.target.value)} placeholder="Release fee in bps (max 1000)" />
                  <Button
                    size="sm"
                    className="h-9 text-xs"
                    disabled={isBusy}
                    onClick={() => {
                      const bps = Number(releaseFeeInput);
                      if (!Number.isFinite(bps) || bps < 0 || bps > 1000) return;
                      runAction("Set Release Fee BPS", () => {
                        writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setReleaseFeeBps", args: [BigInt(Math.floor(bps))] });
                      });
                    }}
                  >Set Release Fee</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">Module Addresses (Vault)</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">Revenue Router</p><p className="font-mono break-all">{String(revenueRouter ?? "-")}</p></div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-muted-foreground mb-1">Lender</p>
                    <p className="font-mono break-all">{String(lender ?? "-")}</p>
                    <p className={`mt-2 text-[10px] ${configuredLenderMatches ? "text-green-400" : "text-yellow-400"}`}>
                      {configuredLenderMatches ? "Matches configured lender" : `Configured: ${CONTRACTS.LENDER}`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={revenueRouterInput} onChange={(e) => setRevenueRouterInput(e.target.value)} placeholder="Revenue Router address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(revenueRouterInput)} onClick={() => runAction("Set Revenue Router", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setRevenueRouter", args: [revenueRouterInput as `0x${string}`] }))}>Set Revenue Router</Button>
                  <Input value={lenderInput} onChange={(e) => setLenderInput(e.target.value)} placeholder="Lender address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(lenderInput)} onClick={() => runAction("Set Lender", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setLender", args: [lenderInput as `0x${string}`] }))}>Set Lender</Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" disabled={isBusy} onClick={() => setLenderInput(CONTRACTS.LENDER)}>Use Configured Lender</Button>
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || configuredLenderMatches} onClick={() => runAction("Connect Configured Lender", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setLender", args: [CONTRACTS.LENDER] }))}>Connect Configured Lender</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs md:col-span-2"
                    disabled={isBusy || !canSeedYield}
                    onClick={() => {
                      const amount = seedYieldAmount;
                      if (amount <= 0n || !isAddressLike(connectedLender)) return;
                      runAction("Approve Yield Seed", () => writeContract({
                        address: CONTRACTS.USDC,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [connectedLender as `0x${string}`, amount],
                      }));
                    }}
                  >Approve 0.01 USDC Yield Seed</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs md:col-span-2"
                    disabled={isBusy || !canSeedYield}
                    onClick={() => {
                      runAction("Add Lender Yield", () => writeContract({
                        address: connectedLender as `0x${string}`,
                        abi: MOCK_LENDER_ABI,
                        functionName: "addYield",
                      }));
                    }}
                  >Add 0.01 USDC Yield</Button>
                  <Button size="sm" className="h-9 text-xs md:col-span-2" disabled={isBusy || availableYield === 0n} onClick={() => runAction("Harvest Lender Yield", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "harvestYield" }))}>
                    Harvest {Number(formatUnits(availableYield, USDC_DECIMALS)).toFixed(4)} USDC Yield
                  </Button>
                  <div className="md:col-span-2 border-t border-border pt-3 mt-2">
                    <p className="text-xs text-muted-foreground mb-2">Supply Principal to Lender</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount (USDC)"
                        onChange={(e) => {
                          const val = e.target.value;
                          (window as any).__lenderSupplyAmount = val ? parseUnits(val, USDC_DECIMALS) : 0n;
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs"
                        disabled={isBusy || !canSeedYield}
                        onClick={() => {
                          const amount = (window as any).__lenderSupplyAmount || 0n;
                          if (amount <= 0n || !isAddressLike(connectedLender)) return;
                          runAction("Approve Lender Supply", () => writeContract({
                            address: CONTRACTS.USDC,
                            abi: ERC20_ABI,
                            functionName: "approve",
                            args: [connectedLender as `0x${string}`, amount],
                          }));
                        }}
                      >Approve USDC</Button>
                      <Button
                        size="sm"
                        className="h-9 text-xs md:col-span-2"
                        disabled={isBusy || !canSeedYield}
                        onClick={() => {
                          const amount = (window as any).__lenderSupplyAmount || 0n;
                          if (amount <= 0n || !isAddressLike(connectedLender)) return;
                          runAction("Supply to Lender", () => writeContract({
                            address: connectedLender as `0x${string}`,
                            abi: MOCK_LENDER_ABI,
                            functionName: "supply",
                            args: [amount],
                          }));
                        }}
                      >Supply to Lender</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">Vault Admin Transfer</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs items-center">
                  <Input value={newVaultAdminInput} onChange={(e) => setNewVaultAdminInput(e.target.value)} placeholder="New Vault admin address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(newVaultAdminInput)} onClick={() => runAction("Transfer Vault Admin", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "transferAdmin", args: [newVaultAdminInput as `0x${string}`] }))}>Transfer Vault Admin</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {section === "amm" && (
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> AMM Admin Controls</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground">AMM Fee</p><p className="font-mono">{String(ammFeeBps ?? 0)} bps</p></div>
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground">AMM Admin</p><p className="font-mono break-all">{String(ammAdmin ?? "-")}</p></div>
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground">Pending Admin</p><p className="font-mono break-all">{String(ammPendingAdmin ?? "-")}</p></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={ammFeeInput} onChange={(e) => setAmmFeeInput(e.target.value)} placeholder="AMM fee in bps (max 1000)" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy} onClick={() => {
                    const bps = Number(ammFeeInput);
                    if (!Number.isFinite(bps) || bps < 0 || bps > 1000) return;
                    runAction("Set AMM Fee", () => writeContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "setFee", args: [BigInt(Math.floor(bps))] }));
                  }}>Set AMM Fee</Button>

                  <Input value={newAmmAdminInput} onChange={(e) => setNewAmmAdminInput(e.target.value)} placeholder="New AMM admin address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(newAmmAdminInput)} onClick={() => runAction("Transfer AMM Admin", () => writeContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "transferAdmin", args: [newAmmAdminInput as `0x${string}`] }))}>Transfer AMM Admin</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {section === "permissions" && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> Admin-Only Functions (Checked)</p>
              <Separator />
              <p className="text-xs text-muted-foreground">These are the functions gated by `onlyAdmin` in your current contracts.</p>
              <div className="space-y-2">
                {adminFunctions.map((fn) => (
                  <div key={fn} className="flex items-center justify-between border border-border rounded-md p-2.5 text-xs">
                    <span className="font-mono">{fn}</span>
                    <Badge variant="secondary">Admin Only</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isConnected, isWrongNetwork, role, isRoleLoading } = useWallet();

  if (!isConnected || isWrongNetwork) return <ConnectPrompt />;
  if (isRoleLoading) return <DashboardShell title="Loading" subtitle="Resolving your role..." roleLabel="checking"><p className="text-sm text-muted-foreground">Checking on-chain permissions...</p></DashboardShell>;
  if (role === "admin") {
    return (
      <DashboardShell
        title="Admin Dashboard"
        subtitle="Manage protocol operations and review project status."
        roleLabel="admin"
        navMode="admin"
      >
        <AdminDashboardView />
      </DashboardShell>
    );
  }
  return <Redirect to="/" />;
}

export function AdminDashboardPage() {
  const { isConnected, isWrongNetwork, role, isRoleLoading } = useWallet();

  if (!isConnected || isWrongNetwork) return <ConnectPrompt />;
  if (isRoleLoading) return <DashboardShell title="Loading" subtitle="Resolving your role..." roleLabel="checking" navMode="admin"><p className="text-sm text-muted-foreground">Checking on-chain permissions...</p></DashboardShell>;
  if (role !== "admin") {
    return (
      <DashboardShell title="Access Control" subtitle="This route is restricted to admins." roleLabel={role} navMode="user">
        <AccessDenied title="Admin Access Required" body="Your connected wallet is not an admin in the contract." ctaHref="/dashboard" ctaLabel="Open My Dashboard" />
      </DashboardShell>
    );
  }
  return <DashboardShell title="Admin Dashboard" subtitle="Manage protocol operations and review project status." roleLabel="admin" navMode="admin"><AdminDashboardView /></DashboardShell>;
}

export function UserDashboardPage() {
  return <Redirect to="/" />;
}
