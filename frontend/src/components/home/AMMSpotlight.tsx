import { TrendingUp, Zap, Users, Coins, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { AmmPool } from "@/hooks/useAmmData";
import { fmtUSD } from "@/utils/homeFormatters";

interface AMMSpotlightProps {
  pools: AmmPool[];
}

export function AMMSpotlight({ pools }: AMMSpotlightProps) {
  const features = [
    {
      icon: <Zap className="w-3.5 h-3.5 text-primary" />,
      label: "Instant liquidity",
      body: "Swap USDC ↔ CommitTokens in one transaction at the current market price.",
    },
    {
      icon: <TrendingUp className="w-3.5 h-3.5 text-primary" />,
      label: "Price discovery",
      body: "Constant product formula ensures fair pricing with every trade.",
    },
    {
      icon: <Users className="w-3.5 h-3.5 text-primary" />,
      label: "Governance weight",
      body: "Token holders vote on milestone releases. More tokens = more voting power.",
    },
    {
      icon: <Coins className="w-3.5 h-3.5 text-primary" />,
      label: "Yield accrual",
      body: "Hold CommitTokens and earn a share of protocol yield automatically.",
    },
  ];

  const topPools = [...pools]
    .sort((a, b) => b.poolUsdc - a.poolUsdc)
    .slice(0, 5);

  return (
    <section className="pt-6 border-t border-border">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* left: copy */}
          <div className="p-7 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-widest">
                  Built-in AMM
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight leading-snug mb-3">
                Trade CommitTokens.
                <br />
                <span className="text-primary">Anytime. On-chain.</span>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Every funded project gets its own liquidity pool automatically
                seeded from the raise. Buy and sell project tokens instantly —
                no order book, no waiting, no lock-up.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {features.map((f) => (
                <div
                  key={f.label}
                  className="flex gap-2.5 p-3 rounded-xl bg-secondary/50 border border-border/60"
                >
                  <div className="mt-0.5 shrink-0">{f.icon}</div>
                  <div>
                    <p className="text-xs font-semibold mb-0.5">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/amm">
              <Button className="gap-2 w-full sm:w-auto">
                <TrendingUp className="w-4 h-4" /> Open AMM Market{" "}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {/* right: top pools */}
          <div className="bg-gradient-to-br from-primary/5 via-background to-secondary border-l border-border flex flex-col justify-center p-7 gap-4 min-h-[320px]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Top Pools
              </p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {pools.length} active
              </span>
            </div>

            {pools.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active pools yet — fund a project to seed the first pool.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topPools.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {fmtUSD(p.poolUsdc)} liquidity · {p.swapCount} swaps
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-bold text-primary">
                        ${p.price.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {fmtUSD(p.volumeUsdc / 1e6)} vol.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
