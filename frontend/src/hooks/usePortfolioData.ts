import { useState, useMemo, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI, AMM_ABI, ERC1155_ABI } from "@/config/abis";

/* ─── constants ─── */
const USDC_DEC = 6;
const VETO_WINDOW_SECS = 3 * 24 * 60 * 60; // 3 days

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
  raised: number;
  goal: number;
  milestones: number;
  milestonesCompleted: number;
  daysLeft: number;
  vetoOpen: boolean;
  hasVoted: boolean;
  metadataUri: string;
  /** Proportional share of total claimable yield */
  yieldClaimable: number;
}

interface NormalizedProject {
  milestoneCount: bigint;
  totalRaised: bigint;
  currentMilestone: bigint;
  releaseRequestedAt: bigint;
  releaseVetoed: boolean;
  metadataUri: string;
  fundingGoal: bigint;
  fundingDeadline: bigint;
}

export function usePortfolioData() {
  const { address } = useAccount();
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
    query: { enabled: holdingContracts.length > 0 },
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

  /* ── 4. Batch: project data + AMM pools + hasVoted (5 calls per position) ── */
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
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "hasVoted",
        args: [id, address],
      } as const,
    ]);
  }, [activeHoldings, address]);

  const { data: batchData, refetch: refetchBatch } = useReadContracts({
    contracts: batchContracts,
    query: { enabled: batchContracts.length > 0 },
  });

  /* ── 5. Claimable yield (global per user) ── */
  const { data: claimableYieldRaw, refetch: refetchYield } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "claimableYield",
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

  /* ── 7. Write: veto ── */
  const {
    writeContract: writeVeto,
    data: vetoHash,
    isPending: vetoPending,
  } = useWriteContract();

  const [votingId, setVotingId] = useState<bigint | null>(null);

  const { isLoading: vetoConfirming, isSuccess: vetoSuccess } =
    useWaitForTransactionReceipt({ hash: vetoHash });

  /* ── Refetch on tx success ── */
  useEffect(() => {
    if (claimYieldSuccess) refetchYield();
  }, [claimYieldSuccess, refetchYield]);

  useEffect(() => {
    if (vetoSuccess) {
      refetchBatch();
      setVotingId(null);
    }
  }, [vetoSuccess, refetchBatch]);

  /* ── 8. Derive positions ── */
  const FIELDS = 5; // calls per position in the batch

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

        // Support both named-object and tuple-shaped return values from readContracts.
        let proj: NormalizedProject;
        if (Array.isArray(projRaw)) {
          proj = {
            milestoneCount: (projRaw[2] ?? 0n) as bigint,
            totalRaised: (projRaw[3] ?? 0n) as bigint,
            currentMilestone: (projRaw[5] ?? 0n) as bigint,
            releaseRequestedAt: (projRaw[6] ?? 0n) as bigint,
            releaseVetoed: Boolean(projRaw[7]),
            metadataUri: String(projRaw[8] ?? ""),
            fundingGoal: (projRaw[9] ?? 0n) as bigint,
            fundingDeadline: (projRaw[10] ?? 0n) as bigint,
          };
        } else {
          const projObj = projRaw as Record<string, unknown>;
          proj = {
            milestoneCount: (projObj.milestoneCount ?? 0n) as bigint,
            totalRaised: (projObj.totalRaised ?? 0n) as bigint,
            currentMilestone: (projObj.currentMilestone ?? 0n) as bigint,
            releaseRequestedAt: (projObj.releaseRequestedAt ?? 0n) as bigint,
            releaseVetoed: Boolean(projObj.releaseVetoed ?? false),
            metadataUri: String(projObj.metadataUri ?? ""),
            fundingGoal: (projObj.fundingGoal ?? 0n) as bigint,
            fundingDeadline: (projObj.fundingDeadline ?? 0n) as bigint,
          };
        }

        const poolUsdc   = (asReadResult(batchData[base + 1]) ?? 0n) as bigint;
        const poolCommit = (asReadResult(batchData[base + 2]) ?? 0n) as bigint;
        const seeded     = Boolean(asReadResult(batchData[base + 3]) ?? false);
        const voted      = Boolean(asReadResult(batchData[base + 4]) ?? false);

        const tokensHeld   = toUSDC(amount);
        const entryPrice   = 1.0; // 1 COMMIT = 1 USDC at invest time
        const currentPrice =
          seeded && poolCommit > 0n
            ? Number(poolUsdc) / Number(poolCommit)
            : 1.0;

        const now   = Math.floor(Date.now() / 1000);
        const relAt = Number(proj.releaseRequestedAt);
        const vetoOpen =
          relAt > 0 && !proj.releaseVetoed && now < relAt + VETO_WINDOW_SECS;

        const numId = Number(id);
        return {
          id,
          name:                `Project #${numId}`,
          symbol:              `P${numId}`,
          tokensHeld,
          entryPrice,
          currentPrice,
          raised:              toUSDC(proj.totalRaised),
          goal:                toUSDC(proj.fundingGoal),
          milestones:          Number(proj.milestoneCount),
          milestonesCompleted: Number(proj.currentMilestone),
          daysLeft:            daysLeft(proj.fundingDeadline),
          vetoOpen,
          hasVoted:            voted,
          metadataUri:         proj.metadataUri,
          yieldClaimable:      0, // filled below
        } satisfies PortfolioPosition;
      })
      .filter(Boolean) as PortfolioPosition[];

    // Distribute global yield proportionally by position value
    const totalValue = raw.reduce(
      (s, p) => s + p.tokensHeld * p.currentPrice,
      0,
    );
    return raw.map((p) => ({
      ...p,
      yieldClaimable:
        totalValue > 0
          ? ((p.tokensHeld * p.currentPrice) / totalValue) * totalYieldClaimable
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

  function castVeto(projectId: bigint) {
    setVotingId(projectId);
    writeVeto({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "veto",
      args: [projectId],
    });
  }

  function refetch() {
    refetchHoldings();
    refetchBatch();
    refetchYield();
  }

  return {
    positions,
    totalYieldClaimable,
    isLoading:
      enabled && !!projectCount && activeHoldings.length > 0 && !batchData,
    claimYieldLoading: claimYieldPending || claimYieldConfirming,
    vetoLoading:       vetoPending || vetoConfirming,
    votingId,
    claimYield,
    castVeto,
    refetch,
  };
}
