export type LiveActivityType = "invest" | "yield" | "buy" | "sell";

export interface LiveActivity {
  id: string;
  type: LiveActivityType;
  projectId?: number;
  user: string;
  amountUsdc: number;
  amountCommit: number;
  price: number;
  timestamp: number;
  txHash: string;
}

const STORAGE_KEY = "raise:live-activity";
export const LIVE_ACTIVITY_EVENT = "raise:live-activity";

export function getLiveActivity(): LiveActivity[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as LiveActivity[];
  } catch {
    return [];
  }
}

export function recordLiveActivity(activity: LiveActivity) {
  if (typeof window === "undefined") return;
  const current = getLiveActivity();
  const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 200);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(LIVE_ACTIVITY_EVENT, { detail: activity }));
}
