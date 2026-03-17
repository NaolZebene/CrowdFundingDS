import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AmmProject {
  id: number;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  poolUsdc: number;
  poolCommit: number;
  volume24h: number;
  fee: number;
  category: string;
  hot: boolean;
}

interface AmmState {
  projects: AmmProject[];
  selectedProjectId: number;
  direction: "buy" | "sell";
  inputVal: string;
  search: string;
}

const AMM_PROJECTS: AmmProject[] = [
  { id: 1, name: "DecentraLend Protocol", symbol: "DLP", price: 1.84, change24h: 6.2,  poolUsdc: 84200, poolCommit: 45760, volume24h: 12400, fee: 0.3, category: "DeFi",   hot: true  },
  { id: 2, name: "ZK Identity Layer",     symbol: "ZKI", price: 1.32, change24h: -2.1, poolUsdc: 55000, poolCommit: 41666, volume24h: 8100,  fee: 0.3, category: "Tech",   hot: false },
  { id: 3, name: "OnChain Chess Arena",   symbol: "OCA", price: 1.10, change24h: 4.5,  poolUsdc: 47800, poolCommit: 43454, volume24h: 5900,  fee: 0.3, category: "Gaming", hot: true  },
  { id: 4, name: "Generative Art Coll.",  symbol: "GAC", price: 0.95, change24h: -0.8, poolUsdc: 31000, poolCommit: 32631, volume24h: 2300,  fee: 0.3, category: "Art",    hot: false },
];

const initialState: AmmState = {
  projects: AMM_PROJECTS,
  selectedProjectId: 1,
  direction: "buy",
  inputVal: "",
  search: "",
};

const ammSlice = createSlice({
  name: "amm",
  initialState,
  reducers: {
    selectProject(state, action: PayloadAction<number>) {
      state.selectedProjectId = action.payload;
      state.inputVal = "";
    },
    setDirection(state, action: PayloadAction<"buy" | "sell">) {
      state.direction = action.payload;
      state.inputVal = "";
    },
    flipDirection(state) {
      state.direction = state.direction === "buy" ? "sell" : "buy";
      state.inputVal = "";
    },
    setInputVal(state, action: PayloadAction<string>) {
      state.inputVal = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const { selectProject, setDirection, flipDirection, setInputVal, setSearch } = ammSlice.actions;
export default ammSlice.reducer;
