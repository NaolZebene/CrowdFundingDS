import type { AmmPool } from "@/hooks/useAmmData";

interface MarketStatusProps {
  pool: AmmPool;
}

export function MarketStatus({ pool }: MarketStatusProps) {
  const tone = pool.tradable
    ? "bg-green-500/10 border-green-500/30 text-green-400"
    : pool.blockReason === "Needs AMM liquidity" ||
        pool.blockReason === "Pool has no reserves"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : "bg-blue-500/10 border-blue-500/30 text-blue-400";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          pool.tradable ? "bg-green-400 animate-pulse" : "bg-yellow-400"
        }`}
      />
      <span className="truncate">
        {pool.tradable ? "Live" : pool.blockReason}
      </span>
    </span>
  );
}
