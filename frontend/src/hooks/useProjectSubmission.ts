import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { simulateContract } from "@wagmi/core";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { ERC20_ABI, VAULT_ABI } from "@/config/abis";
import { config as wagmiConfig } from "@/config/wagmi";

const USDC_DECIMALS = 6;
const CREATE_PROJECT_GAS_LIMIT = 1_500_000n;

export interface SubmitProjectInput {
  treasury: `0x${string}`;
  milestoneCount: number;
  name: string;
  description: string;
  additionalFilesUrl: string;
  metadataUri: string;
  fundingGoalUsdc: string;
  fundingDeadlineUnix: number;
  milestoneWindowSecs: number;
}

export function useProjectSubmission() {
  const { address, isConnected } = useAccount();
  const [preflightError, setPreflightError] = useState("");

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

  async function submitProject(input: SubmitProjectInput) {
    if (!isConnected || !address) return;
    setPreflightError("");

    if (needsFeeApproval) {
      writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.VAULT, submissionFee],
      });
      return;
    }

    const args = [
      input.treasury,
      BigInt(input.milestoneCount),
      input.name,
      input.description,
      input.additionalFilesUrl,
      input.metadataUri,
      parseUnits(input.fundingGoalUsdc || "0", USDC_DECIMALS),
      BigInt(input.fundingDeadlineUnix),
      BigInt(input.milestoneWindowSecs),
    ] as const;

    try {
      await simulateContract(wagmiConfig, {
        account: address,
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "createProject",
        args,
      });
    } catch (error) {
      setPreflightError(error instanceof Error ? error.message : String(error));
      return;
    }

    writeContract({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "createProject",
      args,
      gas: CREATE_PROJECT_GAS_LIMIT,
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
    preflightError,
    submitProject,
  };
}
