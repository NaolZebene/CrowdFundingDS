import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ProjectsState {
  activeCategory: string;
  sortBy: string;
  searchQuery: string;
}

const initialState: ProjectsState = {
  activeCategory: "All",
  sortBy: "Most Funded",
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
  },
});

export const { setCategory, setSortBy, setSearchQuery } = projectsSlice.actions;
export default projectsSlice.reducer;
