import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { Provider } from "react-redux";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { store } from "./store";
import { config } from "./config/wagmi";
import { apolloClient } from "./lib/apollo";
import App from "./App";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <App />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </ApolloProvider>
    </Provider>
  </React.StrictMode>
);
