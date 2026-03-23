import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useAccount } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { CONTRACTS } from "@/config/contracts";
import type { TxRecord } from "@/store/slices/portfolioSlice";

const USDC_DEC = 6;
const toUSDC = (v: bigint) => Number(formatUnits(v, USDC_DEC));
const INVESTED_EVENT = parseAbiItem(
  "event Invested(uint256 indexed projectId, address indexed investor, uint256 amount)"
);
const YIELD_CLAIMED_EVENT = parseAbiItem(
  "event YieldClaimed(address indexed user, uint256 amount)"
);
const SWAP_EVENT = parseAbiItem(
  "event Swap(uint256 indexed projectId, address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)"
);

/**
 * Fetches on-chain transaction history for the connected wallet by reading
 * Invested / YieldClaimed events from the Vault and Swap events from the AMM.
 *
 * Results are sorted newest-first and returned as TxRecord[] so Portfolio.tsx
 * can render them without knowing anything about event logs.
 */
export function useTransactionHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["tx-history", address, CONTRACTS.VAULT, CONTRACTS.AMM],
    staleTime: 30_000,
    queryFn: async (): Promise<TxRecord[]> => {
      if (!address || !publicClient) return [];

      /* ── fetch event logs in parallel ── */
      const [investedLogs, yieldLogs, swapLogs] = await Promise.all([
        publicClient.getLogs({
          address: CONTRACTS.VAULT,
          event: INVESTED_EVENT,
          args: { investor: address },
          fromBlock: 0n,
        }),
        publicClient.getLogs({
          address: CONTRACTS.VAULT,
          event: YIELD_CLAIMED_EVENT,
          args: { user: address },
          fromBlock: 0n,
        }),
        publicClient.getLogs({
          address: CONTRACTS.AMM,
          event: SWAP_EVENT,
          args: { user: address },
          fromBlock: 0n,
        }),
      ]);

      /* ── collect unique block numbers for timestamp lookup ── */
      const allLogs = [...investedLogs, ...yieldLogs, ...swapLogs];
      const uniqueBlocks = [
        ...new Set(
          allLogs
            .map((l) => l.blockNumber)
            .filter((b): b is bigint => b !== null),
        ),
      ];

      const blockTimestamps = new Map<bigint, number>();
      await Promise.all(
        uniqueBlocks.map(async (blockNum) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: blockNum });
            blockTimestamps.set(blockNum, Number(block.timestamp) * 1000);
          } catch {
            blockTimestamps.set(blockNum, Date.now());
          }
        }),
      );

      const ts = (blockNum: bigint | null) =>
        blockNum ? (blockTimestamps.get(blockNum) ?? Date.now()) : Date.now();

      /* ── build records ── */
      type Stamped = TxRecord & { _blockNum: bigint };
      const records: Stamped[] = [];

      /* direct invest() calls */
      for (const log of investedLogs) {
        const args = log.args as { projectId?: bigint; investor?: `0x${string}`; amount?: bigint };
        if (!args.projectId || !args.amount) continue;
        const numId = Number(args.projectId);
        const amt   = toUSDC(args.amount);
        records.push({
          type:    "invest",
          project: `Project #${numId}`,
          symbol:  `P${numId}`,
          amount:  amt,
          tokens:  amt,   // 1 COMMIT minted per 1 USDC
          price:   1.0,
          date:    new Date(ts(log.blockNumber)).toISOString(),
          _blockNum: log.blockNumber ?? 0n,
        });
      }

      /* yield claims */
      for (const log of yieldLogs) {
        const args = log.args as { user?: `0x${string}`; amount?: bigint };
        if (!args.amount) continue;
        records.push({
          type:    "yield",
          project: "All Positions",
          symbol:  "USDC",
          amount:  toUSDC(args.amount),
          tokens:  0,
          price:   0,
          date:    new Date(ts(log.blockNumber)).toISOString(),
          _blockNum: log.blockNumber ?? 0n,
        });
      }

      /* AMM swaps */
      for (const log of swapLogs) {
        const args = log.args as {
          projectId?: bigint;
          user?: `0x${string}`;
          tokenIn?: `0x${string}`;
          amountIn?: bigint;
          tokenOut?: `0x${string}`;
          amountOut?: bigint;
        };
        if (!args.projectId || !args.tokenIn || !args.amountIn || !args.amountOut) continue;

        const numId  = Number(args.projectId);
        const isSell = args.tokenIn.toLowerCase() === CONTRACTS.COMMIT.toLowerCase();
        const amtIn  = toUSDC(args.amountIn);
        const amtOut = toUSDC(args.amountOut);

        records.push({
          type:    isSell ? "sell" : "invest",
          project: `Project #${numId}`,
          symbol:  `P${numId}`,
          // "sell": user gave COMMIT (amtIn) and got USDC (amtOut)
          // "buy via AMM": user gave USDC (amtIn) and got COMMIT (amtOut)
          amount:  isSell ? amtOut : amtIn,
          tokens:  isSell ? amtIn  : amtOut,
          price:   isSell
            ? (amtIn  > 0 ? amtOut / amtIn  : 0)   // USDC per COMMIT sold
            : (amtOut > 0 ? amtIn  / amtOut : 0),   // USDC per COMMIT bought
          date:    new Date(ts(log.blockNumber)).toISOString(),
          _blockNum: log.blockNumber ?? 0n,
        });
      }

      /* sort newest first, strip internal field */
      records.sort((a, b) => Number(b._blockNum) - Number(a._blockNum));
      return records.map(({ _blockNum: _, ...r }) => r);
    },
    enabled: !!address && !!publicClient,
  });

  return {
    history:   query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
