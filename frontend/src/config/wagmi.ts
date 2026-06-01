import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

if (!walletConnectProjectId) {
  throw new Error(
    "Missing VITE_WALLETCONNECT_PROJECT_ID. Add it to frontend/.env (see frontend/.env.example)."
  );
}

const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC_URL?.trim();

export const config = getDefaultConfig({
  appName: "Raise",
  projectId: walletConnectProjectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
  },
  ssr: false,
});
