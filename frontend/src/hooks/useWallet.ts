import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();

  return {
    address,
    isConnected,
    isConnecting,
    isWrongNetwork: isConnected && chainId !== sepolia.id,
  };
}
