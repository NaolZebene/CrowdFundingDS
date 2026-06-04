import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectPromptProps {
  onConnect: () => void;
}

export function ConnectPrompt({ onConnect }: ConnectPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-secondary/10">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Wallet className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">Connect your wallet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">
        Connect your wallet to view and manage your projects.
      </p>
      <Button size="sm" className="mt-4 h-9 text-xs gap-1.5" onClick={onConnect}>
        Connect Wallet
      </Button>
    </div>
  );
}
