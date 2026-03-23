import { gql, useQuery } from "@apollo/client";

interface IndexedProject {
  id: string;
  projectId: string;
  metadataUri: string;
  totalRaised: string;
  currentMilestone: string;
  milestoneCount: string;
  approved: boolean;
  updatedAt: string;
}

interface IndexedVetoVote {
  id: string;
  projectId: string;
  voter: string;
  timestamp: string;
}

interface IndexedProjectUser {
  id: string;
  projectId: string;
  user: string;
  investedUsdc: string;
  hasVotedVeto: boolean;
  lastSeenAt: string;
}

const GOVERNANCE_INDEXED_QUERY = gql`
  query GovernanceIndexedData($wallet: Bytes) {
    projects(first: 100, orderBy: updatedAt, orderDirection: desc) {
      id
      projectId
      metadataUri
      totalRaised
      currentMilestone
      milestoneCount
      approved
      updatedAt
    }
    vetoVotes(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      projectId
      voter
      timestamp
    }
    projectUsers(first: 500, where: { investedUsdc_gt: "0" }) {
      id
      projectId
      user
      investedUsdc
      hasVotedVeto
      lastSeenAt
    }
    myRelations: projectUsers(first: 100, where: { user: $wallet }) {
      id
      projectId
      user
      investedUsdc
      hasVotedVeto
      lastSeenAt
    }
  }
`;

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function uniqueCount(values: string[]): number {
  return new Set(values.map((v) => v.toLowerCase())).size;
}

export function useGovernanceIndexedData(address?: string) {
  const wallet = address?.toLowerCase();
  const { data, loading, error, refetch } = useQuery(GOVERNANCE_INDEXED_QUERY, {
    variables: { wallet },
    pollInterval: 30_000,
    fetchPolicy: "cache-and-network",
  });

  const projects = (data?.projects ?? []) as IndexedProject[];
  const vetoVotes = (data?.vetoVotes ?? []) as IndexedVetoVote[];
  const projectUsers = (data?.projectUsers ?? []) as IndexedProjectUser[];
  const myRelations = (data?.myRelations ?? []) as IndexedProjectUser[];

  const recentVotes = vetoVotes.slice(0, 8).map((v) => ({
    id: v.id,
    projectId: Number(v.projectId),
    voter: v.voter,
    timestamp: toNum(v.timestamp) * 1000,
  }));

  const activeProjects = projects.filter((p) => p.approved);
  const uniqueVoters = uniqueCount(vetoVotes.map((v) => v.voter));
  const uniqueParticipants = uniqueCount(projectUsers.map((u) => u.user));
  const votedProjectsCount = uniqueCount(vetoVotes.map((v) => v.projectId));

  const myStakeUsdc = myRelations.reduce((sum, r) => sum + toNum(r.investedUsdc) / 1e6, 0);
  const myVotesCast = myRelations.filter((r) => r.hasVotedVeto).length;

  const byUser = new Map<
    string,
    { user: string; investedUsdc: number; projects: number; hasVotedVeto: boolean }
  >();
  for (const r of projectUsers) {
    const key = r.user.toLowerCase();
    const prev = byUser.get(key);
    const inc = toNum(r.investedUsdc) / 1e6;
    if (!prev) {
      byUser.set(key, {
        user: r.user,
        investedUsdc: inc,
        projects: 1,
        hasVotedVeto: r.hasVotedVeto,
      });
    } else {
      prev.investedUsdc += inc;
      prev.projects += 1;
      prev.hasVotedVeto = prev.hasVotedVeto || r.hasVotedVeto;
      byUser.set(key, prev);
    }
  }

  const topParticipants = [...byUser.values()]
    .sort((a, b) => b.investedUsdc - a.investedUsdc)
    .slice(0, 6);

  return {
    loading,
    error,
    refetch,
    stats: {
      projectsTracked: projects.length,
      activeProjects: activeProjects.length,
      uniqueVoters,
      uniqueParticipants,
      votedProjectsCount,
    },
    recentVotes,
    topParticipants,
    myGovernance: {
      stakeUsdc: myStakeUsdc,
      votesCast: myVotesCast,
      projectsInvolved: myRelations.length,
    },
  };
}
