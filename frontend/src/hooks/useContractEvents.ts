import { useWatchContractEvent } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI, AMM_ABI } from "@/config/abis";
import { recordLiveActivity } from "@/lib/liveActivity";

const fmtUSD = (raw: bigint) =>
  `$${Number(formatUnits(raw, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const POLL_MS = 30_000;

type Args = Record<string, unknown>;
type EventLog = { transactionHash?: string; logIndex?: number };
type Handler = (args: Args, log: EventLog) => void;
const activityId = (name: string, log: EventLog) =>
  `${log.transactionHash ?? "pending"}-${log.logIndex ?? 0}-${name}`;

const vaultHandlers: Record<string, Handler> = {
  Invested: ({ projectId, investor, amount }, log) => {
    if (!projectId || !amount) return;
    recordLiveActivity({
      id: activityId("invest", log),
      type: "invest",
      projectId: Number(projectId),
      user: String(investor ?? ""),
      amountUsdc: Number(formatUnits(amount as bigint, 6)),
      amountCommit: Number(formatUnits(amount as bigint, 6)),
      price: 1,
      timestamp: Date.now(),
      txHash: log.transactionHash ?? "",
    });
    toast.success(`New investment on Project #${projectId}`, {
      description: `${short(String(investor ?? ""))} backed ${fmtUSD(amount as bigint)}`,
    });
  },
  ProjectApproved: ({ projectId }) => {
    if (!projectId) return;
    toast.success(`Project #${projectId} approved`, {
      description: "Funding is now open for backers.",
    });
  },
  ReleaseRequested: ({ projectId, milestone }) => {
    if (!projectId) return;
    toast.warning(`Release requested — Project #${projectId}`, {
      description: `Milestone ${milestone} · 3-day veto window is open.`,
    });
  },
  FundsReleased: ({ projectId, milestone, amount }) => {
    if (!projectId || !amount) return;
    toast.success(`Funds released — Project #${projectId}`, {
      description: `Milestone ${milestone} · ${fmtUSD(amount as bigint)} sent to treasury.`,
    });
  },
  VetoedEvent: ({ projectId, by }) => {
    if (!projectId) return;
    toast.error(`Veto cast on Project #${projectId}`, {
      description: `By ${short(String(by ?? ""))}`,
    });
  },
  YieldClaimed: ({ user, amount }, log) => {
    if (!amount) return;
    recordLiveActivity({
      id: activityId("yield", log),
      type: "yield",
      user: String(user ?? ""),
      amountUsdc: Number(formatUnits(amount as bigint, 6)),
      amountCommit: 0,
      price: 0,
      timestamp: Date.now(),
      txHash: log.transactionHash ?? "",
    });
    toast.success(`Yield claimed`, {
      description: `${short(String(user ?? ""))} claimed ${fmtUSD(amount as bigint)}`,
    });
  },
  MilestoneTimeoutOpened: ({ projectId }) => {
    if (!projectId) return;
    toast.warning(`Milestone timeout opened — Project #${projectId}`, {
      description: "3-day governance vote is now open. Vote to extend or refund.",
    });
  },
  TimeoutVoteCast: ({ projectId, voter, extend, stake }) => {
    if (!projectId) return;
    toast(`Timeout vote cast — Project #${projectId}`, {
      description: `${short(String(voter ?? ""))} voted ${extend ? "Extend" : "Refund"} with ${stake ? fmtUSD(stake as bigint) : "?"} tokens`,
    });
  },
  TimeoutResolved: ({ projectId, extended }) => {
    if (!projectId) return;
    extended
      ? toast.success(`Deadline extended — Project #${projectId}`, { description: "Governance voted to give the founder more time." })
      : toast.error(`Project killed — Project #${projectId}`, { description: "Governance voted to refund backers. Claim your pro-rata share." });
  },
  AmmSeeded: ({ projectId, usdcIn }) => {
    if (!projectId || !usdcIn) return;
    toast.success(`AMM pool seeded — Project #${projectId}`, {
      description: `${fmtUSD(usdcIn as bigint)} liquidity added. Trading is now live.`,
    });
  },
};

const ammHandlers: Record<string, Handler> = {
  Swap: ({ projectId, user, amountIn, amountOut, tokenIn }, log) => {
    if (!projectId || !amountIn || !amountOut) return;
    const isBuy = String(tokenIn ?? "").toLowerCase() !== CONTRACTS.COMMIT.toLowerCase();
    const usdcAmount = Number(formatUnits((isBuy ? amountIn : amountOut) as bigint, 6));
    const commitAmount = Number(formatUnits((isBuy ? amountOut : amountIn) as bigint, 6));
    recordLiveActivity({
      id: activityId(isBuy ? "buy" : "sell", log),
      type: isBuy ? "buy" : "sell",
      projectId: Number(projectId),
      user: String(user ?? ""),
      amountUsdc: usdcAmount,
      amountCommit: commitAmount,
      price: commitAmount > 0 ? usdcAmount / commitAmount : 0,
      timestamp: Date.now(),
      txHash: log.transactionHash ?? "",
    });
    toast(isBuy ? `Buy — Project #${projectId}` : `Sell — Project #${projectId}`, {
      description: isBuy
        ? `${short(String(user ?? ""))} bought ${fmtUSD(amountOut as bigint)} tokens for ${fmtUSD(amountIn as bigint)}`
        : `${short(String(user ?? ""))} sold ${fmtUSD(amountIn as bigint)} tokens for ${fmtUSD(amountOut as bigint)}`,
    });
  },
};

export function useContractEvents() {
  useWatchContractEvent({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    poll: true,
    pollingInterval: POLL_MS,
    onLogs(logs) {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName ?? "";
        vaultHandlers[name]?.(log.args as Args, log as EventLog);
      }
    },
  });

  useWatchContractEvent({
    address: CONTRACTS.AMM,
    abi: AMM_ABI,
    poll: true,
    pollingInterval: POLL_MS,
    onLogs(logs) {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName ?? "";
        ammHandlers[name]?.(log.args as Args, log as EventLog);
      }
    },
  });
}
