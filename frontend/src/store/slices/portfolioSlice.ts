import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Position {
  id: number;
  name: string;
  symbol: string;
  category: string;
  tokensHeld: number;
  entryPrice: number;
  currentPrice: number;
  apy: number;
  yieldEarned: number;
  yieldClaimable: number;
  raised: number;
  goal: number;
  milestones: number;
  milestonesCompleted: number;
  daysLeft: number;
  status: "active" | "exited";
  vetoOpen: boolean;
}

export interface TxRecord {
  type: "invest" | "yield" | "sell";
  project: string;
  symbol: string;
  amount: number;
  tokens: number;
  price: number;
  date: string; // ISO string — Dates are not serializable in Redux
}

interface PortfolioState {
  positions: Position[];
  history: TxRecord[];
  historyTab: "all" | "invest" | "yield" | "sell";
}

const initialState: PortfolioState = {
  positions: [
    {
      id: 1, name: "DecentraLend Protocol", symbol: "DLP", category: "DeFi",
      tokensHeld: 293.5, entryPrice: 1.72, currentPrice: 1.84,
      apy: 8.2, yieldEarned: 14.2, yieldClaimable: 6.8,
      raised: 84200, goal: 120000, milestones: 4, milestonesCompleted: 1,
      daysLeft: 14, status: "active", vetoOpen: false,
    },
    {
      id: 2, name: "ZK Identity Layer", symbol: "ZKI", category: "Tech",
      tokensHeld: 150.0, entryPrice: 1.38, currentPrice: 1.32,
      apy: 6.5, yieldEarned: 5.9, yieldClaimable: 2.1,
      raised: 55000, goal: 80000, milestones: 3, milestonesCompleted: 1,
      daysLeft: 22, status: "active", vetoOpen: false,
    },
    {
      id: 3, name: "OnChain Chess Arena", symbol: "OCA", category: "Gaming",
      tokensHeld: 412.0, entryPrice: 1.05, currentPrice: 1.10,
      apy: 6.9, yieldEarned: 22.4, yieldClaimable: 10.3,
      raised: 47800, goal: 70000, milestones: 4, milestonesCompleted: 2,
      daysLeft: 11, status: "active", vetoOpen: true,
    },
    {
      id: 4, name: "Generative Art Coll.", symbol: "GAC", category: "Art",
      tokensHeld: 80.0, entryPrice: 0.98, currentPrice: 0.95,
      apy: 7.0, yieldEarned: 1.8, yieldClaimable: 0.9,
      raised: 31000, goal: 50000, milestones: 3, milestonesCompleted: 0,
      daysLeft: 30, status: "active", vetoOpen: false,
    },
  ],
  history: [
    { type: "invest", project: "DecentraLend Protocol", symbol: "DLP", amount: 504.0,  tokens: 293.5, price: 1.72, date: new Date(Date.now() - 8 * 86400000).toISOString() },
    { type: "yield",  project: "OnChain Chess Arena",   symbol: "OCA", amount: 10.3,   tokens: 0,     price: 0,    date: new Date(Date.now() - 5 * 86400000).toISOString() },
    { type: "invest", project: "ZK Identity Layer",     symbol: "ZKI", amount: 207.0,  tokens: 150.0, price: 1.38, date: new Date(Date.now() - 4 * 86400000).toISOString() },
    { type: "sell",   project: "OnChain Chess Arena",   symbol: "OCA", amount: 55.0,   tokens: 50.0,  price: 1.10, date: new Date(Date.now() - 2 * 86400000).toISOString() },
    { type: "invest", project: "Generative Art Coll.",  symbol: "GAC", amount: 78.4,   tokens: 80.0,  price: 0.98, date: new Date(Date.now() - 1 * 86400000).toISOString() },
    { type: "yield",  project: "DecentraLend Protocol", symbol: "DLP", amount: 6.8,    tokens: 0,     price: 0,    date: new Date(Date.now() - 3600000).toISOString() },
  ],
  historyTab: "all",
};

const portfolioSlice = createSlice({
  name: "portfolio",
  initialState,
  reducers: {
    setHistoryTab(state, action: PayloadAction<PortfolioState["historyTab"]>) {
      state.historyTab = action.payload;
    },
    claimYield(state, action: PayloadAction<number>) {
      const pos = state.positions.find((p) => p.id === action.payload);
      if (!pos) return;
      state.history.unshift({
        type: "yield",
        project: pos.name,
        symbol: pos.symbol,
        amount: pos.yieldClaimable,
        tokens: 0,
        price: 0,
        date: new Date().toISOString(),
      });
      pos.yieldEarned += pos.yieldClaimable;
      pos.yieldClaimable = 0;
    },
    claimAllYield(state) {
      state.positions.forEach((pos) => {
        if (pos.yieldClaimable > 0) {
          state.history.unshift({
            type: "yield",
            project: pos.name,
            symbol: pos.symbol,
            amount: pos.yieldClaimable,
            tokens: 0,
            price: 0,
            date: new Date().toISOString(),
          });
          pos.yieldEarned += pos.yieldClaimable;
          pos.yieldClaimable = 0;
        }
      });
    },
    castVeto(state, action: PayloadAction<number>) {
      const pos = state.positions.find((p) => p.id === action.payload);
      if (pos) pos.vetoOpen = false;
    },
  },
});

export const { setHistoryTab, claimYield, claimAllYield, castVeto } = portfolioSlice.actions;
export default portfolioSlice.reducer;
