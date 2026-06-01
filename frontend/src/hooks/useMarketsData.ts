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
  totalReleased: number;
  currentMilestone: number;
  metadataUri: string;
  fundingGoal: number;
  fundingDeadline: bigint;
  approved: boolean;
  daysLeft: number;
  isExpired: boolean;
  goalMet: boolean;
  fundingClosed: boolean;
  milestoneWindow: number;
  milestoneDeadline: bigint;
  timeoutActive: boolean;
  timeoutOpenedAt: number;
  projectDead: boolean;
}

function daysLeft(deadline: bigint): number {
  const secs = Number(deadline) - Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil(secs / 86400));
}

function isExpired(deadline: bigint): boolean {
  return Number(deadline) <= Math.floor(Date.now() / 1000);
}

export function useMarketsData() {
  /* ── project count ── */
  const { data: projectCountRaw } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "projectCount",
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
          string, string, string, bigint,
          bigint, bigint, boolean, bigint, boolean, boolean,
        ];
        const totalRaised = toUSDC(r[3]);
        const fundingGoal = toUSDC(r[9]);
        const expired = isExpired(r[10]);
        const goalMet = fundingGoal > 0 && totalRaised >= fundingGoal;
        return {
          id:               i + 1,
          name:             r[12] || `Project #${i + 1}`,
          description:      r[13] || "No description provided.",
          additionalFilesUrl: r[14] || "",
          offchainMetadataUri: r[8] || "",
          founder:          r[0],
          milestoneCount:   Number(r[2]),
          totalRaised,
          totalReleased:    toUSDC(r[4]),
          currentMilestone: Number(r[5]),
          metadataUri:      r[8],
          fundingGoal,
          fundingDeadline:  r[10],
          approved:         r[11],
          daysLeft:         daysLeft(r[10]),
          isExpired:        expired,
          goalMet,
          fundingClosed:    expired, // Only close when deadline passes, not when goal met
          milestoneWindow:  Number(r[16]),
          milestoneDeadline: r[17],
          timeoutActive:    r[18],
          timeoutOpenedAt:  Number(r[19]),
          projectDead:      r[20],
        } satisfies MarketProject;
      })
      .filter(Boolean) as MarketProject[];
  }, [projectsRaw]);

  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return projects.reduce(
      (acc, project) => {
        acc.totalRaised += project.totalRaised;
        acc.tvl += Math.max(0, project.totalRaised - project.totalReleased);
        if (project.approved && Number(project.fundingDeadline) > now && !project.goalMet) {
          acc.activeProjectCount += 1;
        }
        return acc;
      },
      { totalRaised: 0, tvl: 0, activeProjectCount: 0 },
    );
  }, [projects]);

  return {
    projects,
    totalRaised: stats.totalRaised,
    tvl: stats.tvl,
    activeProjectCount: stats.activeProjectCount,
    isLoading: count > 0 && !projectsRaw,
    refetch: () => {
      void refetchProjects();
    },
  };
}
