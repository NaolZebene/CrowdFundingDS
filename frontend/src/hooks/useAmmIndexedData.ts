import { useEffect, useRef, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { getLiveActivity, LIVE_ACTIVITY_EVENT } from "@/lib/liveActivity";

export type ChartRange = "1H" | "6H" | "1D" | "1W";

export interface AmmChartPoint {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsdc: number;
}

export interface AmmTradeItem {
  id: string;
  side: "BUY" | "SELL" | "SEED";
  user: string;
  usdcAmount: number;
  commitAmount: number;
  price: number;
  reserveUsdcAfter: number;
  reserveCommitAfter: number;
  timestamp: number;
  txHash: string;
}

const POOL_INDEXED_QUERY = gql`
  query PoolIndexedData(
    $projectId: BigInt!
    $hourFrom: Int!
    $dayFrom: Int!
    $hourFirst: Int!
    $dayFirst: Int!
  ) {
    poolHourDatas(
      first: $hourFirst
      orderBy: periodStartUnix
      orderDirection: asc
      where: { projectId: $projectId, periodStartUnix_gte: $hourFrom, txCount_gt: "0" }
    ) {
      periodStartUnix
      open
      high
      low
      close
      volumeUsdc
      txCount
    }
    poolDayDatas(
      first: $dayFirst
      orderBy: periodStartUnix
      orderDirection: asc
      where: { projectId: $projectId, periodStartUnix_gte: $dayFrom, txCount_gt: "0" }
    ) {
      periodStartUnix
      open
      high
      low
      close
      volumeUsdc
      txCount
    }
    ammTransactions(
      first: 50
      orderBy: timestamp
      orderDirection: desc
      where: { projectId: $projectId }
    ) {
      id
      txHash
      kind
      user
      amountUsdc
      amountCommit
      priceUsdcPerCommit
      reserveUsdcAfter
      reserveCommitAfter
      timestamp
    }
  }
`;

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fallbackCandlesFromTrades(trades: AmmTradeItem[], range: ChartRange): AmmChartPoint[] {
  const bucketMs =
    range === "1H" ? 60 * 60 * 1000 :
    range === "6H" ? 6 * 60 * 60 * 1000 :
    range === "1D" ? 24 * 60 * 60 * 1000 :
    24 * 60 * 60 * 1000;

  const buckets = new Map<number, AmmChartPoint>();
  const ordered = [...trades]
    .filter((t) => (t.side === "BUY" || t.side === "SELL") && t.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const trade of ordered) {
    const bucket = Math.floor(trade.timestamp / bucketMs) * bucketMs;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        ts: bucket,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volumeUsdc: trade.usdcAmount,
      });
      continue;
    }

    existing.high = Math.max(existing.high, trade.price);
    existing.low = Math.min(existing.low, trade.price);
    existing.close = trade.price;
    existing.volumeUsdc += trade.usdcAmount;
  }

  return [...buckets.values()].sort((a, b) => a.ts - b.ts);
}

export function useAmmIndexedData(projectId: number, range: ChartRange) {
  const [liveVersion, setLiveVersion] = useState(0);
  const now = Math.floor(Date.now() / 1000);
  const hourFrom = now - 30 * 24 * 3600; // fetch 30 days of hourly data
  const dayFrom  = now - 90 * 24 * 3600; // fetch 90 days of daily data

  const stableChartPoints = useRef<AmmChartPoint[]>([]);
  const stableRecentTrades = useRef<AmmTradeItem[]>([]);
  const lastProjectId = useRef<number>(-1);
  if (lastProjectId.current !== projectId) {
    lastProjectId.current = projectId;
    stableChartPoints.current = [];
    stableRecentTrades.current = [];
  }

  const { data, loading, error, refetch } = useQuery(POOL_INDEXED_QUERY, {
    variables: {
      projectId: String(projectId),
      hourFrom,
      dayFrom,
      hourFirst: 24 * 30,  // up to 720 hourly candles
      dayFirst: 90,          // up to 90 daily candles
    },
    skip: projectId <= 0,
    pollInterval: 5_000,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: false,
  });

  type CandleRow = {
    periodStartUnix: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volumeUsdc: string;
    txCount: string;
  };

  const hourData = ((data?.poolHourDatas ?? []) as CandleRow[]).filter(
    (d) => Number(d.txCount) > 0,
  );

  const dayData = ((data?.poolDayDatas ?? []) as CandleRow[]).filter(
    (d) => Number(d.txCount) > 0,
  );

  const toCandle = (d: CandleRow): AmmChartPoint => ({
    ts: d.periodStartUnix * 1000,
    open:       toNum(d.open),
    high:       toNum(d.high),
    low:        toNum(d.low),
    close:      toNum(d.close),
    volumeUsdc: toNum(d.volumeUsdc),
  });

  const indexedTrades: AmmTradeItem[] = ((data?.ammTransactions ?? []) as Array<{
    id: string;
    txHash: string;
    kind: "BUY" | "SELL" | "SEED";
    user: string;
    amountUsdc: string;
    amountCommit: string;
    priceUsdcPerCommit: string;
    reserveUsdcAfter: string;
    reserveCommitAfter: string;
    timestamp: string;
  }>).map((s) => {
    return {
      id: s.id,
      side: s.kind,
      user: s.user,
      usdcAmount: toNum(s.amountUsdc) / 1e6,
      commitAmount: toNum(s.amountCommit) / 1e6,
      price: toNum(s.priceUsdcPerCommit),
      reserveUsdcAfter: toNum(s.reserveUsdcAfter) / 1e6,
      reserveCommitAfter: toNum(s.reserveCommitAfter) / 1e6,
      timestamp: toNum(s.timestamp) * 1000,
      txHash: s.txHash,
    };
  });
  const liveTrades: AmmTradeItem[] = getLiveActivity()
    .filter((item) => item.projectId === projectId && (item.type === "buy" || item.type === "sell"))
    .map((item) => ({
      id: item.id,
      side: item.type === "buy" ? "BUY" : "SELL",
      user: item.user,
      usdcAmount: item.amountUsdc,
      commitAmount: item.amountCommit,
      price: item.price,
      reserveUsdcAfter: 0,
      reserveCommitAfter: 0,
      timestamp: item.timestamp,
      txHash: item.txHash,
    }));
  const recentTrades = [...liveTrades, ...indexedTrades]
    .filter((trade, index, all) => all.findIndex((other) => other.id === trade.id) === index)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  useEffect(() => {
    const handleActivity = () => {
      setLiveVersion((version) => version + 1);
      void refetch();
    };
    window.addEventListener(LIVE_ACTIVITY_EVENT, handleActivity);
    return () => window.removeEventListener(LIVE_ACTIVITY_EVENT, handleActivity);
  }, [refetch]);

  const freshChartPoints: AmmChartPoint[] = (() => {
    if (range === "1W") return dayData.map(toCandle);

    const cutoffHours = range === "1H" ? 24 : range === "6H" ? 72 : 24 * 7;
    const cutoff = now - cutoffHours * 3600;
    return hourData.filter((d) => d.periodStartUnix >= cutoff).map(toCandle);
  })();
  const fallbackChartPoints = fallbackCandlesFromTrades(recentTrades, range);
  const chartPoints = freshChartPoints.length > 0 ? freshChartPoints : fallbackChartPoints;

  if (chartPoints.length > 0) stableChartPoints.current = chartPoints;
  if (recentTrades.length > 0) stableRecentTrades.current = recentTrades;

  return {
    chartPoints: stableChartPoints.current,
    recentTrades: stableRecentTrades.current,
    loading,
    error,
    refetch,
    liveVersion,
  };
}
