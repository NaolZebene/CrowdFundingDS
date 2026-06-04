import { useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

export interface ContractActionState {
  isPending: boolean;
  isConfirming: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  write: ReturnType<typeof useWriteContract>["writeContract"];
}

/**
 * Wraps useWriteContract + useWaitForTransactionReceipt into one object.
 * Optionally calls `onSuccess` after the tx is confirmed on-chain.
 */
export function useContractAction(onSuccess?: () => void): ContractActionState {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) onSuccess?.();
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isPending,
    isConfirming,
    isLoading: isPending || isConfirming,
    isSuccess,
    write: writeContract,
  };
}
