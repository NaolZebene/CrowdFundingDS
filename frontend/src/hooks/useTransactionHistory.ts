import { gql, useQuery } from "@apollo/client";
import { useAccount } from "wagmi";
import { SUBGRAPH_URL } from "@/lib/apollo";
import type { TxRecord } from "@/store/slices/portfolioSlice";

const PORTFOLIO_HISTORY_QUERY = gql`
  query PortfolioHistory($user: Bytes!) {
    investments(
      first: 100
      orderBy: timestamp
      orderDirection: desc
      where: { investor: $user }
    ) {
      id
      projectId
      amount
      timestamp
      project {
        name
      }
    }
    yieldClaims(
      first: 100
      orderBy: timestamp
      orderDirection: desc
      where: { user: $user }
    ) {
      id
      amount
      timestamp
    }
    ammTransactions(
      first: 100
      orderBy: timestamp
      orderDirection: desc
      where: { user: $user }
    ) {
      id
      kind
      projectId
      amountUsdc
      amountCommit
      priceUsdcPerCommit
      timestamp
      project {
        name
      }
    }
  }
`;

const USDC_DECIMALS = 6;
const COMMIT_DECIMALS = 6;
const SUBGRAPH_CONFIGURED = !SUBGRAPH_URL.includes("PLACEHOLDER");

function toAmount(value: string | number | null | undefined, decimals: number): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n / 10 ** decimals : 0;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDate(timestamp: string | number | null | undefined): string {
  return new Date(toNumber(timestamp) * 1000).toISOString();
}

type PortfolioHistoryData = {
  investments?: Array<{
    id: string;
    projectId: string;
    amount: string;
    timestamp: string;
    project?: { name?: string | null } | null;
  }>;
  yieldClaims?: Array<{
    id: string;
    amount: string;
    timestamp: string;
  }>;
  ammTransactions?: Array<{
    id: string;
    kind: string;
    projectId: string;
    amountUsdc: string;
    amountCommit: string;
    priceUsdcPerCommit: string;
    timestamp: string;
    project?: { name?: string | null } | null;
  }>;
};

/**
 * Reads Portfolio history from the subgraph instead of browser-side eth_getLogs.
 * This keeps the Portfolio page light on Sepolia RPC providers.
 */
export function useTransactionHistory() {
  const { address } = useAccount();

  const query = useQuery<PortfolioHistoryData>(PORTFOLIO_HISTORY_QUERY, {
    variables: { user: address?.toLowerCase() ?? "0x0000000000000000000000000000000000000000" },
    skip: !address || !SUBGRAPH_CONFIGURED,
    pollInterval: 30_000,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  });

  const history: TxRecord[] = (() => {
    const data = query.data;
    if (!data) return [];

    const records: TxRecord[] = [];

    for (const inv of data.investments ?? []) {
      const projectId = Number(inv.projectId);
      const amount = toAmount(inv.amount, USDC_DECIMALS);
      records.push({
        type: "invest",
        project: inv.project?.name || `Project #${projectId}`,
        symbol: `P${projectId}`,
        amount,
        tokens: amount,
        price: 1,
        date: toDate(inv.timestamp),
      });
    }

    for (const claim of data.yieldClaims ?? []) {
      records.push({
        type: "yield",
        project: "All Positions",
        symbol: "USDC",
        amount: toAmount(claim.amount, USDC_DECIMALS),
        tokens: 0,
        price: 0,
        date: toDate(claim.timestamp),
      });
    }

    for (const tx of data.ammTransactions ?? []) {
      if (tx.kind !== "BUY" && tx.kind !== "SELL") continue;
      const projectId = Number(tx.projectId);
      records.push({
        type: tx.kind === "SELL" ? "sell" : "invest",
        project: tx.project?.name || `Project #${projectId}`,
        symbol: `P${projectId}`,
        amount: toAmount(tx.amountUsdc, USDC_DECIMALS),
        tokens: toAmount(tx.amountCommit, COMMIT_DECIMALS),
        price: toNumber(tx.priceUsdcPerCommit),
        date: toDate(tx.timestamp),
      });
    }

    return records.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  })();

  return {
    history,
    isLoading: SUBGRAPH_CONFIGURED && query.loading,
    isError: SUBGRAPH_CONFIGURED && !!query.error,
    refetch: query.refetch,
  };
}
