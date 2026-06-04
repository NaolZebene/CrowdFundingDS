import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { gql, useQuery } from "@apollo/client";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { AMM_ABI, ERC20_ABI, ERC1155_ABI, VAULT_ABI } from "@/config/abis";

/* ─── constants ─── */
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS  = 50; // 0.5%

const INDEXED_POOLS_QUERY = gql`
  query IndexedAmmPools {
    pools(first: 100, orderBy: updatedAt, orderDirection: desc, where: { seeded: true }) {
      id
      projectId
      reserveUsdc
      reserveCommit
      lastPrice
      volumeUsdc
      volumeCommit
      swapCount
      updatedAt
    }
  }
`;

/* ─── helpers ─── */
const toNum = (v: bigint | undefined, dec = USDC_DECIMALS) =>
  v ? Number(formatUnits(v, dec)) : 0;

const toIndexedToken = (value: string | number | null | undefined) => {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n / 1e6 : 0;
};

const toIndexedNumber = (value: string | number | null | undefined) => {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function calcSwapOut(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  feeBps: number,
): number {
  if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
  const inAfterFee = amountIn * (1 - feeBps / 10_000);
  return (inAfterFee * reserveOut) / (reserveIn + inAfterFee);
}

/* ─── exported types ─── */
export interface AmmPool {
  id: number;
  name: string;
  description: string;
  symbol: string;
  poolUsdc: number;
  poolCommit: number;
  price: number;
  seeded: boolean;
  totalRaised: number;
  fundingGoal: number;
  fundingDeadline: bigint;
  fundingClosed: boolean;
  goalMet: boolean;
  indexed: boolean;
  volumeUsdc: number;
  volumeCommit: number;
  swapCount: number;
  lastTradePrice: number;
  indexedUpdatedAt: number;
  tradable: boolean;
  blockReason: string;
}

interface IndexedPoolResult {
  id: string;
  projectId: string;
  reserveUsdc: string;
  reserveCommit: string;
  lastPrice: string;
  volumeUsdc: string;
  volumeCommit: string;
  swapCount: string;
  updatedAt: string;
}

export function useAmmData(
  selectedProjectId: number,
  direction: "buy" | "sell",
  inputVal: string,
) {
  const { address, isConnected } = useAccount();
  const [lastAction, setLastAction] = useState<"approve-usdc" | "approve-commit" | "swap" | null>(null);
  const {
    data: indexedPoolsData,
    error: indexedPoolsError,
    loading: indexedPoolsLoading,
    refetch: refetchIndexedPools,
  } = useQuery(INDEXED_POOLS_QUERY, {
    pollInterval: 30_000,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: false,
  });

  const indexedPoolById = useMemo(() => {
    const map = new Map<number, IndexedPoolResult>();
    const indexedPools = (indexedPoolsData?.pools ?? []) as IndexedPoolResult[];
    for (const pool of indexedPools) {
      const projectId = Number(pool.projectId);
      if (Number.isFinite(projectId)) map.set(projectId, pool);
    }
    return map;
  }, [indexedPoolsData]);

  /* ── project count ── */
  const { data: projectCountRaw } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "projectCount",
  });
  const count = projectCountRaw ? Number(projectCountRaw) : 0;

  /* ── batch read pool data for all projects ── */
  const poolCalls = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const pid = BigInt(i + 1);
        return [
          {
            address: CONTRACTS.AMM as `0x${string}`,
            abi: AMM_ABI,
            functionName: "poolUsdc" as const,
            args: [pid],
          },
          {
            address: CONTRACTS.AMM as `0x${string}`,
            abi: AMM_ABI,
            functionName: "poolCommit" as const,
            args: [pid],
          },
          {
            address: CONTRACTS.AMM as `0x${string}`,
            abi: AMM_ABI,
            functionName: "seeded" as const,
            args: [pid],
          },
        ];
      }).flat(),
    [count],
  );

  const { data: poolData, refetch: refetchPoolData } = useReadContracts({
    contracts: poolCalls,
    query: { enabled: count > 0, refetchInterval: 30_000, placeholderData: keepPreviousData },
  });

  const projectCalls = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        address: CONTRACTS.VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "projects" as const,
        args: [BigInt(i + 1)] as [bigint],
      })),
    [count],
  );

  const { data: projectData, refetch: refetchProjectData } = useReadContracts({
    contracts: projectCalls,
    query: { enabled: count > 0, refetchInterval: 30_000, placeholderData: keepPreviousData },
  });

  /* ── fee ── */
  const { data: feeBpsRaw } = useReadContract({
    address: CONTRACTS.AMM as `0x${string}`,
    abi: AMM_ABI,
    functionName: "feeBps",
  });
  const feeBps = feeBpsRaw ? Number(feeBpsRaw) : 30;

  /* ── build pool list ── */
  const allPools: AmmPool[] = useMemo(() => {
    if (!poolData || !projectData) return [];
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: count }, (_, i) => {
      const base      = i * 3;
      const pUsdc     = poolData[base]?.result     as bigint | undefined;
      const pCommit   = poolData[base + 1]?.result as bigint | undefined;
      const isSeeded  = poolData[base + 2]?.result as boolean | undefined;
      const projectRes = projectData[i];
      const usdcNum   = toNum(pUsdc);
      const commitNum = toNum(pCommit);
      let totalRaised = 0;
      let fundingGoal = 0;
      let fundingDeadline = 0n;
      let name = `Project #${i + 1}`;
      let description = "";

      if (projectRes?.status === "success") {
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
        const project = projectRes.result as ProjectTuple;
        totalRaised = toNum(project[3]);
        fundingGoal = toNum(project[9]);
        fundingDeadline = project[10];
        name = project[12] || name;
        description = project[13] || "";
      }

      const goalMet = fundingGoal > 0 && totalRaised >= fundingGoal;
      const fundingClosed = fundingDeadline > 0n && Number(fundingDeadline) <= now;
      const indexed = indexedPoolById.get(i + 1);
      const indexedReserveUsdc = toIndexedToken(indexed?.reserveUsdc);
      const indexedReserveCommit = toIndexedToken(indexed?.reserveCommit);
      const marketUsdc = usdcNum > 0 ? usdcNum : indexedReserveUsdc;
      const marketCommit = commitNum > 0 ? commitNum : indexedReserveCommit;
      const spotPrice = marketCommit > 0 ? marketUsdc / marketCommit : 0;
      const seeded = (isSeeded ?? false) || !!indexed;
      const hasLiquidity = marketUsdc > 0 && marketCommit > 0;
      const tradable = seeded && hasLiquidity && fundingClosed && goalMet;
      const blockReason = !seeded
        ? "Needs AMM liquidity"
        : !hasLiquidity
        ? "Pool has no reserves"
        : !goalMet
        ? "Funding goal not met"
        : !fundingClosed
        ? "Funding still open"
        : "Tradable";

      return {
        id:         i + 1,
        name,
        description,
        symbol:     `P${i + 1}`,
        poolUsdc:   marketUsdc,
        poolCommit: marketCommit,
        price:      spotPrice,
        seeded,
        totalRaised,
        fundingGoal,
        fundingDeadline,
        fundingClosed,
        goalMet,
        indexed: !!indexed,
        volumeUsdc: toIndexedNumber(indexed?.volumeUsdc),
        volumeCommit: toIndexedNumber(indexed?.volumeCommit),
        swapCount: toIndexedNumber(indexed?.swapCount),
        lastTradePrice: toIndexedNumber(indexed?.lastPrice),
        indexedUpdatedAt: toIndexedNumber(indexed?.updatedAt) * 1000,
        tradable,
        blockReason,
      };
    });
  }, [poolData, projectData, count, indexedPoolById]);

  const pools = useMemo(
    () => allPools.filter((p) => p.goalMet && p.fundingClosed), // Show funded & closed projects (including pending seed)
    [allPools],
  );
  const poolCandidates = useMemo(
    () => allPools.filter((p) => p.seeded || p.goalMet || p.fundingClosed),
    [allPools],
  );
  const pool = pools.find((p) => p.id === selectedProjectId) ?? pools[0];

  /* ── user balances ── */
  const { data: usdcBalanceRaw } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: commitBalanceRaw } = useReadContract({
    address: CONTRACTS.COMMIT,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address && pool ? [address, BigInt(pool.id)] : undefined,
    query: { enabled: !!address && !!pool },
  });

  /* ── allowances ── */
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.AMM as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: isCommitApproved, refetch: refetchCommitApproval } = useReadContract({
    address: CONTRACTS.COMMIT,
    abi: ERC1155_ABI,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACTS.AMM as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  /* ── swap math ── */
  const inputNum   = parseFloat(inputVal) || 0;
  const reserveIn  = pool ? (direction === "buy" ? pool.poolUsdc   : pool.poolCommit) : 0;
  const reserveOut = pool ? (direction === "buy" ? pool.poolCommit : pool.poolUsdc)   : 0;
  const outputNum  = calcSwapOut(inputNum, reserveIn, reserveOut, feeBps);
  const minReceived = outputNum * (1 - SLIPPAGE_BPS / 10_000);
  const impact      = inputNum > 0 ? (inputNum / (reserveIn + inputNum)) * 100 : 0;

  const usdcBal   = toNum(usdcBalanceRaw as bigint | undefined);
  const commitBal = toNum(commitBalanceRaw as bigint | undefined);

  /* ── write ── */
  const {
    writeContract,
    data: writeTxHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isTxPending, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: writeTxHash });

  useEffect(() => {
    if (!isTxSuccess) return;
    if (lastAction === "approve-usdc") void refetchUsdcAllowance();
    if (lastAction === "approve-commit") void refetchCommitApproval();
    void refetchPoolData();
    void refetchProjectData();
    window.setTimeout(() => {
      if (lastAction === "approve-usdc") void refetchUsdcAllowance();
      if (lastAction === "approve-commit") void refetchCommitApproval();
      void refetchIndexedPools();
    }, 3_000);
  }, [
    isTxSuccess,
    lastAction,
    refetchCommitApproval,
    refetchIndexedPools,
    refetchPoolData,
    refetchProjectData,
    refetchUsdcAllowance,
  ]);

  /* ── swap handler ── */
  function swap() {
    if (!pool || inputNum <= 0) return;
    if (direction === "buy" && inputNum > usdcBal) return;
    if (direction === "sell" && inputNum > commitBal) return;

    const amountIn  = parseUnits(inputVal, USDC_DECIMALS);
    const minOut    = parseUnits(minReceived.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const projectId = BigInt(pool.id);

    if (direction === "buy") {
      if (!usdcAllowance || (usdcAllowance as bigint) < amountIn) {
        setLastAction("approve-usdc");
        writeContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACTS.AMM as `0x${string}`, maxUint256],
        });
        return;
      }
      setLastAction("swap");
      writeContract({
        address: CONTRACTS.AMM as `0x${string}`,
        abi: AMM_ABI,
        functionName: "swapUsdcForCommit",
        args: [projectId, amountIn, minOut],
      });
    } else {
      if (!isCommitApproved) {
        setLastAction("approve-commit");
        writeContract({
          address: CONTRACTS.COMMIT,
          abi: ERC1155_ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACTS.AMM as `0x${string}`, true],
        });
        return;
      }
      setLastAction("swap");
      writeContract({
        address: CONTRACTS.AMM as `0x${string}`,
        abi: AMM_ABI,
        functionName: "swapCommitForUsdc",
        args: [projectId, amountIn, minOut],
      });
    }
  }

  /* ── approval status helpers ── */
  const needsUsdcApproval =
    direction === "buy" &&
    inputNum > 0 &&
    (!usdcAllowance ||
      (usdcAllowance as bigint) <
        parseUnits(inputVal || "0", USDC_DECIMALS));

  const needsCommitApproval =
    direction === "sell" && inputNum > 0 && !isCommitApproved;

  const hasEnoughInputBalance =
    inputNum <= 0 ? true : direction === "buy" ? inputNum <= usdcBal : inputNum <= commitBal;
  const canSellSelectedPool = direction !== "sell" || commitBal > 0;

  return {
    /* data */
    pools,
    poolCandidates,
    projectCount: count,
    pool,
    feeBps,
    usdcBal,
    commitBal,
    outputNum,
    minReceived,
    impact,
    /* write state */
    isWriting,
    isTxPending,
    isTxSuccess,
    writeError,
    indexedPoolsLoading,
    indexedPoolsError,
    isConnected,
    lastAction,
    /* approval helpers */
    needsUsdcApproval,
    needsCommitApproval,
    hasEnoughInputBalance,
    canSellSelectedPool,
    /* action */
    swap,
  };
}
