import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { useProjectSubmission } from "@/hooks/useProjectSubmission";

interface SubmitProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function SubmitProjectModal({ open, onClose }: SubmitProjectModalProps) {
  const { address, isConnected } = useAccount();
  const {
    submissionFeeUsdc,
    needsFeeApproval,
    isSubmitting,
    isTxSuccess,
    writeError,
    submitProject,
  } = useProjectSubmission();

  const [treasury, setTreasury] = useState("");
  const [milestoneCount, setMilestoneCount] = useState("3");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [offchainMetadataUri, setOffchainMetadataUri] = useState("");
  const [additionalFilesUrl, setAdditionalFilesUrl] = useState("");
  const [fundingGoalUsdc, setFundingGoalUsdc] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (open && address && !treasury) setTreasury(address);
  }, [open, address, treasury]);

  useEffect(() => {
    if (isTxSuccess) {
      onClose();
    }
  }, [isTxSuccess, onClose]);

  const now = Date.now();
  const minDeadline = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const maxDeadline = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const isValid = useMemo(() => {
    if (!treasury.startsWith("0x") || treasury.length !== 42) return false;
    const milestones = Number(milestoneCount);
    const goal = Number(fundingGoalUsdc);
    if (!Number.isFinite(milestones) || milestones <= 0 || !Number.isInteger(milestones)) return false;
    if (!Number.isFinite(goal) || goal < 0) return false;
    if (!projectName.trim()) return false;
    if (!projectDescription.trim()) return false;
    if (!offchainMetadataUri.trim()) return false;
    if (deadline) {
      const ts = new Date(deadline).getTime();
      if (Number.isNaN(ts)) return false;
    }
    return true;
  }, [
    treasury,
    milestoneCount,
    fundingGoalUsdc,
    projectName,
    projectDescription,
    offchainMetadataUri,
    deadline,
  ]);

  function handleSubmit() {
    if (!isConnected || !isValid) return;
    const fundingDeadlineUnix = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
    const metadataUri = offchainMetadataUri.trim();
    submitProject({
      treasury: treasury as `0x${string}`,
      milestoneCount: Math.floor(Number(milestoneCount)),
      name: projectName.trim(),
      description: projectDescription.trim(),
      additionalFilesUrl: additionalFilesUrl.trim(),
      metadataUri,
      fundingGoalUsdc: fundingGoalUsdc || "0",
      fundingDeadlineUnix,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">Submit Project</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Create a new crowdfunding project on-chain
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Acme Solar Grid"
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Project Description
            </label>
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={3}
              placeholder="Short on-chain description for this project..."
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Treasury Address
            </label>
            <input
              type="text"
              value={treasury}
              onChange={(e) => setTreasury(e.target.value)}
              placeholder="0x..."
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Milestones
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={milestoneCount}
                onChange={(e) => setMilestoneCount(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Funding Goal (USDC)
              </label>
              <input
                type="number"
                min={0}
                step="0.000001"
                value={fundingGoalUsdc}
                onChange={(e) => setFundingGoalUsdc(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Funding Deadline (optional)
            </label>
            <input
              type="datetime-local"
              min={minDeadline}
              max={maxDeadline}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">If empty, default is 30 days.</p>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Off-chain Metadata URI
            </label>
            <input
              type="text"
              value={offchainMetadataUri}
              onChange={(e) => setOffchainMetadataUri(e.target.value)}
              placeholder="ipfs://... or https://... (full rich metadata)"
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Name + description are saved on-chain; this URI points to richer off-chain metadata.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Additional Files URL
              </label>
              <input
                type="text"
                value={additionalFilesUrl}
                onChange={(e) => setAdditionalFilesUrl(e.target.value)}
                placeholder="https://... (docs, deck, repo)"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>Submission fee: <span className="font-mono text-foreground">{submissionFeeUsdc.toFixed(2)} USDC</span></p>
            {needsFeeApproval && (
              <p>First transaction will approve USDC for the submission fee.</p>
            )}
          </div>

          {writeError && (
            <p className="text-[11px] text-red-400">{writeError.message.slice(0, 140)}</p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            Deadline must be within 3 to 90 days if provided.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!isConnected || !isValid || isSubmitting}
              onClick={handleSubmit}
            >
              <Plus className="w-3.5 h-3.5" />
              {!isConnected
                ? "Connect Wallet"
                : isSubmitting
                ? "Confirming..."
                : needsFeeApproval
                ? "Approve Fee"
                : "Submit Project"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
