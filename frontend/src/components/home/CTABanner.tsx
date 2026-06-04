import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface CTABannerProps {
  isConnected: boolean;
  onConnect: () => void;
  onSubmit: () => void;
}

export function CTABanner({ isConnected, onConnect, onSubmit }: CTABannerProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
      <div>
        <h3 className="font-bold text-base mb-1">Have a project to fund?</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Submit with milestones, a funding goal, and a deadline. Backers earn
          yield from day one.
        </p>
      </div>
      <div className="flex gap-2.5 shrink-0">
        <Link href="/amm">
          <Button variant="outline" className="h-9 px-4 text-sm gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> AMM Swap
          </Button>
        </Link>
        <Button
          className="h-9 px-5 text-sm gap-1.5"
          onClick={() => {
            if (!isConnected) {
              onConnect();
              return;
            }
            onSubmit();
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          {isConnected ? "Submit a project" : "Connect wallet"}
        </Button>
      </div>
    </div>
  );
}
