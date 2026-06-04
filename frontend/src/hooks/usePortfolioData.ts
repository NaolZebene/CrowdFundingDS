import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "@apollo/client";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI, AMM_ABI, ERC1155_ABI } from "@/config/abis";
import { apolloClient, SUBGRAPH_URL } from "@/lib/apollo";
import { useContractAction } from "@/hooks/useContractAction";

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

type ReadEntry = { status: string; result?: unknown } | undefined;
const ok = <T>(entry: ReadEntry): T | undefined =>
  entry?.status === "success" ? (entry.result as T) : undefined;

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
  iconUrl: string;
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
  iconUrl: string;
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

type ProjectTuple = readonly [
  /*0  founder*/            string,  /*1  treasury*/           string,
  /*2  milestoneCount*/     bigint,  /*3  totalRaised*/        bigint,
  /*4  totalReleased*/      bigint,  /*5  currentMilestone*/   bigint,
  /*6  releaseRequestedAt*/ bigint,  /*7  releaseVetoed*/      boolean,
  /*8  metadataUri*/        string,  /*9  fundingGoal*/        bigint,
  /*10 fundingDeadline*/    bigint,  /*11 approved*/           boolean,
  /*12 name*/               string,  /*13 description*/        string,
  /*14 additionalFilesUrl*/ string,  /*15 iconUrl*/            string,
  /*16 totalAmmSeeded*/     bigint,  /*17 milestoneWindow*/    bigint,
  /*18 milestoneDeadline*/  bigint,  /*19 timeoutActive*/      boolean,
  /*20 timeoutOpenedAt*/    bigint,  /*21 projectDead*/        boolean,
  /*22 releaseApproved*/    boolean,
];

function normalizeProject(r: ProjectTuple) {
  return {
    founder:            r[0],
    treasury:           r[1],
    milestoneCount:     r[2],
    totalRaised:        r[3],
    totalReleased:      r[4],
    currentMilestone:   r[5],
    releaseRequestedAt: r[6],
    releaseVetoed:      r[7],
    metadataUri:        r[8],
    fundingGoal:        r[9],
    fundingDeadline:    r[10],
    approved:           r[11],
    name:               r[12],
    description:        r[13],
    additionalFilesUrl: r[14],
    iconUrl:            r[15],
    totalAmmSeeded:     r[16],
    milestoneWindow:    r[17],
    milestoneDeadline:  r[18],
    timeoutActive:      r[19],
    timeoutOpenedAt:    r[20],
    projectDead:        r[21],
    releaseApproved:    r[22],
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
        const raw = ok<ProjectTuple>(entry as ReadEntry);
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
          iconUrl: project.iconUrl,
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
        amount: ok<bigint>(entry as ReadEntry) ?? 0n,
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

  /* ── tracking ids for in-flight txs ── */
  const [votingId,          setVotingId]          = useState<bigint | null>(null);
  const [approvingId,       setApprovingId]        = useState<bigint | null>(null);
  const [refundingId,       setRefundingId]        = useState<bigint | null>(null);
  const [cancellingId,      setCancellingId]       = useState<bigint | null>(null);
  const [timeoutRefundingId,setTimeoutRefundingId] = useState<bigint | null>(null);
  const [vetoRefundingId,   setVetoRefundingId]    = useState<bigint | null>(null);
  const [founderActionId,   setFounderActionId]    = useState<bigint | null>(null);
  const [founderActionError,setFounderActionError] = useState("");

  const refetchPositions = () => { refetchHoldings(); refetchBatch(); };

  /* ── 6. Write actions ── */
  const claimYieldAction    = useContractAction(() => refetchYield());
  const vetoAction          = useContractAction(() => { refetchPositions(); setVotingId(null); });
  const approveReleaseAction= useContractAction(() => { refetchPositions(); setApprovingId(null); });
  const refundAction        = useContractAction(() => { refetchPositions(); setRefundingId(null); });
  const cancelVetoAction    = useContractAction(() => { refetchPositions(); setCancellingId(null); });
  const timeoutRefundAction = useContractAction(() => { refetchPositions(); setTimeoutRefundingId(null); });
  const vetoRefundAction    = useContractAction(() => { refetchPositions(); setVetoRefundingId(null); });
  const founderAction       = useContractAction(() => { refetchAllProjects(); refetchBatch(); setFounderActionId(null); setFounderActionError(""); });

  /* ── 9. Derive positions ── */
  const FIELDS = 7; // calls per position in the batch

  const positions: PortfolioPosition[] = useMemo(() => {
    if (!activeHoldings.length || !batchData) return [];

    const raw = activeHoldings
      .map(({ id, amount }, i) => {
        const base = i * FIELDS;

        const projTuple = ok<ProjectTuple>(batchData[base] as ReadEntry);
        if (!projTuple) return null;
        const proj = normalizeProject(projTuple);

        const poolUsdc        = ok<bigint>(batchData[base + 1] as ReadEntry) ?? 0n;
        const poolCommit      = ok<bigint>(batchData[base + 2] as ReadEntry) ?? 0n;
        const seeded          = ok<boolean>(batchData[base + 3] as ReadEntry) ?? false;
        const totalSupplyRaw  = ok<bigint>(batchData[base + 4] as ReadEntry) ?? 0n;
        const voted           = ok<boolean>(batchData[base + 5] as ReadEntry) ?? false;
        const approvedRelease = ok<boolean>(batchData[base + 6] as ReadEntry) ?? false;

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
          iconUrl:             proj.iconUrl,
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
  type VaultFn = Parameters<typeof claimYieldAction.write>[0] & {
    address: `0x${string}`;
    functionName: string;
  };
  const vaultCall = (functionName: string, args?: readonly unknown[]): VaultFn =>
    ({ address: CONTRACTS.VAULT as `0x${string}`, abi: VAULT_ABI, functionName, ...(args && { args }) }) as VaultFn;

  const claimYield   = () => claimYieldAction.write(vaultCall("claimYield"));

  function castVeto(projectId: bigint) {
    setVotingId(projectId);
    vetoAction.write(vaultCall("veto", [projectId]));
  }
  function approveRelease(projectId: bigint) {
    setApprovingId(projectId);
    approveReleaseAction.write(vaultCall("approveRelease", [projectId]));
  }
  function cancelVeto(projectId: bigint) {
    setCancellingId(projectId);
    cancelVetoAction.write(vaultCall("cancelVeto", [projectId]));
  }
  function refund(projectId: bigint) {
    setRefundingId(projectId);
    refundAction.write(vaultCall("refund", [projectId]));
  }
  function claimTimeoutRefund(projectId: bigint) {
    setTimeoutRefundingId(projectId);
    timeoutRefundAction.write(vaultCall("claimTimeoutRefund", [projectId]));
  }
  function claimVetoRefund(projectId: bigint) {
    setVetoRefundingId(projectId);
    vetoRefundAction.write(vaultCall("claimVetoRefund", [projectId]));
  }

  type FounderFn = "claimInitialMilestoneRelease" | "verifyNextMilestone" | "requestRelease" | "executeRelease" | "clearVeto";

  async function runFounderAction(functionName: FounderFn, projectId: bigint) {
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
      founderAction.write(vaultCall(functionName, [projectId]), {
        onError: (error: Error) => {
          setFounderActionError(friendlyFounderActionError(error));
          setFounderActionId(null);
        },
      });
    } catch (error: unknown) {
      setFounderActionError(friendlyFounderActionError(error));
      setFounderActionId(null);
    }
  }

  const claimInitialMilestoneRelease = (id: bigint) => void runFounderAction("claimInitialMilestoneRelease", id);
  const verifyNextMilestone  = (id: bigint) => void runFounderAction("verifyNextMilestone", id);
  const requestRelease       = (id: bigint) => void runFounderAction("requestRelease", id);
  const executeRelease       = (id: bigint) => void runFounderAction("executeRelease", id);
  const clearVeto            = (id: bigint) => void runFounderAction("clearVeto", id);

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
    claimYieldLoading:    claimYieldAction.isLoading,
    vetoLoading:          vetoAction.isLoading,
    approveReleaseLoading:approveReleaseAction.isLoading,
    cancelVetoLoading:    cancelVetoAction.isLoading,
    refundLoading:        refundAction.isLoading,
    founderActionLoading: founderAction.isLoading,
    founderActionError,
    timeoutRefundLoading: timeoutRefundAction.isLoading,
    vetoRefundLoading:    vetoRefundAction.isLoading,
    votingId,
    approvingId,
    cancellingId,
    refundingId,
    timeoutRefundingId,
    vetoRefundingId,
    founderActionId,
    claimYield,
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
