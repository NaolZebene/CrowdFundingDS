import { useAccount, useReadContract } from "wagmi";
import { VAULT_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";

export type AppRole = "guest" | "user" | "admin";

export function useRole() {
  const { address, isConnected } = useAccount();
  const normalizedAddress = address?.toLowerCase();

  const adminCheck = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Secondary check to avoid false "user" role if isAdmin() read is briefly stale/error.
  const adminAddressCheck = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "admin",
    query: { enabled: !!address && isConnected },
  });

  const isAdminByFlag =
    typeof adminCheck.data === "boolean" ? adminCheck.data : false;
  const isAdminByAddress =
    !!normalizedAddress &&
    typeof adminAddressCheck.data === "string" &&
    adminAddressCheck.data.toLowerCase() === normalizedAddress;

  const isAdmin = isAdminByFlag || isAdminByAddress;

  const connected = Boolean(isConnected && address);
  const checksSettled = Boolean(
    (typeof adminCheck.data === "boolean" || adminCheck.isError) &&
      (typeof adminAddressCheck.data === "string" || adminAddressCheck.isError),
  );
  const isRoleLoading = Boolean(connected && !checksSettled);

  const role: AppRole = !connected ? "guest" : isAdmin ? "admin" : "user";

  return {
    role,
    isAdmin,
    isUser: role === "user",
    isGuest: role === "guest",
    isRoleLoading,
  };
}
