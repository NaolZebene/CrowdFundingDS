import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { VAULT_ABI } from "@/config/abis";

const USDC_DEC = 6;
const toUSDC = (v: bigint) => Number(formatUnits(v, USDC_DEC));

export interface MarketProject {
  id: number;
  name: string;
  description: string;
  additionalFilesUrl: string;
  offchainMetadataUri: string;
  founder: string;
  milestoneCount: number;
  totalRaised: number;
  currentMilestone: number;
  metadataUri: string;
  fundingGoal: number;
  fundingDeadline: bigint;
  approved: boolean;
  daysLeft: number;
}

function daysLeft(deadline: bigint): number {
  const secs = Number(deadline) - Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil(secs / 86400));
}

export function useMarketsData() {
  /* ── project count & TVL ── */
  const { data: projectCountRaw } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "projectCount",
    query: { refetchInterval: 5000 },
  });

  const { data: tvlRaw, refetch: refetchTvl } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalRaised",
    query: { refetchInterval: 5000 },
  });

  const count = projectCountRaw ? Number(projectCountRaw) : 0;

  /* ── batch read all projects ── */
  const projectCalls = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        address: CONTRACTS.VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "projects" as const,
        args: [BigInt(i + 1)] as [bigint],
      })),
    [count],
  );

  const { data: projectsRaw, refetch: refetchProjects } = useReadContracts({
    contracts: projectCalls,
    query: { enabled: count > 0, refetchInterval: 5000 },
  });

  /* ── parse projects ── */
  const projects: MarketProject[] = useMemo(() => {
    if (!projectsRaw) return [];
    return projectsRaw
      .map((res, i) => {
        if (res.status !== "success") return null;
        const r = res.result as readonly [
          string, string, bigint, bigint, bigint,
          bigint, bigint, boolean, string, bigint, bigint, boolean,
          string, string, string,
        ];
        return {
          id:               i + 1,
          name:             r[12] || `Project #${i + 1}`,
          description:      r[13] || "No description provided.",
          additionalFilesUrl: r[14] || "",
          offchainMetadataUri: r[8] || "",
          founder:          r[0],
          milestoneCount:   Number(r[2]),
          totalRaised:      toUSDC(r[3]),
          currentMilestone: Number(r[5]),
          metadataUri:      r[8],
          fundingGoal:      toUSDC(r[9]),
          fundingDeadline:  r[10],
          approved:         r[11],
          daysLeft:         daysLeft(r[10]),
        } satisfies MarketProject;
      })
      .filter(Boolean) as MarketProject[];
  }, [projectsRaw]);

  return {
    projects,
    tvl: tvlRaw ? toUSDC(tvlRaw as bigint) : 0,
    isLoading: count > 0 && !projectsRaw,
    refetch: () => {
      void refetchProjects();
      void refetchTvl();
    },
  };
}
