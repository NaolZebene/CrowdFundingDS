import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "CrowdVault",
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID", // get from cloud.walletconnect.com
  chains: [sepolia],
  ssr: false,
});
