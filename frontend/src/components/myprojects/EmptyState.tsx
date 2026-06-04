import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  isConnected: boolean;
  onConnect: () => void;
  onSubmitProject: () => void;
}

export function EmptyState({ isConnected, onConnect, onSubmitProject }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-secondary/10">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <FolderOpen className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">No projects yet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">
        Submit your first project to start raising funds from backers.
      </p>
      <Button
        size="sm"
        className="mt-4 h-9 text-xs gap-1.5"
        onClick={() => {
          if (!isConnected) {
            onConnect();
            return;
          }
          onSubmitProject();
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        {isConnected ? "Submit a Project" : "Connect Wallet"}
      </Button>
    </div>
  );
}
