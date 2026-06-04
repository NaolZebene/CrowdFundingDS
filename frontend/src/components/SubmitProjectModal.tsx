import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { useProjectSubmission } from "@/hooks/useProjectSubmission";

interface SubmitProjectModalProps {
  open: boolean;
  onClose: () => void;
}

function formatLocalDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SubmitProjectModal({ open, onClose }: SubmitProjectModalProps) {
  const { address, isConnected } = useAccount();
  const {
    submissionFeeUsdc,
    needsFeeApproval,
    isSubmitting,
    isTxSuccess,
    writeError,
    preflightError,
    submitProject,
  } = useProjectSubmission();

  const [treasury, setTreasury] = useState("");
  const [milestoneCount, setMilestoneCount] = useState("3");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [offchainMetadataUri, setOffchainMetadataUri] = useState("");
  const [additionalFilesUrl, setAdditionalFilesUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [fundingGoalUsdc, setFundingGoalUsdc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestoneWindowDays, setMilestoneWindowDays] = useState("60");

  useEffect(() => {
    if (open && address && !treasury) setTreasury(address);
  }, [open, address, treasury]);

  useEffect(() => {
    if (isTxSuccess) {
      onClose();
    }
  }, [isTxSuccess, onClose]);

  const now = Date.now();
  const maxDeadlineMs = now + 90 * 24 * 60 * 60 * 1000;
  const maxDeadline = formatLocalDateTime(new Date(maxDeadlineMs));

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
      if (ts > maxDeadlineMs) return false;
    }
    const windowDays = Number(milestoneWindowDays);
    if (!Number.isFinite(windowDays) || windowDays < 7 || windowDays > 180) return false;
    return true;
  }, [
    maxDeadlineMs,
    treasury,
    milestoneCount,
    fundingGoalUsdc,
    projectName,
    projectDescription,
    offchainMetadataUri,
    deadline,
    milestoneWindowDays,
  ]);

  function handleSubmit() {
    if (!isConnected || !isValid) return;
    const fundingDeadlineUnix = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
    const metadataUri = offchainMetadataUri.trim();
    const milestoneWindowSecs = Math.floor(Number(milestoneWindowDays)) * 86400;
    submitProject({
      treasury: treasury as `0x${string}`,
      milestoneCount: Math.floor(Number(milestoneCount)),
      name: projectName.trim(),
      description: projectDescription.trim(),
      additionalFilesUrl: additionalFilesUrl.trim(),
      iconUrl: iconUrl.trim(),
      metadataUri,
      fundingGoalUsdc: fundingGoalUsdc || "0",
      fundingDeadlineUnix,
      milestoneWindowSecs,
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
                placeholder="e.g. 10000 (0 = no goal)"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Set to 0 for flexible funding (no deadline required).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Funding Deadline (optional)
              </label>
              <input
                type="datetime-local"
                max={maxDeadline}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {fundingGoalUsdc === "0" || fundingGoalUsdc === ""
                  ? "Optional when goal is 0."
                  : "Default: 30 days if not set."}
              </p>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Milestone Window (days)
              </label>
              <input
                type="number"
                min={7}
                max={180}
                step={1}
                value={milestoneWindowDays}
                onChange={(e) => setMilestoneWindowDays(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Days to complete each milestone. Timeout opens if missed.
              </p>
            </div>
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
                Project Icon URL
              </label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="ipfs://... or https://... (logo/icon)"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                  />
                </div>
                {iconUrl && (
                  <div className="shrink-0">
                    <img
                      src={iconUrl}
                      alt="Icon preview"
                      className="w-10 h-10 rounded-md border border-border object-cover bg-secondary"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
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

          {(preflightError || writeError) && (
            <p className="text-[11px] text-red-400">
              {(preflightError || writeError?.message || "").slice(0, 220)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            Deadline must be within 90 days if provided.
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
