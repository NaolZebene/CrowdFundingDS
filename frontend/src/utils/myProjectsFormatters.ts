export const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

export function fmtPct(value: number) {
  if (value === 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function progressStyle(value: number) {
  return {
    width: `${Math.min(100, Math.max(0, value))}%`,
    minWidth: value > 0 ? "2px" : undefined,
  };
}

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function fmtTimeLeft(deadline: bigint): string {
  if (deadline === 0n) return "Open-ended";
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  const secsLeft = deadlineNum - now;
  if (secsLeft <= 0) return "Expired";
  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return `${mins}m left`;
}
