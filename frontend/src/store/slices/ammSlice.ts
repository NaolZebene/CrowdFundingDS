import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AmmState {
  selectedProjectId: number;
  direction: "buy" | "sell";
  inputVal: string;
  search: string;
}

const initialState: AmmState = {
  selectedProjectId: 1,
  direction: "buy",
  inputVal: "",
  search: "",
};

const ammSlice = createSlice({
  name: "amm",
  reducers: {
    selectProject(state, action: PayloadAction<number>) {
      state.selectedProjectId = action.payload;
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
  initialState,
});

export const { selectProject, flipDirection, setInputVal, setSearch } = ammSlice.actions;
export default ammSlice.reducer;
