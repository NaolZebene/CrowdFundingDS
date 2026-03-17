import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Project {
  id: number;
  title: string;
  category: string;
  description: string;
  raised: number;
  goal: number;
  backers: number;
  daysLeft: number;
  apy: number;
  milestones: number;
  milestonesCompleted: number;
  image: string;
  hot: boolean;
  trending: boolean;
}

interface ProjectsState {
  items: Project[];
  activeCategory: string;
  sortBy: string;
  searchQuery: string;
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: 1,
    title: "DecentraLend Protocol",
    category: "DeFi",
    description: "Peer-to-peer lending with algorithmic interest rates and no central authority.",
    raised: 84200,
    goal: 120000,
    backers: 312,
    daysLeft: 14,
    apy: 8.2,
    milestones: 4,
    milestonesCompleted: 1,
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop",
    hot: true,
    trending: true,
  },
  {
    id: 2,
    title: "ZK Identity Layer",
    category: "Tech",
    description: "Privacy-preserving KYC for DeFi using zero-knowledge proofs.",
    raised: 55000,
    goal: 80000,
    backers: 189,
    daysLeft: 22,
    apy: 6.5,
    milestones: 3,
    milestonesCompleted: 1,
    image: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=800&h=400&fit=crop",
    hot: false,
    trending: true,
  },
  {
    id: 3,
    title: "OnChain Chess Arena",
    category: "Gaming",
    description: "Fully on-chain chess with wager pools, ELO rankings, and tournament contracts.",
    raised: 47800,
    goal: 70000,
    backers: 561,
    daysLeft: 11,
    apy: 6.9,
    milestones: 4,
    milestonesCompleted: 2,
    image: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=400&fit=crop",
    hot: true,
    trending: true,
  },
  {
    id: 4,
    title: "Generative Art Coll.",
    category: "Art",
    description: "DAO-curated generative art where collectors vote on which pieces get minted.",
    raised: 31000,
    goal: 50000,
    backers: 204,
    daysLeft: 30,
    apy: 7.0,
    milestones: 3,
    milestonesCompleted: 0,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop",
    hot: true,
    trending: false,
  },
  {
    id: 5,
    title: "BioData Marketplace",
    category: "Science",
    description: "Tokenized scientific data marketplace letting researchers monetize datasets.",
    raised: 9200,
    goal: 60000,
    backers: 41,
    daysLeft: 45,
    apy: 9.8,
    milestones: 6,
    milestonesCompleted: 0,
    image: "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&h=400&fit=crop",
    hot: false,
    trending: false,
  },
  {
    id: 6,
    title: "ReFi Community Gardens",
    category: "Social",
    description: "Regenerative finance for urban community gardens — yield goes back to the soil.",
    raised: 18400,
    goal: 40000,
    backers: 97,
    daysLeft: 8,
    apy: 5.1,
    milestones: 5,
    milestonesCompleted: 2,
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=400&fit=crop",
    hot: false,
    trending: false,
  },
];

const initialState: ProjectsState = {
  items: INITIAL_PROJECTS,
  activeCategory: "All",
  sortBy: "Trending",
  searchQuery: "",
};

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setCategory(state, action: PayloadAction<string>) {
      state.activeCategory = action.payload;
    },
    setSortBy(state, action: PayloadAction<string>) {
      state.sortBy = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    updateProject(state, action: PayloadAction<Partial<Project> & { id: number }>) {
      const idx = state.items.findIndex((p) => p.id === action.payload.id);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], ...action.payload };
    },
  },
});

export const { setCategory, setSortBy, setSearchQuery, updateProject } = projectsSlice.actions;
export default projectsSlice.reducer;
