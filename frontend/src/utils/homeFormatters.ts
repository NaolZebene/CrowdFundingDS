export const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

export const fmtUSDFull = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function fmtPct(value: number) {
  if (value === 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function pct(raised: number, goal: number) {
  return goal > 0 ? (raised / goal) * 100 : 0;
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

export function fmtDateFromUnix(ts: bigint) {
  if (ts === 0n) return "No deadline";
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

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

export function friendlyTxError(error?: Error | string | null) {
  if (!error) return "";
  const message = typeof error === "string" ? error : error.message;
  if (message.includes("ProjectNotApproved"))
    return "This project is still pending approval.";
  if (message.includes("DeadlinePassed"))
    return "This project's funding deadline has passed.";
  if (message.includes("ZeroAmount"))
    return "Enter an amount greater than 0 USDC.";
  if (message.includes("TransferFailed"))
    return "USDC transfer failed. Check your balance and vault allowance.";
  if (message.toLowerCase().includes("insufficient funds"))
    return "Your wallet does not have enough Sepolia ETH for gas.";
  if (message.toLowerCase().includes("user rejected"))
    return "Transaction rejected in wallet.";
  if (message.toLowerCase().includes("allowance"))
    return "USDC allowance is too low. Approve the vault first.";
  if (message.toLowerCase().includes("balance"))
    return "Amount exceeds your Sepolia USDC balance.";
  return message;
}

// Fallback images when iconUrl is not available
const PROJECT_IMAGES = [
  "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1488229297570-58520851e868?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop",
];

export function getProjectImage(project: { id: number; iconUrl?: string }) {
  // Use iconUrl if available, otherwise fall back to static images based on id
  return project.iconUrl && project.iconUrl.trim()
    ? project.iconUrl
    : PROJECT_IMAGES[(project.id - 1) % PROJECT_IMAGES.length];
}

export const SORT_OPTIONS = ["Most Funded", "Ending Soon", "Most Milestones"];
export const CATEGORIES = ["All", "Trending", "Closing Soon", "New"];
export const USDC_DECIMALS = 6;
