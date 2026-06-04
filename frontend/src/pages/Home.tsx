import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { simulateContract } from "@wagmi/core";
import { formatUnits, parseUnits } from "viem";
import { Search, Plus } from "lucide-react";
import { Link } from "wouter";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/hooks/useWallet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSortBy, setSearchQuery } from "@/store/slices/projectsSlice";
import { useMarketsData } from "@/hooks/useMarketsData";
import { useAmmData } from "@/hooks/useAmmData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { CONTRACTS } from "@/config/contracts";
import { ERC20_ABI, VAULT_ABI } from "@/config/abis";
import { config as wagmiConfig } from "@/config/wagmi";
import {
  ProjectDetailsModal,
  HeroSection,
  ProjectFilters,
  ProjectGrid,
  AMMSpotlight,
  CTABanner,
} from "@/components/home";
import { pct, friendlyTxError, USDC_DECIMALS } from "@/utils/homeFormatters";

export default function Home() {
  const { address, isConnected, isWrongNetwork, role } = useWallet();
  const { pools: ammPools } = useAmmData(0, "buy", "");
  const { openConnectModal } = useConnectModal();
  const dispatch = useAppDispatch();
  const activeSort = useAppSelector((s) => s.projects.sortBy);
  const query = useAppSelector((s) => s.projects.searchQuery);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ReturnType<
    typeof useMarketsData
  >["projects"][0] | null>(null);
  const [investAmount, setInvestAmount] = useState("");
  const [actionType, setActionType] = useState<"approve" | "invest" | null>(null);
  const [preflightError, setPreflightError] = useState("");
  const [handledTxHash, setHandledTxHash] = useState<`0x${string}` | undefined>();

  /* Contract data */
  const {
    projects,
    tvl,
    totalRaised,
    activeProjectCount,
    refetch: refetchMarkets,
  } = useMarketsData();
  const openProjects = useMemo(
    () => projects.filter((project) => project.approved && !project.fundingClosed),
    [projects]
  );
  const count = openProjects.length;

  /* Filter + sort */
  const filtered = openProjects
    .filter(
      (p) =>
        query === "" ||
        String(p.id).includes(query) ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.metadataUri.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (activeSort === "Most Funded") return b.totalRaised - a.totalRaised;
      if (activeSort === "Ending Soon") return a.daysLeft - b.daysLeft;
      if (activeSort === "Most Milestones")
        return (
          Math.max(0, b.currentMilestone - 1) - Math.max(0, a.currentMilestone - 1)
        );
      return 0;
    });

  const [activeCategory, setActiveCategory] = useState("All");

  const categoryFiltered = useMemo(() => {
    if (activeCategory === "Trending")
      return filtered.filter((p) => pct(p.totalRaised, p.fundingGoal) >= 60);
    if (activeCategory === "Closing Soon")
      return filtered.filter((p) => p.daysLeft <= 7 && p.daysLeft >= 0 && !p.fundingClosed);
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

  const usdcBalance = usdcBalanceRaw
    ? Number(formatUnits(usdcBalanceRaw as bigint, USDC_DECIMALS))
    : 0;
  const usdcBalanceBigint = (usdcBalanceRaw as bigint | undefined) ?? 0n;
  const usdcAllowance = (usdcAllowanceRaw as bigint | undefined) ?? 0n;
  const usdcAllowanceFormatted = Number(formatUnits(usdcAllowance, USDC_DECIMALS));
  const requiredAmountFormatted = investAmountRaw
    ? Number(formatUnits(investAmountRaw, USDC_DECIMALS))
    : 0;
  const needsApproval = !!investAmountRaw && usdcAllowance < investAmountRaw;
  const insufficientBalance = !!investAmountRaw && investAmountRaw > usdcBalanceBigint;
  const canTransact = !!investAmountRaw && !insufficientBalance;
  const validationError =
    isConnected && !investAmountRaw
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

  /* Timeout actions */
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
  }, [isTimeoutTxSuccess, refetchMarkets]);

  function handleTriggerTimeout(projectId: number) {
    writeTimeout({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "triggerMilestoneTimeout",
      args: [BigInt(projectId)],
    });
  }
  function handleVoteTimeout(projectId: number, extend: boolean) {
    writeTimeout({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "voteTimeout",
      args: [BigInt(projectId), extend],
    });
  }
  function handleExecuteTimeout(projectId: number) {
    writeTimeout({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "executeTimeoutOutcome",
      args: [BigInt(projectId)],
    });
  }
  function handleClaimTimeoutRefund(projectId: number) {
    writeTimeout({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "claimTimeoutRefund",
      args: [BigInt(projectId)],
    });
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
        setPreflightError(
          friendlyTxError(error instanceof Error ? error : String(error))
        );
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
      setPreflightError(
        friendlyTxError(error instanceof Error ? error : String(error))
      );
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
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-sm tracking-tight">Raise</span>
          </div>

          <div className="hidden md:flex items-center gap-0.5 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin", href: "/dashboard" }] : []),
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button
                  className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                    l.href === "/"
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "hover:bg-secondary hover:text-foreground"
                  }`}
                >
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
            onClick={() => {
              if (!isConnected) {
                openConnectModal?.();
                return;
              }
              setShowSubmitModal(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> List Project
          </Button>

          <ConnectButton accountStatus="avatar" showBalance={false} />
        </div>
      </nav>

      <HeroSection
        totalRaised={totalRaised}
        tvl={tvl}
        activeProjectCount={activeProjectCount}
      />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-6">
        <ProjectFilters
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeSort={activeSort}
          onSortChange={(s) => dispatch(setSortBy(s))}
          resultCount={categoryFiltered.length}
          query={query}
        />

        <ProjectGrid
          projects={categoryFiltered}
          openCount={count}
          onSelect={setSelectedProject}
        />

        <AMMSpotlight pools={ammPools} />

        <CTABanner
          isConnected={isConnected}
          onConnect={() => openConnectModal?.()}
          onSubmit={() => setShowSubmitModal(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-5 px-4 mt-4">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Raise</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/amm">
              <span className="hover:text-foreground transition-colors cursor-pointer">
                AMM
              </span>
            </Link>
            <Link href="/portfolio">
              <span className="hover:text-foreground transition-colors cursor-pointer">
                Portfolio
              </span>
            </Link>
            <a
              href="https://github.com/NaolZebene/CrowdFundingDS"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
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
