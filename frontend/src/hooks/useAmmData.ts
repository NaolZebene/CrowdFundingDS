import { useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { AMM_ABI, ERC20_ABI, ERC1155_ABI, VAULT_ABI } from "@/config/abis";

/* ─── constants ─── */
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS  = 50; // 0.5%

/* ─── helpers ─── */
const toNum = (v: bigint | undefined, dec = USDC_DECIMALS) =>
  v ? Number(formatUnits(v, dec)) : 0;

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
  symbol: string;
  poolUsdc: number;
  poolCommit: number;
  price: number;
  seeded: boolean;
}

export function useAmmData(
  selectedProjectId: number,
  direction: "buy" | "sell",
  inputVal: string,
) {
  const { address, isConnected } = useAccount();

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

  const { data: poolData } = useReadContracts({
    contracts: poolCalls,
    query: { enabled: count > 0 },
  });

  /* ── fee ── */
  const { data: feeBpsRaw } = useReadContract({
    address: CONTRACTS.AMM as `0x${string}`,
    abi: AMM_ABI,
    functionName: "feeBps",
  });
  const feeBps = feeBpsRaw ? Number(feeBpsRaw) : 30;

  /* ── build seeded pools list ── */
  const pools: AmmPool[] = useMemo(() => {
    if (!poolData) return [];
    return Array.from({ length: count }, (_, i) => {
      const base      = i * 3;
      const pUsdc     = poolData[base]?.result     as bigint | undefined;
      const pCommit   = poolData[base + 1]?.result as bigint | undefined;
      const isSeeded  = poolData[base + 2]?.result as boolean | undefined;
      const usdcNum   = toNum(pUsdc);
      const commitNum = toNum(pCommit);
      return {
        id:         i + 1,
        symbol:     `NST-${i + 1}`,
        poolUsdc:   usdcNum,
        poolCommit: commitNum,
        price:      commitNum > 0 ? usdcNum / commitNum : 0,
        seeded:     isSeeded ?? false,
      };
    }).filter((p) => p.seeded);
  }, [poolData, count]);

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
  const { data: usdcAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.AMM as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: isCommitApproved } = useReadContract({
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

  /* ── swap handler ── */
  function swap() {
    if (!pool || inputNum <= 0) return;

    const amountIn  = parseUnits(inputVal, USDC_DECIMALS);
    const minOut    = parseUnits(minReceived.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const projectId = BigInt(pool.id);

    if (direction === "buy") {
      if (!usdcAllowance || (usdcAllowance as bigint) < amountIn) {
        writeContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACTS.AMM as `0x${string}`, amountIn],
        });
        return;
      }
      writeContract({
        address: CONTRACTS.AMM as `0x${string}`,
        abi: AMM_ABI,
        functionName: "swapUsdcForCommit",
        args: [projectId, amountIn, minOut],
      });
    } else {
      if (!isCommitApproved) {
        writeContract({
          address: CONTRACTS.COMMIT,
          abi: ERC1155_ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACTS.AMM as `0x${string}`, true],
        });
        return;
      }
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
    direction === "sell" && !isCommitApproved;

  return {
    /* data */
    pools,
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
    isConnected,
    /* approval helpers */
    needsUsdcApproval,
    needsCommitApproval,
    /* action */
    swap,
  };
}
