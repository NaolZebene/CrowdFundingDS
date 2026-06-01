import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "@apollo/client";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI, AMM_ABI, ERC1155_ABI } from "@/config/abis";
import { apolloClient, SUBGRAPH_URL } from "@/lib/apollo";

/* ─── constants ─── */
const USDC_DEC = 6;
const VETO_WINDOW_SECS = 3 * 24 * 60 * 60; // 3 days
const SUBGRAPH_CONFIGURED = !SUBGRAPH_URL.includes("PLACEHOLDER");
const FOUNDER_FUNDING_NOTIFICATIONS_QUERY = gql`
  query FounderFundingNotifications($projectIds: [BigInt!]!) {
    investments(
      first: 100
      orderBy: timestamp
      orderDirection: desc
      where: { projectId_in: $projectIds }
    ) {
      id
      projectId
      investor
      amount
      timestamp
      txHash
      project {
        name
      }
    }
  }
`;

/* ─── helpers ─── */
const toUSDC = (v: bigint) => Number(formatUnits(v, USDC_DEC));
const asReadResult = (entry: unknown): unknown => {
  if (!entry) return undefined;
  if (typeof entry === "object" && "status" in (entry as Record<string, unknown>)) {
    const e = entry as { status?: string; result?: unknown };
    return e.status === "success" ? e.result : undefined;
  }
  if (typeof entry === "object" && "result" in (entry as Record<string, unknown>)) {
    return (entry as { result?: unknown }).result;
  }
  return entry;
};

function daysLeft(deadline: bigint): number {
  const secs = Number(deadline) - Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil(secs / 86400));
}

function friendlyFounderActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("NotProjectFounder")) return "Only the project founder wallet can submit milestones for this project.";
  if (message.includes("FundingGoalNotMet")) return "This project must reach its funding goal before milestone submission.";
  if (message.includes("ReleasePending")) return "A release vote window is already active. Finish or clear it before submitting the next milestone.";
  if (message.includes("MilestoneDone")) return "All milestones for this project are already completed.";
  if (message.includes("AlreadyRequested")) return "A release vote window has already been requested.";
  if (message.includes("VetoActive")) return "This release was vetoed. The treasury must clear the veto before continuing.";
  if (message.includes("NoMilestone")) return "Submit a milestone before requesting a release vote window.";
  if (message.includes("NoRequest")) return "There is no active release request for this project.";
  if (message.includes("VetoWindowNotOver")) return "The backer vote window is still open.";
  if (message.includes("NotTreasury")) return "Only this project's treasury wallet can clear a veto.";
  if (message.includes("NotVetoed")) return "This project does not have an active veto to clear.";
  if (message.includes("NothingToRelease")) return "There are no unlocked funds to release for the current milestone.";
  if (message.includes("User rejected")) return "Transaction rejected in wallet.";
  return message || "Milestone action failed.";
}

/* ─── exported types ─── */
export interface PortfolioPosition {
  id: bigint;
  name: string;
  symbol: string;
  tokensHeld: number;
  /** Always 1.0 — 1 COMMIT minted per 1 USDC invested */
  entryPrice: number;
  /** AMM pool ratio if seeded, otherwise 1.0 */
  currentPrice: number;
  marketValue: number;
  allocationPct: number;
  totalProjectTokens: number;
  projectSharePct: number;
  raised: number;
  goal: number;
  milestones: number;
  milestonesCompleted: number;
  daysLeft: number;
  fundingDeadline: bigint;
  refundable: boolean;
  vetoOpen: boolean;
  hasVoted: boolean;
  hasApproved: boolean;
  releaseApproved: boolean;
  metadataUri: string;
  /** Proportional share of total claimable yield */
  yieldClaimable: number;
  milestoneDeadline: bigint;
  milestoneWindow: number;
  timeoutActive: boolean;
  timeoutOpenedAt: number;
  projectDead: boolean;
  releaseVetoed: boolean;
}

export interface FounderProject {
  id: bigint;
  name: string;
  description: string;
  treasury: string;
  approved: boolean;
  raised: number;
  goal: number;
  released: number;
  releasable: number;
  releaseRequestedAt: bigint;
  releaseVetoed: boolean;
  fundingDeadline: bigint;
  daysLeft: number;
  isExpired: boolean;
  goalMet: boolean;
  initialReleaseClaimed: boolean;
  canClaimInitialRelease: boolean;
  canVerifyNextMilestone: boolean;
  canRequestRelease: boolean;
  canExecuteRelease: boolean;
  canClearVeto: boolean;
  vetoWindowOpen: boolean;
  releaseApproved: boolean;
  canExecuteReleaseEarly: boolean;
  milestones: number;
  milestonesCompleted: number;
  metadataUri: string;
  additionalFilesUrl: string;
  milestoneDeadline: bigint;
  milestoneWindow: number;
  timeoutActive: boolean;
  projectDead: boolean;
}

export interface FundingNotification {
  id: string;
  projectId: bigint;
  projectName: string;
  investor: string;
  amount: number;
  date: string;
  txHash: string;
}

interface NormalizedProject {
  founder: string;
  treasury: string;
  milestoneCount: bigint;
  totalRaised: bigint;
  totalReleased: bigint;
  currentMilestone: bigint;
  releaseRequestedAt: bigint;
  releaseVetoed: boolean;
  metadataUri: string;
  fundingGoal: bigint;
  fundingDeadline: bigint;
  approved: boolean;
  name: string;
  description: string;
  additionalFilesUrl: string;
  totalAmmSeeded: bigint;
  milestoneWindow: bigint;
  milestoneDeadline: bigint;
  timeoutActive: boolean;
  timeoutOpenedAt: bigint;
  projectDead: boolean;
  releaseApproved: boolean;
}

function normalizeProject(projRaw: Record<string, unknown> | readonly unknown[]): NormalizedProject {
  if (Array.isArray(projRaw)) {
    return {
      founder: String(projRaw[0] ?? ""),
      treasury: String(projRaw[1] ?? ""),
      milestoneCount: (projRaw[2] ?? 0n) as bigint,
      totalRaised: (projRaw[3] ?? 0n) as bigint,
      totalReleased: (projRaw[4] ?? 0n) as bigint,
      currentMilestone: (projRaw[5] ?? 0n) as bigint,
      releaseRequestedAt: (projRaw[6] ?? 0n) as bigint,
      releaseVetoed: Boolean(projRaw[7]),
      metadataUri: String(projRaw[8] ?? ""),
      fundingGoal: (projRaw[9] ?? 0n) as bigint,
      fundingDeadline: (projRaw[10] ?? 0n) as bigint,
      approved: Boolean(projRaw[11]),
      name: String(projRaw[12] ?? ""),
      description: String(projRaw[13] ?? ""),
      additionalFilesUrl: String(projRaw[14] ?? ""),
      totalAmmSeeded: (projRaw[15] ?? 0n) as bigint,
      milestoneWindow: (projRaw[16] ?? 0n) as bigint,
      milestoneDeadline: (projRaw[17] ?? 0n) as bigint,
      timeoutActive: Boolean(projRaw[18]),
      timeoutOpenedAt: (projRaw[19] ?? 0n) as bigint,
      projectDead: Boolean(projRaw[20]),
      releaseApproved: Boolean(projRaw[21]),
    };
  }

  const projObj = projRaw as Record<string, unknown>;
  return {
    founder: String(projObj.founder ?? ""),
    treasury: String(projObj.treasury ?? ""),
    milestoneCount: (projObj.milestoneCount ?? 0n) as bigint,
    totalRaised: (projObj.totalRaised ?? 0n) as bigint,
    totalReleased: (projObj.totalReleased ?? 0n) as bigint,
    currentMilestone: (projObj.currentMilestone ?? 0n) as bigint,
    releaseRequestedAt: (projObj.releaseRequestedAt ?? 0n) as bigint,
    releaseVetoed: Boolean(projObj.releaseVetoed ?? false),
    metadataUri: String(projObj.metadataUri ?? ""),
    fundingGoal: (projObj.fundingGoal ?? 0n) as bigint,
    fundingDeadline: (projObj.fundingDeadline ?? 0n) as bigint,
    approved: Boolean(projObj.approved ?? false),
    name: String(projObj.name ?? ""),
    description: String(projObj.description ?? ""),
    additionalFilesUrl: String(projObj.additionalFilesUrl ?? ""),
    totalAmmSeeded: (projObj.totalAmmSeeded ?? 0n) as bigint,
    milestoneWindow: (projObj.milestoneWindow ?? 0n) as bigint,
    milestoneDeadline: (projObj.milestoneDeadline ?? 0n) as bigint,
    timeoutActive: Boolean(projObj.timeoutActive ?? false),
    timeoutOpenedAt: (projObj.timeoutOpenedAt ?? 0n) as bigint,
    projectDead: Boolean(projObj.projectDead ?? false),
    releaseApproved: Boolean(projObj.releaseApproved ?? false),
  };
}

export function usePortfolioData() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const enabled = !!address;

  /* ── 1. Project count ── */
  const { data: projectCount } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "projectCount",
    query: { enabled },
  });

  /* ── 2. Read ERC-1155 COMMIT balances for all project ids (includes AMM buys) ── */
  const holdingContracts = useMemo(() => {
    const count = Number(projectCount ?? 0n);
    if (!address || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      address: CONTRACTS.COMMIT,
      abi: ERC1155_ABI,
      functionName: "balanceOf",
      args: [address, BigInt(i + 1)],
    }));
  }, [address, projectCount]);

  const { data: holdingsData, refetch: refetchHoldings } = useReadContracts({
    contracts: holdingContracts,
    query: { enabled: holdingContracts.length > 0, refetchInterval: 3000 }, // Refresh every 3s to catch new investments
  });

  /* ── Founder projects: all projects where connected wallet is founder ── */
  const allProjectContracts = useMemo(() => {
    const count = Number(projectCount ?? 0n);
    if (!address || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "projects",
      args: [BigInt(i + 1)],
    } as const));
  }, [address, projectCount]);

  const { data: allProjectsData, refetch: refetchAllProjects } = useReadContracts({
    contracts: allProjectContracts,
    query: { enabled: allProjectContracts.length > 0, refetchInterval: 5000 },
  });

  const myProjects: FounderProject[] = useMemo(() => {
    if (!address || !allProjectsData) return [];
    const now = Math.floor(Date.now() / 1000);

    return allProjectsData
      .map((entry, i) => {
        const raw = asReadResult(entry) as Record<string, unknown> | readonly unknown[] | undefined;
        if (!raw) return null;
        const project = normalizeProject(raw);
        if (project.founder.toLowerCase() !== address.toLowerCase()) return null;

        const raised = toUSDC(project.totalRaised);
        const goal = toUSDC(project.fundingGoal);
        const released = toUSDC(project.totalReleased);
        const ammSeeded = toUSDC(project.totalAmmSeeded);
        const fundingDeadline = project.fundingDeadline;
        const isExpired = Number(fundingDeadline) <= now;
        const milestones = Number(project.milestoneCount);
        const currentUnlockedMilestone = Number(project.currentMilestone);
        const milestonesCompleted = currentUnlockedMilestone >= milestones
          ? milestones
          : Math.max(0, currentUnlockedMilestone - 1);
        const initialReleaseClaimed = currentUnlockedMilestone > 0 || released > 0;
        const isTreasuryWallet = project.treasury.toLowerCase() === address.toLowerCase();
        return {
          id: BigInt(i + 1),
          name: project.name || `Project #${i + 1}`,
          description: project.description,
          treasury: project.treasury,
          approved: project.approved,
          raised,
          goal,
          released,
          releasable: (() => {
            if (milestones <= 0) return 0;
            const unlocked = currentUnlockedMilestone === milestones
              ? raised
              : Math.floor((raised / milestones) * currentUnlockedMilestone * 1_000_000) / 1_000_000;
            return Math.max(0, unlocked - released - ammSeeded);
          })(),
          releaseRequestedAt: project.releaseRequestedAt,
          releaseVetoed: project.releaseVetoed,
          fundingDeadline,
          daysLeft: daysLeft(fundingDeadline),
          isExpired,
          goalMet: goal > 0 && raised >= goal,
          initialReleaseClaimed,
          canClaimInitialRelease:
            goal > 0 &&
            raised >= goal &&
            currentUnlockedMilestone === 0 &&
            released === 0 &&
            (project.fundingDeadline === 0n || now > Number(project.fundingDeadline)),
          canVerifyNextMilestone:
            goal > 0 &&
            raised >= goal &&
            currentUnlockedMilestone > 0 &&
            currentUnlockedMilestone < milestones &&
            project.releaseRequestedAt === 0n &&
            !project.releaseVetoed,
          canRequestRelease:
            currentUnlockedMilestone > 0 &&
            released + ammSeeded < raised &&
            project.releaseRequestedAt === 0n &&
            !project.releaseVetoed,
          canExecuteRelease:
            project.releaseRequestedAt > 0n &&
            !project.releaseVetoed &&
            (project.releaseApproved ||
              now >= Number(project.releaseRequestedAt) + VETO_WINDOW_SECS),
          canClearVeto:
            project.releaseVetoed &&
            isTreasuryWallet,
          vetoWindowOpen:
            project.releaseRequestedAt > 0n &&
            !project.releaseVetoed &&
            now < Number(project.releaseRequestedAt) + VETO_WINDOW_SECS,
          releaseApproved: project.releaseApproved,
          canExecuteReleaseEarly:
            project.releaseRequestedAt > 0n &&
            !project.releaseVetoed &&
            project.releaseApproved,
          milestones,
          milestonesCompleted,
          metadataUri: project.metadataUri,
          additionalFilesUrl: project.additionalFilesUrl,
          milestoneDeadline: project.milestoneDeadline,
          milestoneWindow: Number(project.milestoneWindow),
          timeoutActive: project.timeoutActive,
          projectDead: project.projectDead,
        } satisfies FounderProject;
      })
      .filter(Boolean) as FounderProject[];
  }, [address, allProjectsData]);

  const projectNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const project of myProjects) {
      names.set(project.id.toString(), project.name);
    }
    return names;
  }, [myProjects]);

  const fundingNotificationsQuery = useQuery({
    queryKey: [
      "founder-funding-notifications",
      address,
      CONTRACTS.VAULT,
      myProjects.map((p) => p.id.toString()).join(","),
    ],
    enabled: !!address && SUBGRAPH_CONFIGURED && myProjects.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FundingNotification[]> => {
      if (myProjects.length === 0) return [];

      type FundingNotificationsData = {
        investments?: Array<{
          id: string;
          projectId: string;
          investor: string;
          amount: string;
          timestamp: string;
          txHash: string;
          project?: { name?: string | null } | null;
        }>;
      };

      const projectIds = myProjects.map((p) => p.id.toString());
      const { data } = await apolloClient.query<FundingNotificationsData>({
        query: FOUNDER_FUNDING_NOTIFICATIONS_QUERY,
        variables: { projectIds },
        fetchPolicy: "network-only",
        errorPolicy: "all",
      });

      return (data?.investments ?? []).map((investment) => {
        const projectId = BigInt(investment.projectId);
        return {
          id: investment.id,
          projectId,
          projectName:
            investment.project?.name ||
            projectNameById.get(investment.projectId) ||
            `Project #${investment.projectId}`,
          investor: investment.investor,
          amount: toUSDC(BigInt(investment.amount)),
          date: new Date(Number(investment.timestamp) * 1000).toISOString(),
          txHash: investment.txHash,
        };
      });
    },
  });

  /* ── 3. Filter to positions where user holds tokens ── */
  const activeHoldings = useMemo(() => {
    if (!holdingsData || !holdingsData.length) return [];
    return holdingsData
      .map((entry, i) => ({
        id: BigInt(i + 1),
        amount: (asReadResult(entry) ?? 0n) as bigint,
      }))
      .filter(({ amount }) => amount > 0n);
  }, [holdingsData]);

  /* ── 4. Batch: project data + AMM pools + token supply + vote state ── */
  const batchContracts = useMemo(() => {
    if (!address || !activeHoldings.length) return [];
    return activeHoldings.flatMap(({ id }) => [
      {
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "projects",
        args: [id],
      } as const,
      {
        address: CONTRACTS.AMM,
        abi: AMM_ABI,
        functionName: "poolUsdc",
        args: [id],
      } as const,
      {
        address: CONTRACTS.AMM,
        abi: AMM_ABI,
        functionName: "poolCommit",
        args: [id],
      } as const,
      {
        address: CONTRACTS.AMM,
        abi: AMM_ABI,
        functionName: "seeded",
        args: [id],
      } as const,
      {
        address: CONTRACTS.COMMIT,
        abi: ERC1155_ABI,
        functionName: "totalSupplyByProject",
        args: [id],
      } as const,
      {
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "hasVoted",
        args: [id, address],
      } as const,
      {
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "hasApproved",
        args: [id, address],
      } as const,
    ]);
  }, [activeHoldings, address]);

  const { data: batchData, refetch: refetchBatch } = useReadContracts({
    contracts: batchContracts,
    query: { enabled: batchContracts.length > 0, refetchInterval: 3000 },
  });

  /* ── 5. Claimable yield (global per user) ── */
  const { data: claimableYieldRaw, refetch: refetchYield } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "pendingYield",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const totalYieldClaimable = claimableYieldRaw
    ? toUSDC(claimableYieldRaw as bigint)
    : 0;

  /* ── 6. Write: claim yield ── */
  const {
    writeContract: writeClaimYield,
    data: claimYieldHash,
    isPending: claimYieldPending,
  } = useWriteContract();

  const { isLoading: claimYieldConfirming, isSuccess: claimYieldSuccess } =
    useWaitForTransactionReceipt({ hash: claimYieldHash });

  /* ── 6b. Write: harvest yield ── */
  const {
    writeContract: writeHarvestYield,
    data: harvestYieldHash,
    isPending: harvestYieldPending,
  } = useWriteContract();

  const { isLoading: harvestYieldConfirming, isSuccess: harvestYieldSuccess } =
    useWaitForTransactionReceipt({ hash: harvestYieldHash });

  /* ── 7. Write: veto ── */
  const {
    writeContract: writeVeto,
    data: vetoHash,
    isPending: vetoPending,
  } = useWriteContract();

  const [votingId, setVotingId] = useState<bigint | null>(null);
  const [approvingId, setApprovingId] = useState<bigint | null>(null);

  const { isLoading: vetoConfirming, isSuccess: vetoSuccess } =
    useWaitForTransactionReceipt({ hash: vetoHash });

  /* ── 7b. Write: approve release (backer early-release vote) ── */
  const {
    writeContract: writeApproveRelease,
    data: approveReleaseHash,
    isPending: approveReleasePending,
  } = useWriteContract();

  const { isLoading: approveReleaseConfirming, isSuccess: approveReleaseSuccess } =
    useWaitForTransactionReceipt({ hash: approveReleaseHash });

  /* ── 8. Write: refund failed project ── */
  const {
    writeContract: writeRefund,
    data: refundHash,
    isPending: refundPending,
  } = useWriteContract();

  const [refundingId, setRefundingId] = useState<bigint | null>(null);

  const { isLoading: refundConfirming, isSuccess: refundSuccess } =
    useWaitForTransactionReceipt({ hash: refundHash });

  /* ── 8b. Write: cancel veto vote ── */
  const {
    writeContract: writeCancelVeto,
    data: cancelVetoHash,
    isPending: cancelVetoPending,
  } = useWriteContract();

  const [cancellingId, setCancellingId] = useState<bigint | null>(null);

  const { isLoading: cancelVetoConfirming, isSuccess: cancelVetoSuccess } =
    useWaitForTransactionReceipt({ hash: cancelVetoHash });

  /* ── 8c. Write: claim timeout refund (dead project) ── */
  const {
    writeContract: writeTimeoutRefund,
    data: timeoutRefundHash,
    isPending: timeoutRefundPending,
  } = useWriteContract();

  const [timeoutRefundingId, setTimeoutRefundingId] = useState<bigint | null>(null);

  const { isLoading: timeoutRefundConfirming, isSuccess: timeoutRefundSuccess } =
    useWaitForTransactionReceipt({ hash: timeoutRefundHash });

  /* ── 8d. Write: claim veto refund (vetoed release) ── */
  const {
    writeContract: writeVetoRefund,
    data: vetoRefundHash,
    isPending: vetoRefundPending,
  } = useWriteContract();

  const [vetoRefundingId, setVetoRefundingId] = useState<bigint | null>(null);

  const { isLoading: vetoRefundConfirming, isSuccess: vetoRefundSuccess } =
    useWaitForTransactionReceipt({ hash: vetoRefundHash });

  /* ── 9. Founder write actions ── */
  const {
    writeContract: writeFounderAction,
    data: founderActionHash,
    isPending: founderActionPending,
  } = useWriteContract();

  const [founderActionId, setFounderActionId] = useState<bigint | null>(null);
  const [founderActionError, setFounderActionError] = useState("");

  const { isLoading: founderActionConfirming, isSuccess: founderActionSuccess } =
    useWaitForTransactionReceipt({ hash: founderActionHash });

  /* ── Refetch on tx success ── */
  useEffect(() => {
    if (claimYieldSuccess) refetchYield();
  }, [claimYieldSuccess, refetchYield]);

  useEffect(() => {
    if (harvestYieldSuccess) {
      refetchYield();
    }
  }, [harvestYieldSuccess, refetchYield]);

  useEffect(() => {
    if (approveReleaseSuccess) {
      refetchHoldings();
      refetchBatch();
      setApprovingId(null);
    }
  }, [approveReleaseSuccess, refetchBatch, refetchHoldings]);

  useEffect(() => {
    if (vetoSuccess) {
      refetchHoldings();
      refetchBatch();
      setVotingId(null);
    }
  }, [vetoSuccess, refetchBatch, refetchHoldings]);

  useEffect(() => {
    if (refundSuccess) {
      refetchHoldings();
      refetchBatch();
      setRefundingId(null);
    }
  }, [refundSuccess, refetchBatch, refetchHoldings]);

  useEffect(() => {
    if (cancelVetoSuccess) {
      refetchHoldings();
      refetchBatch();
      setCancellingId(null);
    }
  }, [cancelVetoSuccess, refetchBatch, refetchHoldings]);

  useEffect(() => {
    if (founderActionSuccess) {
      refetchAllProjects();
      refetchBatch();
      setFounderActionId(null);
      setFounderActionError("");
    }
  }, [founderActionSuccess, refetchAllProjects, refetchBatch]);

  useEffect(() => {
    if (timeoutRefundSuccess) {
      refetchHoldings();
      refetchBatch();
      setTimeoutRefundingId(null);
    }
  }, [timeoutRefundSuccess, refetchBatch, refetchHoldings]);

  useEffect(() => {
    if (vetoRefundSuccess) {
      refetchHoldings();
      refetchBatch();
      setVetoRefundingId(null);
    }
  }, [vetoRefundSuccess, refetchBatch, refetchHoldings]);

  /* ── 9. Derive positions ── */
  const FIELDS = 7; // calls per position in the batch

  const positions: PortfolioPosition[] = useMemo(() => {
    if (!activeHoldings.length || !batchData) return [];

    const raw = activeHoldings
      .map(({ id, amount }, i) => {
        const base = i * FIELDS;

        const projRaw = asReadResult(batchData[base]) as
          | Record<string, unknown>
          | readonly unknown[]
          | undefined;

        if (!projRaw) return null;

        const proj = normalizeProject(projRaw);

        const poolUsdc   = (asReadResult(batchData[base + 1]) ?? 0n) as bigint;
        const poolCommit = (asReadResult(batchData[base + 2]) ?? 0n) as bigint;
        const seeded     = Boolean(asReadResult(batchData[base + 3]) ?? false);
        const totalSupplyRaw = (asReadResult(batchData[base + 4]) ?? 0n) as bigint;
        const voted      = Boolean(asReadResult(batchData[base + 5]) ?? false);
        const approvedRelease = Boolean(asReadResult(batchData[base + 6]) ?? false);

        const tokensHeld   = toUSDC(amount);
        const totalProjectTokens = toUSDC(totalSupplyRaw);
        const entryPrice   = 1.0; // 1 COMMIT = 1 USDC at invest time
        const poolUsdcNum = toUSDC(poolUsdc);
        const poolCommitNum = toUSDC(poolCommit);
        const currentPrice =
          seeded && poolCommitNum > 0
            ? poolUsdcNum / poolCommitNum
            : 1.0;
        const marketValue = tokensHeld * currentPrice;

        const now   = Math.floor(Date.now() / 1000);
        const relAt = Number(proj.releaseRequestedAt);
        const vetoOpen =
          relAt > 0 && !proj.releaseVetoed && now < relAt + VETO_WINDOW_SECS;

        const numId = Number(id);
        const left = daysLeft(proj.fundingDeadline);
        const raised = toUSDC(proj.totalRaised);
        const goal = toUSDC(proj.fundingGoal);
        return {
          id,
          name:                proj.name || `Project #${numId}`,
          symbol:              `P${numId}`,
          tokensHeld,
          entryPrice,
          currentPrice,
          marketValue,
          allocationPct:      0, // filled below
          totalProjectTokens,
          projectSharePct:
            totalProjectTokens > 0
              ? Math.min(100, (tokensHeld / totalProjectTokens) * 100)
              : 0,
          raised,
          goal,
          milestones:          Number(proj.milestoneCount),
          milestonesCompleted: proj.currentMilestone >= proj.milestoneCount
            ? Number(proj.milestoneCount)
            : Math.max(0, Number(proj.currentMilestone) - 1),
          daysLeft:            left,
          fundingDeadline:     proj.fundingDeadline,
          refundable:          left === 0 && goal > 0 && raised < goal,
          vetoOpen,
          hasVoted:            voted,
          hasApproved:         approvedRelease,
          releaseApproved:     proj.releaseApproved,
          metadataUri:         proj.metadataUri,
          yieldClaimable:      0, // filled below
          milestoneDeadline:   proj.milestoneDeadline,
          milestoneWindow:     Number(proj.milestoneWindow),
          timeoutActive:       proj.timeoutActive,
          timeoutOpenedAt:     Number(proj.timeoutOpenedAt),
          projectDead:         proj.projectDead,
          releaseVetoed:       proj.releaseVetoed,
        } satisfies PortfolioPosition;
      })
      .filter(Boolean) as PortfolioPosition[];

    // Allocate portfolio and yield proportionally by the same normalized market value.
    const totalValue = raw.reduce((s, p) => s + p.marketValue, 0);
    return raw.map((p) => ({
      ...p,
      allocationPct: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0,
      yieldClaimable:
        totalValue > 0
          ? (p.marketValue / totalValue) * totalYieldClaimable
          : 0,
    }));
  }, [activeHoldings, batchData, totalYieldClaimable]);

  /* ── Public actions ── */
  function claimYield() {
    writeClaimYield({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "claimYield",
    });
  }

  function harvestYield() {
    writeHarvestYield({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "harvestYield",
    });
  }

  function castVeto(projectId: bigint) {
    setVotingId(projectId);
    writeVeto({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "veto",
      args: [projectId],
    });
  }

  function approveRelease(projectId: bigint) {
    setApprovingId(projectId);
    writeApproveRelease({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "approveRelease",
      args: [projectId],
    });
  }

  function cancelVeto(projectId: bigint) {
    setCancellingId(projectId);
    writeCancelVeto({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "cancelVeto",
      args: [projectId],
    });
  }

  function refund(projectId: bigint) {
    setRefundingId(projectId);
    writeRefund({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "refund",
      args: [projectId],
    });
  }

  async function runFounderAction(functionName: "claimInitialMilestoneRelease" | "verifyNextMilestone" | "requestRelease" | "executeRelease" | "clearVeto", projectId: bigint) {
    setFounderActionId(projectId);
    setFounderActionError("");

    try {
      if (publicClient && address) {
        await publicClient.simulateContract({
          account: address,
          address: CONTRACTS.VAULT,
          abi: VAULT_ABI,
          functionName,
          args: [projectId],
        });
      }

      writeFounderAction(
        {
          address: CONTRACTS.VAULT,
          abi: VAULT_ABI,
          functionName,
          args: [projectId],
        },
        {
          onError: (error) => {
            setFounderActionError(friendlyFounderActionError(error));
            setFounderActionId(null);
          },
        },
      );
    } catch (error) {
      setFounderActionError(friendlyFounderActionError(error));
      setFounderActionId(null);
    }
  }

  function claimInitialMilestoneRelease(projectId: bigint) {
    void runFounderAction("claimInitialMilestoneRelease", projectId);
  }

  function verifyNextMilestone(projectId: bigint) {
    void runFounderAction("verifyNextMilestone", projectId);
  }

  function requestRelease(projectId: bigint) {
    void runFounderAction("requestRelease", projectId);
  }

  function executeRelease(projectId: bigint) {
    void runFounderAction("executeRelease", projectId);
  }

  function clearVeto(projectId: bigint) {
    void runFounderAction("clearVeto", projectId);
  }

  function claimTimeoutRefund(projectId: bigint) {
    setTimeoutRefundingId(projectId);
    writeTimeoutRefund({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "claimTimeoutRefund",
      args: [projectId],
    });
  }

  function claimVetoRefund(projectId: bigint) {
    setVetoRefundingId(projectId);
    writeVetoRefund({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "claimVetoRefund",
      args: [projectId],
    });
  }

  function refetch() {
    refetchHoldings();
    refetchBatch();
    refetchYield();
    refetchAllProjects();
    fundingNotificationsQuery.refetch();
  }

  return {
    positions,
    myProjects,
    fundingNotifications: fundingNotificationsQuery.data ?? [],
    totalYieldClaimable,
    isLoading:
      enabled && !!projectCount && activeHoldings.length > 0 && !batchData,
    myProjectsLoading:
      enabled && !!projectCount && allProjectContracts.length > 0 && !allProjectsData,
    fundingNotificationsLoading: fundingNotificationsQuery.isLoading,
    claimYieldLoading:   claimYieldPending || claimYieldConfirming,
    harvestYieldLoading: harvestYieldPending || harvestYieldConfirming,
    vetoLoading:         vetoPending || vetoConfirming,
    approveReleaseLoading: approveReleasePending || approveReleaseConfirming,
    cancelVetoLoading:   cancelVetoPending || cancelVetoConfirming,
    refundLoading:       refundPending || refundConfirming,
    founderActionLoading: founderActionPending || founderActionConfirming,
    founderActionError,
    timeoutRefundLoading: timeoutRefundPending || timeoutRefundConfirming,
    vetoRefundLoading: vetoRefundPending || vetoRefundConfirming,
    votingId,
    approvingId,
    cancellingId,
    refundingId,
    timeoutRefundingId,
    vetoRefundingId,
    founderActionId,
    claimYield,
    harvestYield,
    castVeto,
    approveRelease,
    cancelVeto,
    refund,
    claimTimeoutRefund,
    claimVetoRefund,
    claimInitialMilestoneRelease,
    verifyNextMilestone,
    requestRelease,
    executeRelease,
    clearVeto,
    refetch,
  };
}
