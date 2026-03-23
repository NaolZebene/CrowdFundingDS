import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

if (!walletConnectProjectId) {
  throw new Error(
    "Missing VITE_WALLETCONNECT_PROJECT_ID. Add it to frontend/.env (see frontend/.env.example)."
  );
}

export const config = getDefaultConfig({
  appName: "CrowdVault",
  projectId: walletConnectProjectId,
  chains: [sepolia],
  ssr: false,
});
