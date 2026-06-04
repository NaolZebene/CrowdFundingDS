export const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

export const fmtToken = (n: number) =>
  n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(2);

export const fmtTime = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
  " · " +
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export const fmtTimeLeft = (deadline: bigint): string => {
  if (deadline === 0n) return "Open-ended";
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  const secsLeft = deadlineNum - now;
  if (secsLeft <= 0) return "Expired";
  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
};
