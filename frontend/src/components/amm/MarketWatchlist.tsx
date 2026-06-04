import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AmmPool } from "@/hooks/useAmmData";
import { MarketStatus } from "./MarketStatus";
import { fmtUSD, fmtToken, fmtPct, marketProgress } from "@/utils/ammFormatters";

interface MarketWatchlistProps {
  markets: AmmPool[];
  selectedId: number;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function MarketWatchlist({
  markets,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: MarketWatchlistProps) {
  const filtered = markets.filter(
    (pool) =>
      pool.name.toLowerCase().includes(search.toLowerCase()) ||
      pool.symbol.toLowerCase().includes(search.toLowerCase()) ||
      String(pool.id).includes(search)
  );

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Market Watchlist
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Project CommitToken markets, priced by live AMM reserves when
              liquidity exists.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-2 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-black/20">
              <span className="col-span-4">Market / Project</span>
              <span className="col-span-2 text-right">Starting Price</span>
              <span className="col-span-2 text-right">Raised</span>
              <span className="col-span-2 text-right">Pool Reserves</span>
              <span className="col-span-2 text-right">Status</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                No markets match this search.
              </div>
            ) : (
              filtered.map((pool) => {
                const progress = marketProgress(pool);
                return (
                  <button
                    key={pool.id}
                    onClick={() => onSelect(pool.id)}
                    className={`grid w-full grid-cols-12 gap-3 px-4 py-3 text-left text-xs transition-colors hover:bg-secondary/60 border-b border-border/40 ${
                      selectedId === pool.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : ""
                    }`}
                  >
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                          {pool.symbol.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {pool.name}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground font-mono">
                            {pool.symbol}/USDC · #{pool.id}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p
                        className={
                          pool.price > 0
                            ? "text-green-400 font-semibold"
                            : ""
                        }
                      >
                        {pool.price > 0
                          ? `1 ${pool.symbol} = ${fmtUSD(pool.price)}`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        USDC per token
                      </p>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p>{fmtUSD(pool.totalRaised)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtPct(progress)} funded
                      </p>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p>{fmtUSD(pool.poolUsdc)} USDC</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtToken(pool.poolCommit)} {pool.symbol}
                      </p>
                    </div>
                    <div className="col-span-2 self-center text-right">
                      <MarketStatus pool={pool} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
