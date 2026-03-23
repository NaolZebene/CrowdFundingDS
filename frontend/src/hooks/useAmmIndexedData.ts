import { gql, useQuery } from "@apollo/client";

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
  side: "BUY" | "SELL";
  user: string;
  usdcAmount: number;
  commitAmount: number;
  price: number;
  timestamp: number;
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
      where: { projectId: $projectId, periodStartUnix_gte: $hourFrom }
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
      where: { projectId: $projectId, periodStartUnix_gte: $dayFrom }
    ) {
      periodStartUnix
      open
      high
      low
      close
      volumeUsdc
      txCount
    }
    swaps(
      first: 20
      orderBy: timestamp
      orderDirection: desc
      where: { projectId: $projectId }
    ) {
      id
      side
      user
      amountIn
      amountOut
      priceUsdcPerCommit
      timestamp
    }
  }
`;

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useAmmIndexedData(projectId: number, range: ChartRange) {
  const now = Math.floor(Date.now() / 1000);
  const hourFrom = now - 7 * 24 * 3600;
  const dayFrom = now - 30 * 24 * 3600;

  const { data, loading, error, refetch } = useQuery(POOL_INDEXED_QUERY, {
    variables: {
      projectId: String(projectId),
      hourFrom,
      dayFrom,
      hourFirst: 24 * 7,
      dayFirst: 30,
    },
    skip: projectId <= 0,
    pollInterval: 30_000,
  });

  const hourData = (data?.poolHourDatas ?? []) as Array<{
    periodStartUnix: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volumeUsdc: string;
  }>;

  const dayData = (data?.poolDayDatas ?? []) as Array<{
    periodStartUnix: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volumeUsdc: string;
  }>;

  const chartPoints: AmmChartPoint[] = (() => {
    if (range === "1W") {
      return dayData.slice(-7).map((d) => ({
        ts: d.periodStartUnix * 1000,
        open: toNum(d.open),
        high: toNum(d.high),
        low: toNum(d.low),
        close: toNum(d.close),
        volumeUsdc: toNum(d.volumeUsdc),
      }));
    }

    const hours = range === "1H" ? 1 : range === "6H" ? 6 : 24;
    return hourData.slice(-hours).map((d) => ({
      ts: d.periodStartUnix * 1000,
      open: toNum(d.open),
      high: toNum(d.high),
      low: toNum(d.low),
      close: toNum(d.close),
      volumeUsdc: toNum(d.volumeUsdc),
    }));
  })();

  const recentTrades: AmmTradeItem[] = ((data?.swaps ?? []) as Array<{
    id: string;
    side: "BUY" | "SELL";
    user: string;
    amountIn: string;
    amountOut: string;
    priceUsdcPerCommit: string;
    timestamp: string;
  }>).map((s) => {
    const isBuy = s.side === "BUY";
    const amountIn = toNum(s.amountIn) / 1e6;
    const amountOut = toNum(s.amountOut) / 1e6;
    return {
      id: s.id,
      side: s.side,
      user: s.user,
      usdcAmount: isBuy ? amountIn : amountOut,
      commitAmount: isBuy ? amountOut : amountIn,
      price: toNum(s.priceUsdcPerCommit),
      timestamp: toNum(s.timestamp) * 1000,
    };
  });

  return {
    chartPoints,
    recentTrades,
    loading,
    error,
    refetch,
  };
}
