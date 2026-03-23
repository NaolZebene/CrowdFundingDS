import { useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { ERC20_ABI, VAULT_ABI } from "@/config/abis";

const USDC_DECIMALS = 6;

export interface SubmitProjectInput {
  treasury: `0x${string}`;
  milestoneCount: number;
  name: string;
  description: string;
  additionalFilesUrl: string;
  metadataUri: string;
  fundingGoalUsdc: string;
  fundingDeadlineUnix: number;
}

export function useProjectSubmission() {
  const { address, isConnected } = useAccount();

  const { data: submissionFeeRaw } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "projectSubmissionFee",
  });

  const submissionFee = (submissionFeeRaw as bigint | undefined) ?? 0n;

  const { data: usdcAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.VAULT] : undefined,
    query: { enabled: !!address },
  });

  const usdcAllowance = (usdcAllowanceRaw as bigint | undefined) ?? 0n;
  const needsFeeApproval = submissionFee > 0n && usdcAllowance < submissionFee;

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isTxPending,
    isSuccess: isTxSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const isSubmitting = isWriting || isTxPending;

  function submitProject(input: SubmitProjectInput) {
    if (!isConnected || !address) return;

    if (needsFeeApproval) {
      writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.VAULT, submissionFee],
      });
      return;
    }

    writeContract({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "createProject",
      args: [
        input.treasury,
        BigInt(input.milestoneCount),
        input.name,
        input.description,
        input.additionalFilesUrl,
        input.metadataUri,
        parseUnits(input.fundingGoalUsdc || "0", USDC_DECIMALS),
        BigInt(input.fundingDeadlineUnix),
      ],
    });
  }

  const submissionFeeUsdc = useMemo(
    () => Number(submissionFee) / 10 ** USDC_DECIMALS,
    [submissionFee],
  );

  return {
    isConnected,
    submissionFee,
    submissionFeeUsdc,
    needsFeeApproval,
    isSubmitting,
    isTxSuccess,
    writeError,
    submitProject,
  };
}
