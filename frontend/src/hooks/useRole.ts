import { useAccount, useReadContract } from "wagmi";
import { AMM_ABI, VAULT_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";

export type AppRole = "guest" | "user" | "admin";

export function useRole() {
  const { address, isConnected } = useAccount();
  const normalizedAddress = address?.toLowerCase();
  const isConfiguredAdmin =
    !!normalizedAddress &&
    normalizedAddress === CONTRACTS.TREASURY.toLowerCase();

  const vaultAdminCheck = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Secondary check to avoid false "user" role if isAdmin() read is briefly stale/error.
  const vaultAdminAddressCheck = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "admin",
    query: { enabled: !!address && isConnected },
  });

  const ammAdminCheck = useReadContract({
    address: CONTRACTS.AMM,
    abi: AMM_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  const ammAdminAddressCheck = useReadContract({
    address: CONTRACTS.AMM,
    abi: AMM_ABI,
    functionName: "admin",
    query: { enabled: !!address && isConnected },
  });

  const isVaultAdminByFlag =
    typeof vaultAdminCheck.data === "boolean" ? vaultAdminCheck.data : false;
  const isVaultAdminByAddress =
    !!normalizedAddress &&
    typeof vaultAdminAddressCheck.data === "string" &&
    vaultAdminAddressCheck.data.toLowerCase() === normalizedAddress;
  const isAmmAdminByFlag =
    typeof ammAdminCheck.data === "boolean" ? ammAdminCheck.data : false;
  const isAmmAdminByAddress =
    !!normalizedAddress &&
    typeof ammAdminAddressCheck.data === "string" &&
    ammAdminAddressCheck.data.toLowerCase() === normalizedAddress;

  const isAdmin =
    isConfiguredAdmin ||
    isVaultAdminByFlag ||
    isVaultAdminByAddress ||
    isAmmAdminByFlag ||
    isAmmAdminByAddress;

  const connected = Boolean(isConnected && address);
  const checksSettled = Boolean(
    (typeof vaultAdminCheck.data === "boolean" || vaultAdminCheck.isError) &&
      (typeof vaultAdminAddressCheck.data === "string" ||
        vaultAdminAddressCheck.isError) &&
      (typeof ammAdminCheck.data === "boolean" || ammAdminCheck.isError) &&
      (typeof ammAdminAddressCheck.data === "string" ||
        ammAdminAddressCheck.isError),
  );
  const isRoleLoading = Boolean(connected && !isConfiguredAdmin && !checksSettled);

  const role: AppRole = !connected ? "guest" : isAdmin ? "admin" : "user";

  return {
    role,
    isAdmin,
    isUser: role === "user",
    isGuest: role === "guest",
    isRoleLoading,
  };
}
