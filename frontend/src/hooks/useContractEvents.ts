import { useWatchContractEvent } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI, AMM_ABI } from "@/config/abis";

const fmtUSD = (raw: bigint) =>
  `$${Number(formatUnits(raw, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const POLL_MS = 30_000;

export function useContractEvents() {
  /* ── Vault: all events in one watcher ── */
  useWatchContractEvent({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    poll: true,
    pollingInterval: POLL_MS,
    onLogs(logs) {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName;
        const args = log.args as Record<string, unknown>;

        if (name === "Invested") {
          const { projectId, investor, amount } = args as { projectId?: bigint; investor?: string; amount?: bigint };
          if (!projectId || !amount) continue;
          toast.success(`New investment on Project #${projectId}`, {
            description: `${short(investor ?? "")} backed ${fmtUSD(amount)}`,
          });
        } else if (name === "ProjectApproved") {
          const { projectId } = args as { projectId?: bigint };
          if (!projectId) continue;
          toast.success(`Project #${projectId} approved`, {
            description: "Funding is now open for backers.",
          });
        } else if (name === "ReleaseRequested") {
          const { projectId, milestone } = args as { projectId?: bigint; milestone?: bigint };
          if (!projectId) continue;
          toast.warning(`Release requested — Project #${projectId}`, {
            description: `Milestone ${milestone} · 3-day veto window is open.`,
          });
        } else if (name === "FundsReleased") {
          const { projectId, milestone, amount } = args as { projectId?: bigint; milestone?: bigint; amount?: bigint };
          if (!projectId || !amount) continue;
          toast.success(`Funds released — Project #${projectId}`, {
            description: `Milestone ${milestone} · ${fmtUSD(amount)} sent to treasury.`,
          });
        } else if (name === "VetoedEvent") {
          const { projectId, by } = args as { projectId?: bigint; by?: string };
          if (!projectId) continue;
          toast.error(`Veto cast on Project #${projectId}`, {
            description: `By ${short(by ?? "")}`,
          });
        } else if (name === "YieldClaimed") {
          const { user, amount } = args as { user?: string; amount?: bigint };
          if (!amount) continue;
          toast.success(`Yield claimed`, {
            description: `${short(user ?? "")} claimed ${fmtUSD(amount)}`,
          });
        } else if (name === "MilestoneTimeoutOpened") {
          const { projectId } = args as { projectId?: bigint };
          if (!projectId) continue;
          toast.warning(`Milestone timeout opened — Project #${projectId}`, {
            description: "3-day governance vote is now open. Vote to extend or refund.",
          });
        } else if (name === "TimeoutVoteCast") {
          const { projectId, voter, extend, stake } = args as { projectId?: bigint; voter?: string; extend?: boolean; stake?: bigint };
          if (!projectId) continue;
          toast(`Timeout vote cast — Project #${projectId}`, {
            description: `${short(voter ?? "")} voted ${extend ? "Extend" : "Refund"} with ${stake ? fmtUSD(stake) : "?"} tokens`,
          });
        } else if (name === "TimeoutResolved") {
          const { projectId, extended } = args as { projectId?: bigint; extended?: boolean };
          if (!projectId) continue;
          if (extended) {
            toast.success(`Deadline extended — Project #${projectId}`, {
              description: "Governance voted to give the founder more time.",
            });
          } else {
            toast.error(`Project killed — Project #${projectId}`, {
              description: "Governance voted to refund backers. Claim your pro-rata share.",
            });
          }
        } else if (name === "AmmSeeded") {
          const { projectId, usdcIn } = args as { projectId?: bigint; usdcIn?: bigint };
          if (!projectId || !usdcIn) continue;
          toast.success(`AMM pool seeded — Project #${projectId}`, {
            description: `${fmtUSD(usdcIn)} liquidity added. Trading is now live.`,
          });
        }
      }
    },
  });

  /* ── AMM: all events in one watcher ── */
  useWatchContractEvent({
    address: CONTRACTS.AMM,
    abi: AMM_ABI,
    poll: true,
    pollingInterval: POLL_MS,
    onLogs(logs) {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName;
        const args = log.args as Record<string, unknown>;

        if (name === "Swap") {
          const { projectId, user, amountIn, amountOut, tokenIn } = args as {
            projectId?: bigint;
            user?: string;
            tokenIn?: string;
            amountIn?: bigint;
            amountOut?: bigint;
          };
          if (!projectId || !amountIn || !amountOut) continue;
          const isBuy = tokenIn?.toLowerCase() !== CONTRACTS.COMMIT.toLowerCase();
          toast(isBuy ? `Buy — Project #${projectId}` : `Sell — Project #${projectId}`, {
            description: isBuy
              ? `${short(user ?? "")} bought ${fmtUSD(amountOut)} tokens for ${fmtUSD(amountIn)}`
              : `${short(user ?? "")} sold ${fmtUSD(amountIn)} tokens for ${fmtUSD(amountOut)}`,
          });
        }
      }
    },
  });
}
