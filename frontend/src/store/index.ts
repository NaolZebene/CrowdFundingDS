import { configureStore } from "@reduxjs/toolkit";
import projectsReducer from "./slices/projectsSlice";
import portfolioReducer from "./slices/portfolioSlice";
import ammReducer from "./slices/ammSlice";
import governanceReducer from "./slices/governanceSlice";

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    portfolio: portfolioReducer,
    amm: ammReducer,
    governance: governanceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
