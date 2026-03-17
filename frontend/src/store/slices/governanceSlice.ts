import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ProposalStatus = "active" | "passed" | "failed" | "pending" | "executed";
export type ProposalCategory = "Fee" | "Security" | "Protocol" | "Treasury" | "Oracle";

export interface Proposal {
  id: number;
  title: string;
  summary: string;
  category: ProposalCategory;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  totalSupply: number;
  proposer: string;
  created: string; // ISO string
  ends: string;
  executed?: string;
  details: string;
  changes: { param: string; from: string; to: string }[];
}

interface GovernanceState {
  proposals: Proposal[];
  activeTab: "all" | "active" | "passed" | "failed";
  votes: Record<number, "for" | "against">; // proposalId -> vote
  showCreateModal: boolean;
}

const now = Date.now();

const initialState: GovernanceState = {
  proposals: [
    {
      id: 5,
      title: "Reduce submission fee from $50 to $25",
      summary: "Lower the project submission fee to attract more early-stage founders to the platform.",
      category: "Fee",
      status: "active",
      votesFor: 142000,
      votesAgainst: 38000,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0xaB3f...91Cd",
      created: new Date(now - 2 * 86400000).toISOString(),
      ends: new Date(now + 5 * 86400000).toISOString(),
      details: "The current $50 submission fee was set during the bootstrap phase to deter spam. With the protocol now established and audited, reducing this to $25 lowers the barrier for genuine founders while still filtering low-effort submissions. Revenue impact is estimated at -$150/month based on current submission volume.",
      changes: [{ param: "submissionFeeBps", from: "$50 flat", to: "$25 flat" }],
    },
    {
      id: 4,
      title: "Add Compound V3 as an approved lender",
      summary: "Whitelist Compound V3 (Comet) as a second yield source alongside Aave.",
      category: "Protocol",
      status: "active",
      votesFor: 95000,
      votesAgainst: 67000,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0x77Ce...F312",
      created: new Date(now - 1 * 86400000).toISOString(),
      ends: new Date(now + 6 * 86400000).toISOString(),
      details: "Adding Compound V3 as an approved lender gives the admin the ability to switch yield sources when Compound offers better rates than Aave. This does not change lender automatically — it only expands the whitelist of callable lenders.",
      changes: [{ param: "approvedLenders", from: "[Aave V3]", to: "[Aave V3, Compound V3]" }],
    },
    {
      id: 3,
      title: "Lower veto threshold from 30% to 20%",
      summary: "Make it easier for backers to block suspicious milestone releases.",
      category: "Security",
      status: "passed",
      votesFor: 218000,
      votesAgainst: 52000,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0x55A1...B09E",
      created: new Date(now - 10 * 86400000).toISOString(),
      ends: new Date(now - 3 * 86400000).toISOString(),
      executed: new Date(now - 2 * 86400000).toISOString(),
      details: "Backers reported that reaching 30% stake coordination is difficult in practice for smaller projects. Lowering to 20% increases backer protection without significantly affecting normal project flow.",
      changes: [{ param: "VETO_THRESHOLD_BPS", from: "3000 (30%)", to: "2000 (20%)" }],
    },
    {
      id: 2,
      title: "Increase release fee from 0.5% to 1%",
      summary: "Raise the milestone release fee sent to the RevenueRouter.",
      category: "Fee",
      status: "failed",
      votesFor: 88000,
      votesAgainst: 145000,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0xC2Fa...4401",
      created: new Date(now - 20 * 86400000).toISOString(),
      ends: new Date(now - 13 * 86400000).toISOString(),
      details: "The proposal aimed to double the protocol's take rate on milestone releases. The community rejected this as it would reduce founder net proceeds and make CrowdVault less competitive.",
      changes: [{ param: "releaseFeeBps", from: "50 (0.5%)", to: "100 (1%)" }],
    },
    {
      id: 1,
      title: "Add Chainlink as an approved oracle",
      summary: "Whitelist Chainlink price feeds as an approved oracle source.",
      category: "Oracle",
      status: "executed",
      votesFor: 310000,
      votesAgainst: 12000,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0x1A2B...3C4D",
      created: new Date(now - 35 * 86400000).toISOString(),
      ends: new Date(now - 28 * 86400000).toISOString(),
      executed: new Date(now - 27 * 86400000).toISOString(),
      details: "Initial oracle setup. Chainlink was selected for its battle-tested reliability and Sepolia testnet support.",
      changes: [{ param: "oracle", from: "0x0000 (none)", to: "0xChainlink (Sepolia)" }],
    },
  ],
  activeTab: "all",
  votes: {},
  showCreateModal: false,
};

const governanceSlice = createSlice({
  name: "governance",
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<GovernanceState["activeTab"]>) {
      state.activeTab = action.payload;
    },
    castVote(state, action: PayloadAction<{ id: number; vote: "for" | "against" }>) {
      const { id, vote } = action.payload;
      if (state.votes[id]) return; // already voted
      state.votes[id] = vote;
      const proposal = state.proposals.find((p) => p.id === id);
      if (!proposal) return;
      const power = 4200;
      if (vote === "for") proposal.votesFor += power;
      else proposal.votesAgainst += power;
    },
    setShowCreateModal(state, action: PayloadAction<boolean>) {
      state.showCreateModal = action.payload;
    },
    addProposal(state, action: PayloadAction<Omit<Proposal, "id" | "status" | "votesFor" | "votesAgainst" | "created" | "ends">>) {
      const id = Math.max(...state.proposals.map((p) => p.id)) + 1;
      state.proposals.unshift({
        ...action.payload,
        id,
        status: "active",
        votesFor: 0,
        votesAgainst: 0,
        created: new Date().toISOString(),
        ends: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      state.showCreateModal = false;
    },
  },
});

export const { setActiveTab, castVote, setShowCreateModal, addProposal } = governanceSlice.actions;
export default governanceSlice.reducer;
