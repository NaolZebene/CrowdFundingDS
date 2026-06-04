import { Droplets } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AmmPool } from "@/hooks/useAmmData";
import { MarketStatus } from "./MarketStatus";
import { PoolStat } from "./PoolStat";
import {
  fmtUSD,
  fmtToken,
  fmtPct,
  currentPriceLabel,
  reservePriceLabel,
  marketProgress,
} from "@/utils/ammFormatters";

interface MarketPreviewProps {
  pool?: AmmPool;
  role?: string;
}

export function MarketPreview({ pool, role }: MarketPreviewProps) {
  if (!pool) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5 text-center">
          <p className="text-sm font-semibold">No markets discovered</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create or approve projects to make them visible here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progress = marketProgress(pool);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Selected Market
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold">{pool.name}</h2>
            <p className="text-[11px] text-muted-foreground">
              {pool.symbol}/USDC · Project #{pool.id}
            </p>
          </div>
          <MarketStatus pool={pool} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Funding progress</span>
            <span className="font-mono text-foreground">{fmtPct(progress)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%`, minWidth: progress > 0 ? 2 : 0 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <PoolStat
            label="Raised"
            value={fmtUSD(pool.totalRaised)}
            sub={`${fmtUSD(pool.fundingGoal)} goal`}
          />
          <PoolStat
            label="Starting Price"
            value={pool.price > 0 ? fmtUSD(pool.price) : "Not priced"}
            sub={`for tiny ${pool.symbol} trades`}
          />
          <PoolStat label="USDC Reserve" value={fmtUSD(pool.poolUsdc)} sub="AMM pool" />
          <PoolStat
            label={`${pool.symbol} Reserve`}
            value={fmtToken(pool.poolCommit)}
            sub="AMM pool"
          />
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Pool starting price
          </p>
          <p className="mt-1 font-mono text-base font-semibold">
            {currentPriceLabel(pool)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Calculated from reserves: {reservePriceLabel(pool)}. Large swaps move
            this price.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              USDC Liquidity
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {fmtUSD(pool.poolUsdc)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Token Liquidity
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {fmtToken(pool.poolCommit)} {pool.symbol}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Trading state</span>
            <span className="font-mono text-foreground">
              {pool.tradable ? "Open" : "Waiting"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>Graph status</span>
            <span className="font-mono text-foreground">
              {pool.indexed ? "Indexed" : "Not indexed"}
            </span>
          </div>
        </div>

        {role === "admin" && !pool.tradable && (
          <Link href="/dashboard">
            <Button size="sm" className="h-8 w-full text-xs gap-1.5">
              <Droplets className="w-3.5 h-3.5" />
              Open AMM Admin Controls
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
