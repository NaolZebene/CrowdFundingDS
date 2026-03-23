import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const FALLBACK_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/PLACEHOLDER/crowdvault/version/latest";

export const SUBGRAPH_URL =
  import.meta.env.VITE_SUBGRAPH_URL?.trim() || FALLBACK_SUBGRAPH_URL;

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: SUBGRAPH_URL,
    fetch,
  }),
  defaultOptions: {
    query: {
      fetchPolicy: "cache-first",
      errorPolicy: "all",
    },
  },
});
