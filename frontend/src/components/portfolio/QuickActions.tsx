import { Activity, ArrowUpRight, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CONTRACTS } from "@/config/contracts";

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Browse New Projects",
    href: "/",
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  {
    label: "Swap CommitTokens",
    href: "/amm",
    icon: <ArrowUpRight className="w-3.5 h-3.5" />,
  },
  {
    label: "View on Etherscan",
    href: `https://sepolia.etherscan.io/address/${CONTRACTS.VAULT}`,
    icon: <ExternalLink className="w-3.5 h-3.5" />,
    external: true,
  },
];

export function QuickActions() {
  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardContent className="p-4 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">
          Quick Actions
        </p>
        {QUICK_ACTIONS.map((action) =>
          action.external ? (
            <a
              key={action.label}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-xs font-medium group">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {action.icon}
                  </span>
                  {action.label}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </a>
          ) : (
            <Link key={action.label} href={action.href}>
              <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-xs font-medium group">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {action.icon}
                  </span>
                  {action.label}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </Link>
          )
        )}
      </CardContent>
    </Card>
  );
}
