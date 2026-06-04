import type { AmmPool } from "@/hooks/useAmmData";

export const SLIPPAGE_BPS = 50;

export const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

export const fmtToken = (n: number) =>
  n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(4);

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const marketProgress = (pool: AmmPool) =>
  pool.fundingGoal > 0
    ? Math.min(100, (pool.totalRaised / pool.fundingGoal) * 100)
    : 0;

export const fmtPct = (n: number) =>
  `${n.toFixed(n >= 10 ? 0 : 1)}%`;

export const fmtSignedPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(Math.abs(n) >= 10 ? 1 : 2)}%`;

export const currentPriceLabel = (pool?: AmmPool) =>
  pool && pool.price > 0
    ? `1 ${pool.symbol} = ${fmtUSD(pool.price)} USDC`
    : "Price not available";

export const reservePriceLabel = (pool: AmmPool) =>
  pool.poolUsdc > 0 && pool.poolCommit > 0
    ? `${fmtUSD(pool.poolUsdc)} USDC / ${fmtToken(pool.poolCommit)} ${pool.symbol}`
    : "Pool reserves are not available yet";
