import { Card, CardContent } from "@/components/ui/card";
import type { AmmPool } from "@/hooks/useAmmData";

interface MarketRequirementsProps {
  pool?: AmmPool;
}

export function MarketRequirements({ pool }: MarketRequirementsProps) {
  const checks = [
    { label: "Funding goal met", done: !!pool?.goalMet },
    { label: "Funding closed", done: !!pool?.fundingClosed },
    { label: "AMM liquidity seeded", done: !!pool?.seeded },
    {
      label: "Pool reserves available",
      done: !!pool && pool.poolUsdc > 0 && pool.poolCommit > 0,
    },
  ];

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Market Open Checklist
        </p>
        <div className="mt-3 space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground">{check.label}</span>
              <span
                className={`font-mono ${
                  check.done ? "text-green-400" : "text-yellow-400"
                }`}
              >
                {check.done ? "Ready" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
