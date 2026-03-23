import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/** Shape of a single on-chain transaction record, used by useTransactionHistory */
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
  historyTab: "all" | "invest" | "yield" | "sell";
}

const initialState: PortfolioState = {
  historyTab: "all",
};

const portfolioSlice = createSlice({
  name: "portfolio",
  initialState,
  reducers: {
    setHistoryTab(state, action: PayloadAction<PortfolioState["historyTab"]>) {
      state.historyTab = action.payload;
    },
  },
});

export const { setHistoryTab } = portfolioSlice.actions;
export default portfolioSlice.reducer;
