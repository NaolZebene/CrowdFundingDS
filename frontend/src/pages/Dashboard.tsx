import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useWallet } from "@/hooks/useWallet";
import { useMarketsData } from "@/hooks/useMarketsData";
import { AMM_ABI, VAULT_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  Landmark,
  Shield,
  CheckCircle2,
  XCircle,
  Settings,
  PackageCheck,
  Layers,
  KeyRound,
  Activity,
  Loader2,
} from "lucide-react";

const USDC_DECIMALS = 6;

type AdminSection = "overview" | "approvals" | "vault" | "amm" | "permissions";

const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

function isAddressLike(v: string): v is `0x${string}` {
  return v.startsWith("0x") && v.length === 42;
}

function DashboardShell({
  title,
  subtitle,
  roleLabel,
  navMode = "user",
  showAdminShortcutInUserNav = false,
  children,
}: {
  title: string;
  subtitle: string;
  roleLabel: string;
  navMode?: "admin" | "user";
  showAdminShortcutInUserNav?: boolean;
  children: React.ReactNode;
}) {
  const navLinks = navMode === "admin"
    ? [
        { label: "Admin Dashboard", href: "/dashboard" },
        { label: "User View", href: "/" },
      ]
    : [
        ...(showAdminShortcutInUserNav ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
        { label: "Markets", href: "/" },
        { label: "AMM Swap", href: "/amm" },
        { label: "Portfolio", href: "/portfolio" },
        { label: "Governance", href: "/governance" },
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 shrink-0 cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-wide">CrowdVault</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {navLinks.map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${l.href === "/dashboard" ? "bg-secondary text-foreground" : ""}`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="uppercase font-mono text-[10px]">
              {roleLabel}
            </Badge>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
            Role Dashboard
          </p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

function AccessDenied({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-8 text-center space-y-3">
        <XCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Link href={ctaHref}><Button size="sm" className="h-8 text-xs">{ctaLabel}</Button></Link>
      </CardContent>
    </Card>
  );
}

function AdminSidebar({
  section,
  onSection,
}: {
  section: AdminSection;
  onSection: (next: AdminSection) => void;
}) {
  const items: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Activity className="w-4 h-4" /> },
    { id: "approvals", label: "Approvals", icon: <PackageCheck className="w-4 h-4" /> },
    { id: "vault", label: "Vault Config", icon: <Settings className="w-4 h-4" /> },
    { id: "amm", label: "AMM Config", icon: <Layers className="w-4 h-4" /> },
    { id: "permissions", label: "Permissions", icon: <KeyRound className="w-4 h-4" /> },
  ];

  return (
    <Card className="bg-card border-border h-fit md:sticky md:top-20">
      <CardContent className="p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSection(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors ${section === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </CardContent>
    </Card>
  );
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
  const [oracleInput, setOracleInput] = useState("");
  const [zkInput, setZkInput] = useState("");
  const [newVaultAdminInput, setNewVaultAdminInput] = useState("");
  const [ammFeeInput, setAmmFeeInput] = useState("");
  const [seedProjectId, setSeedProjectId] = useState("");
  const [seedUsdcInput, setSeedUsdcInput] = useState("");
  const [seedCommitInput, setSeedCommitInput] = useState("");
  const [removeLiquidityProjectId, setRemoveLiquidityProjectId] = useState("");
  const [newAmmAdminInput, setNewAmmAdminInput] = useState("");
  const [lastAction, setLastAction] = useState("");

  const { data: vaultAdmin, refetch: refetchVaultAdmin } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "admin" });
  const { data: vaultPendingAdmin, refetch: refetchVaultPending } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "pendingAdmin" });
  const { data: projectSubmissionFee, refetch: refetchSubmissionFee } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "projectSubmissionFee" });
  const { data: releaseFeeBps, refetch: refetchReleaseFee } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "releaseFeeBps" });
  const { data: revenueRouter, refetch: refetchRevenueRouter } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "revenueRouter" });
  const { data: lender, refetch: refetchLender } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "lender" });
  const { data: oracle, refetch: refetchOracle } = useReadContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "oracle" });

  const checkedZkAddress = isAddressLike(zkInput) ? zkInput : undefined;
  const { data: isZkApproved, refetch: refetchZkStatus } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "approvedZK",
    args: checkedZkAddress ? [checkedZkAddress] : undefined,
    query: { enabled: !!checkedZkAddress },
  });

  const { data: ammAdmin, refetch: refetchAmmAdmin } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "admin" });
  const { data: ammPendingAdmin, refetch: refetchAmmPending } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "pendingAdmin" });
  const { data: ammFeeBps, refetch: refetchAmmFee } = useReadContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "feeBps" });

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
    void refetchOracle();
    void refetchAmmAdmin();
    void refetchAmmPending();
    void refetchAmmFee();
    if (checkedZkAddress) void refetchZkStatus();
  }, [
    isTxSuccess,
    checkedZkAddress,
    refetchAmmAdmin,
    refetchAmmFee,
    refetchAmmPending,
    refetchLender,
    refetchOracle,
    refetchReleaseFee,
    refetchRevenueRouter,
    refetchSubmissionFee,
    refetchVaultAdmin,
    refetchVaultPending,
    refetchZkStatus,
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
    "CrowdVault.setOracle(address)",
    "CrowdVault.addZK(address)",
    "CrowdVault.removeZK(address)",
    "CrowdVault.transferAdmin(address)",
    "CrowdVault.approveProject(uint256)",
    "CommitmentAMM.setFee(uint256)",
    "CommitmentAMM.transferAdmin(address)",
    "CommitmentAMM.seed(uint256,uint256,uint256)",
    "CommitmentAMM.removeLiquidity(uint256)",
  ];

  const summaryCards = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-[11px] text-muted-foreground">Total Projects</p><p className="text-xl font-mono font-bold">{projects.length}</p></CardContent></Card>
      <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-[11px] text-muted-foreground">Approved</p><p className="text-xl font-mono font-bold text-green-400">{approved.length}</p></CardContent></Card>
      <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-[11px] text-muted-foreground">Pending</p><p className="text-xl font-mono font-bold text-yellow-400">{pending.length}</p></CardContent></Card>
      <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-[11px] text-muted-foreground">TVL</p><p className="text-xl font-mono font-bold">{fmtUSD(tvl)}</p></CardContent></Card>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <AdminSidebar section={section} onSection={setSection} />

      <div className="space-y-4">
        {summaryCards}

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Admin Transaction Status</p>
              <p className="text-xs text-muted-foreground">{lastAction || "No admin action submitted yet."}</p>
            </div>
            <div className="text-xs">
              {isBusy ? (
                <span className="inline-flex items-center gap-1 text-yellow-400"><Loader2 className="w-3 h-3 animate-spin" /> Pending...</span>
              ) : isTxSuccess ? (
                <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> Confirmed</span>
              ) : writeError ? (
                <span className="inline-flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" /> Failed</span>
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
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">Lender</p><p className="font-mono break-all">{String(lender ?? "-")}</p></div>
                  <div className="border border-border rounded-md p-3"><p className="text-muted-foreground mb-1">Oracle</p><p className="font-mono break-all">{String(oracle ?? "-")}</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={revenueRouterInput} onChange={(e) => setRevenueRouterInput(e.target.value)} placeholder="Revenue Router address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(revenueRouterInput)} onClick={() => runAction("Set Revenue Router", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setRevenueRouter", args: [revenueRouterInput as `0x${string}`] }))}>Set Revenue Router</Button>
                  <Input value={lenderInput} onChange={(e) => setLenderInput(e.target.value)} placeholder="Lender address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(lenderInput)} onClick={() => runAction("Set Lender", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setLender", args: [lenderInput as `0x${string}`] }))}>Set Lender</Button>
                  <Input value={oracleInput} onChange={(e) => setOracleInput(e.target.value)} placeholder="Oracle address" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(oracleInput)} onClick={() => runAction("Set Oracle", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "setOracle", args: [oracleInput as `0x${string}`] }))}>Set Oracle</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">ZK Verifiers and Admin Transfer</p>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs items-center">
                  <Input value={zkInput} onChange={(e) => setZkInput(e.target.value)} placeholder="ZK verifier address" />
                  <div className="text-muted-foreground">Approved: <span className="font-mono text-foreground">{checkedZkAddress ? String(Boolean(isZkApproved)) : "-"}</span></div>
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy || !isAddressLike(zkInput)} onClick={() => runAction("Add ZK", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "addZK", args: [zkInput as `0x${string}`] }))}>Add ZK</Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" disabled={isBusy || !isAddressLike(zkInput)} onClick={() => runAction("Remove ZK", () => writeContract({ address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "removeZK", args: [zkInput as `0x${string}`] }))}>Remove ZK</Button>
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

                  <Input value={seedProjectId} onChange={(e) => setSeedProjectId(e.target.value)} placeholder="Seed project id" />
                  <Input value={seedUsdcInput} onChange={(e) => setSeedUsdcInput(e.target.value)} placeholder="Seed USDC amount" />
                  <Input value={seedCommitInput} onChange={(e) => setSeedCommitInput(e.target.value)} placeholder="Seed COMMIT amount" />
                  <Button size="sm" className="h-9 text-xs" disabled={isBusy} onClick={() => {
                    const pid = Number(seedProjectId);
                    if (!Number.isFinite(pid) || pid <= 0) return;
                    let usdcIn: bigint;
                    let commitIn: bigint;
                    try {
                      usdcIn = parseUnits(seedUsdcInput || "0", USDC_DECIMALS);
                      commitIn = parseUnits(seedCommitInput || "0", USDC_DECIMALS);
                    } catch {
                      return;
                    }
                    if (usdcIn <= 0n || commitIn <= 0n) return;
                    runAction("Seed AMM Pool", () => writeContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "seed", args: [BigInt(Math.floor(pid)), usdcIn, commitIn] }));
                  }}>Seed Pool</Button>

                  <Input value={removeLiquidityProjectId} onChange={(e) => setRemoveLiquidityProjectId(e.target.value)} placeholder="Project id to remove liquidity" />
                  <Button size="sm" variant="outline" className="h-9 text-xs" disabled={isBusy} onClick={() => {
                    const pid = Number(removeLiquidityProjectId);
                    if (!Number.isFinite(pid) || pid <= 0) return;
                    runAction("Remove AMM Liquidity", () => writeContract({ address: CONTRACTS.AMM, abi: AMM_ABI, functionName: "removeLiquidity", args: [BigInt(Math.floor(pid))] }));
                  }}>Remove Liquidity</Button>
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
