import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useRole } from "@/hooks/useRole";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { role, isAdmin, isUser, isGuest, isRoleLoading } = useRole();

  return {
    address,
    isConnected,
    isConnecting,
    isWrongNetwork: isConnected && chainId !== sepolia.id,
    role,
    isAdmin,
    isUser,
    isGuest,
    isRoleLoading,
  };
}
