import { useAccount, useReadContracts } from "wagmi";
import { AMM_ABI, VAULT_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";

export type AppRole = "guest" | "user" | "admin";

export function useRole() {
  const { address, isConnected } = useAccount();
  const connected = Boolean(isConnected && address);
  const normalizedAddress = address?.toLowerCase() ?? "";

  const isConfiguredAdmin =
    !!normalizedAddress && normalizedAddress === CONTRACTS.TREASURY.toLowerCase();

  const { data, isError } = useReadContracts({
    contracts: [
      { address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "isAdmin", args: address ? [address] : undefined },
      { address: CONTRACTS.VAULT, abi: VAULT_ABI, functionName: "admin" },
      { address: CONTRACTS.AMM,   abi: AMM_ABI,   functionName: "isAdmin", args: address ? [address] : undefined },
      { address: CONTRACTS.AMM,   abi: AMM_ABI,   functionName: "admin" },
    ],
    query: { enabled: connected },
  });

  const [vaultIsAdmin, vaultAdmin, ammIsAdmin, ammAdmin] = data ?? [];

  const isAdmin =
    isConfiguredAdmin ||
    vaultIsAdmin?.result === true ||
    (typeof vaultAdmin?.result === "string" && vaultAdmin.result.toLowerCase() === normalizedAddress) ||
    ammIsAdmin?.result === true ||
    (typeof ammAdmin?.result === "string" && ammAdmin.result.toLowerCase() === normalizedAddress);

  const checksSettled = !!data || isError;
  const isRoleLoading = Boolean(connected && !isConfiguredAdmin && !checksSettled);
  const role: AppRole = !connected ? "guest" : isAdmin ? "admin" : "user";

  return {
    role,
    isAdmin,
    isUser:        role === "user",
    isGuest:       role === "guest",
    isRoleLoading,
  };
}
