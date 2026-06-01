import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown, ChevronDown, TrendingUp,
  Activity, Droplets, Info, BarChart2,
  ArrowRight, Flame, Plus, Search,
} from "lucide-react";
import { Link } from "wouter";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectProject, flipDirection, setDirection, setInputVal, setSearch } from "@/store/slices/ammSlice";
import { useAmmData, type AmmPool } from "@/hooks/useAmmData";
import { useAmmIndexedData, type AmmChartPoint, type ChartRange } from "@/hooks/useAmmIndexedData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useWallet } from "@/hooks/useWallet";

/* ─── helpers ─── */
const fmtUSD   = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;
const fmtToken = (n: number) => n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(4);
const SLIPPAGE_BPS = 50;
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const marketProgress = (pool: AmmPool) =>
  pool.fundingGoal > 0 ? Math.min(100, (pool.totalRaised / pool.fundingGoal) * 100) : 0;
const fmtPct = (n: number) => `${n.toFixed(n >= 10 ? 0 : 1)}%`;
const fmtSignedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(Math.abs(n) >= 10 ? 1 : 2)}%`;
const currentPriceLabel = (pool?: AmmPool) =>
  pool && pool.price > 0 ? `1 ${pool.symbol} = ${fmtUSD(pool.price)} USDC` : "Price not available";
const reservePriceLabel = (pool: AmmPool) =>
  pool.poolUsdc > 0 && pool.poolCommit > 0
    ? `${fmtUSD(pool.poolUsdc)} USDC / ${fmtToken(pool.poolCommit)} ${pool.symbol}`
    : "Pool reserves are not available yet";

/* ─── ticker bar ─── */
function TickerBar({ pools }: { pools: AmmPool[] }) {
  const tradable = pools.filter((p) => p.tradable);
  if (tradable.length === 0) return null;
  return (
    <div className="w-full overflow-hidden border-b border-border bg-black/30">
      <div className="flex gap-8 px-4 py-1.5 overflow-x-auto scrollbar-none">
        {tradable.map((p) => (
          <div key={p.id} className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono font-semibold text-muted-foreground">{p.symbol}/USDC</span>
            <span className="text-[11px] font-mono font-bold text-green-400">{fmtUSD(p.price)}</span>
            <span className="text-[10px] font-mono text-green-400 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />Live
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── project selector ─── */
function ProjectSelector({
  pools, selectedId, onSelect, search, onSearchChange,
}: {
  pools: AmmPool[]; selectedId: number;
  onSelect: (id: number) => void;
  search: string; onSearchChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = pools.find((p) => p.id === selectedId) ?? pools[0];
  if (!selected) return null;

  const filtered = pools.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.symbol.toLowerCase().includes(search.toLowerCase()) ||
    String(p.id).includes(search)
  );

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); onSearchChange(""); }}
        className="flex items-center gap-2.5 bg-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/50 transition-colors w-full"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">{selected.symbol[0]}</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold leading-none truncate">{selected.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{selected.symbol} · Project #{selected.id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selected.poolUsdc > 50_000 && <Flame className="w-3 h-3 text-orange-400" />}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search by symbol or project ID..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No pools found.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); setOpen(false); onSearchChange(""); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 w-full text-left hover:bg-secondary transition-colors ${p.id === selectedId ? "bg-secondary" : ""}`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary">{p.symbol[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">Project #{p.id}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">{fmtUSD(p.poolUsdc * 2)} liquidity</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono">{fmtUSD(p.price)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-border bg-secondary/50">
            <p className="text-[10px] text-muted-foreground">{filtered.length} pool{filtered.length !== 1 ? "s" : ""} · type to filter</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PoolStat({ label, value, sub, icon, green, red }: { label: string; value: string; sub?: string; icon?: React.ReactNode; green?: boolean; red?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">{icon}{label}</div>
      <p className={`text-sm font-mono font-semibold ${green ? "text-green-400" : red ? "text-red-400" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CandlestickChart({ points, isLoading }: { points: AmmChartPoint[]; isLoading?: boolean }) {
  const candles = points.filter((p) => p.open > 0 && p.high > 0 && p.low > 0 && p.close > 0);
  const [hovered, setHovered] = useState<number | null>(null);

  if (candles.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-border/60 bg-[#090d12]">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-[10px] text-muted-foreground">Loading chart...</p>
          </div>
        ) : (
          <div className="text-center">
            <BarChart2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No market candles yet.</p>
          </div>
        )}
      </div>
    );
  }

  const W = 1000;
  const H = 360;
  const priceH = 250;
  const volumeTop = 270;
  const volumeH = 70;
  const marginT = 10;
  const plotW = W;
  const plotH = priceH - marginT;

  const bodyMin = Math.min(...candles.map((p) => Math.min(p.open, p.close)));
  const bodyMax = Math.max(...candles.map((p) => Math.max(p.open, p.close)));
  const bodyRange = Math.max(bodyMax - bodyMin, bodyMax * 0.005, 0.000001);
  const wickCap = bodyRange * 3;
  const rawMin = Math.max(Math.min(...candles.map((p) => p.low)), bodyMin - wickCap);
  const rawMax = Math.min(Math.max(...candles.map((p) => p.high)), bodyMax + wickCap);
  const rawRange = Math.max(rawMax - rawMin, rawMax * 0.01, 0.000001);
  const yPad = rawRange * 0.18;
  const minP = rawMin - yPad;
  const maxP = rawMax + yPad;
  const priceRange = maxP - minP;

  const toY = (p: number) => marginT + ((maxP - p) / priceRange) * plotH;
  const maxVolume = Math.max(...candles.map((p) => p.volumeUsdc), 0.000001);
  const toVolumeH = (v: number) => Math.max(1, (v / maxVolume) * volumeH);

  const maxSlot = candles.length <= 8 ? 30 : 24;
  const rawSlot = plotW / Math.max(candles.length, 1);
  const candleSlot = Math.min(rawSlot, maxSlot);
  const candleW = Math.max(3, Math.min(7, candleSlot * 0.3));
  const groupW = candleSlot * candles.length;
  const offsetX = (plotW - groupW) / 2;

  const LABEL_W = 58;
  const gridLines = [0, 1, 2, 3, 4].map((i) => ({
    pct: i / 4,
    price: maxP - (i / 4) * priceRange,
  }));
  const latest = candles[candles.length - 1];
  const first = candles[0];
  const changePct = first.open > 0 ? ((latest.close - first.open) / first.open) * 100 : 0;
  const activeIndex = hovered ?? candles.length - 1;
  const activeCandle = candles[activeIndex];
  const activeX = offsetX + candleSlot * activeIndex + candleSlot / 2;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-[#090d12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-black/25 px-3 py-2 text-[10px] font-mono min-h-[34px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">{fmtDateTime(activeCandle.ts)}</span>
          <span className="text-muted-foreground">O <span className="text-foreground">{fmtUSD(activeCandle.open)}</span></span>
          <span className="text-muted-foreground">H <span className="text-emerald-400">{fmtUSD(activeCandle.high)}</span></span>
          <span className="text-muted-foreground">L <span className="text-rose-400">{fmtUSD(activeCandle.low)}</span></span>
          <span className="text-muted-foreground">C <span className="text-foreground">{fmtUSD(activeCandle.close)}</span></span>
          <span className="text-muted-foreground">V <span className="text-foreground">{fmtUSD(activeCandle.volumeUsdc)}</span></span>
        </div>
        <span className={`font-semibold ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {fmtSignedPct(changePct)}
        </span>
      </div>

      <div className="flex" style={{ height: H }}>
        <div className="shrink-0 border-r border-border/30" style={{ width: LABEL_W }}>
          <div className="flex flex-col justify-between py-[10px]" style={{ height: priceH }}>
            {gridLines.map(({ price }, i) => (
              <span key={i} className="block pr-2 text-right text-[9px] font-mono leading-none text-slate-500">
                {fmtUSD(price)}
              </span>
            ))}
          </div>
          <div className="border-t border-border/30 pt-2 pr-2 text-right text-[9px] font-mono text-slate-500">Vol</div>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full flex-1"
          preserveAspectRatio="none"
          onMouseLeave={() => setHovered(null)}
        >
          {gridLines.map(({ pct }, i) => {
            const yy = marginT + pct * plotH;
            return (
              <line key={i} x1={0} x2={W} y1={yy} y2={yy} stroke="rgba(148,163,184,0.18)" strokeWidth="0.8" strokeDasharray="4,5" />
            );
          })}
          <line x1={0} x2={W} y1={volumeTop - 8} y2={volumeTop - 8} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />

          {candles.map((point, i) => {
            const cx = offsetX + candleSlot * i + candleSlot / 2;
            const up = point.close >= point.open;
            const color = up ? "#22c55e" : "#ef4444";
            const bodyTop = toY(Math.max(point.open, point.close));
            const bodyBottom = toY(Math.min(point.open, point.close));
            const bh = Math.max(2, bodyBottom - bodyTop);
            const isHov = hovered === i;
            const volH = toVolumeH(point.volumeUsdc);
            return (
              <g key={`${point.ts}-${i}`} onMouseEnter={() => setHovered(i)} style={{ cursor: "crosshair" }}>
                <rect x={cx - candleW / 2} y={volumeTop + volumeH - volH} width={candleW} height={volH} rx="1" fill={up ? "rgba(34,197,94,0.24)" : "rgba(239,68,68,0.24)"} />
                {isHov && (
                  <line x1={cx} x2={cx} y1={marginT} y2={volumeTop + volumeH} stroke="rgba(226,232,240,0.55)" strokeWidth="0.8" strokeDasharray="3,3" />
                )}
                <line x1={cx} x2={cx} y1={toY(point.high)} y2={toY(point.low)} stroke={color} strokeWidth="1.5" />
                <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bh} rx="1.5" fill={up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.16)"} stroke={color} strokeWidth={isHov ? 2 : 1.4} />
                <rect x={cx - candleSlot / 2} y={marginT} width={candleSlot} height={volumeTop + volumeH - marginT} fill="transparent" />
              </g>
            );
          })}

          <line x1={0} x2={W} y1={toY(activeCandle.close)} y2={toY(activeCandle.close)} stroke="rgba(226,232,240,0.45)" strokeWidth="0.8" strokeDasharray="3,3" />
          <rect x={Math.min(W - 86, activeX + 8)} y={Math.max(2, toY(activeCandle.close) - 10)} width="78" height="20" rx="4" fill="rgba(15,23,42,0.92)" stroke="rgba(148,163,184,0.25)" />
          <text x={Math.min(W - 47, activeX + 47)} y={Math.max(15, toY(activeCandle.close) + 4)} textAnchor="middle" fontSize="10" fill="#e2e8f0" fontFamily="monospace">
            {fmtUSD(activeCandle.close)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function MarketStatus({ pool }: { pool: AmmPool }) {
  const tone = pool.tradable
    ? "bg-green-500/10 border-green-500/30 text-green-400"
    : pool.blockReason === "Needs AMM liquidity" || pool.blockReason === "Pool has no reserves"
    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
    : "bg-blue-500/10 border-blue-500/30 text-blue-400";

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${pool.tradable ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
      <span className="truncate">{pool.tradable ? "Live" : pool.blockReason}</span>
    </span>
  );
}

function MarketWatchlist({
  markets,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  markets: AmmPool[];
  selectedId: number;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = markets.filter((pool) =>
    pool.name.toLowerCase().includes(search.toLowerCase()) ||
    pool.symbol.toLowerCase().includes(search.toLowerCase()) ||
    String(pool.id).includes(search)
  );

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Market Watchlist</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Project CommitToken markets, priced by live AMM reserves when liquidity exists.
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
                      selectedId === pool.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                          {pool.symbol.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{pool.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground font-mono">
                            {pool.symbol}/USDC · #{pool.id}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p className={pool.price > 0 ? "text-green-400 font-semibold" : ""}>
                        {pool.price > 0 ? `1 ${pool.symbol} = ${fmtUSD(pool.price)}` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">USDC per token</p>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p>{fmtUSD(pool.totalRaised)}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtPct(progress)} funded</p>
                    </div>
                    <div className="col-span-2 self-center text-right font-mono">
                      <p>{fmtUSD(pool.poolUsdc)} USDC</p>
                      <p className="text-[10px] text-muted-foreground">{fmtToken(pool.poolCommit)} {pool.symbol}</p>
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

function MarketPreview({ pool, role }: { pool?: AmmPool; role?: string }) {
  if (!pool) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5 text-center">
          <p className="text-sm font-semibold">No markets discovered</p>
          <p className="text-xs text-muted-foreground mt-1">Create or approve projects to make them visible here.</p>
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
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selected Market</p>
            <h2 className="mt-1 truncate text-lg font-semibold">{pool.name}</h2>
            <p className="text-[11px] text-muted-foreground">{pool.symbol}/USDC · Project #{pool.id}</p>
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
          <PoolStat label="Raised" value={fmtUSD(pool.totalRaised)} sub={`${fmtUSD(pool.fundingGoal)} goal`} />
          <PoolStat label="Starting Price" value={pool.price > 0 ? fmtUSD(pool.price) : "Not priced"} sub={`for tiny ${pool.symbol} trades`} />
          <PoolStat label="USDC Reserve" value={fmtUSD(pool.poolUsdc)} sub="AMM pool" />
          <PoolStat label={`${pool.symbol} Reserve`} value={fmtToken(pool.poolCommit)} sub="AMM pool" />
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pool starting price</p>
          <p className="mt-1 font-mono text-base font-semibold">{currentPriceLabel(pool)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Calculated from reserves: {reservePriceLabel(pool)}. Large swaps move this price.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">USDC Liquidity</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fmtUSD(pool.poolUsdc)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Token Liquidity</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fmtToken(pool.poolCommit)} {pool.symbol}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Trading state</span>
            <span className="font-mono text-foreground">{pool.tradable ? "Open" : "Waiting"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>Graph status</span>
            <span className="font-mono text-foreground">{pool.indexed ? "Indexed" : "Not indexed"}</span>
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

function MarketRequirements({ pool }: { pool?: AmmPool }) {
  const checks = [
    { label: "Funding goal met", done: !!pool?.goalMet },
    { label: "Funding closed", done: !!pool?.fundingClosed },
    { label: "AMM liquidity seeded", done: !!pool?.seeded },
    { label: "Pool reserves available", done: !!pool && pool.poolUsdc > 0 && pool.poolCommit > 0 },
  ];

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Market Open Checklist</p>
        <div className="mt-3 space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{check.label}</span>
              <span className={`font-mono ${check.done ? "text-green-400" : "text-yellow-400"}`}>
                {check.done ? "Ready" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── main ─── */
export default function AMM() {
  const dispatch = useAppDispatch();
  const { role } = useWallet();
  const selectedProjectId = useAppSelector((s) => s.amm.selectedProjectId);
  const direction         = useAppSelector((s) => s.amm.direction);
  const inputVal          = useAppSelector((s) => s.amm.inputVal);
  const search            = useAppSelector((s) => s.amm.search);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  /* ── contract data & actions ── */
  const {
    pools, projectCount, pool, feeBps,
    usdcBal, commitBal,
    outputNum, minReceived, impact,
    isWriting, isTxPending, isTxSuccess,
    writeError, isConnected,
    lastAction,
    needsUsdcApproval, needsCommitApproval, hasEnoughInputBalance, canSellSelectedPool,
    swap: handleSwap,
  } = useAmmData(selectedProjectId, direction, inputVal);
  const [chartRange, setChartRange] = useState<ChartRange>("1H");
  const { chartPoints, recentTrades, loading: indexedLoading, error: indexedError } =
    useAmmIndexedData(pool?.id ?? selectedProjectId, chartRange);
  const marketList = pools;
  const selectedMarket = marketList.find((candidate) => candidate.id === selectedProjectId) ?? marketList[0];
  const indexedMarketCount = pools.filter((candidate) => candidate.indexed).length;

  const inputNum    = parseFloat(inputVal) || 0;
  const impactColor = impact < 1 ? "text-green-400" : impact < 3 ? "text-yellow-400" : "text-red-400";
  const fromLabel   = direction === "buy" ? "USDC" : (pool?.symbol ?? "NST");
  const toLabel     = direction === "buy" ? (pool?.symbol ?? "NST") : "USDC";
  const userBalance = direction === "buy" ? usdcBal : commitBal;
  const executionPrice = inputNum > 0 && outputNum > 0
    ? direction === "buy"
      ? inputNum / outputNum
      : outputNum / inputNum
    : 0;
  const tradeVsPoolPct = pool && inputNum > 0
    ? (inputNum / Math.max(direction === "buy" ? pool.poolUsdc : pool.poolCommit, 0.000001)) * 100
    : 0;
  const chartFirst = chartPoints[0];
  const chartLast = chartPoints[chartPoints.length - 1];
  const chartChangePct = chartFirst && chartLast && chartFirst.open > 0
    ? ((chartLast.close - chartFirst.open) / chartFirst.open) * 100
    : 0;
  /* ── button label ── */
  function swapButtonLabel() {
    if (!isConnected)             return "Connect wallet to swap";
    if (!pool)                    return "No pools available";
    if (direction === "sell" && !canSellSelectedPool) return `No ${pool.symbol} to sell`;
    if (inputNum <= 0)            return "Enter an amount";
    if (!hasEnoughInputBalance)   return `Insufficient ${fromLabel} balance`;
    if (isTxPending || isWriting) {
      if (lastAction === "approve-usdc") return "Approving USDC…";
      if (lastAction === "approve-commit") return "Approving CommitToken…";
      return "Confirming swap…";
    }
    if (isTxSuccess && lastAction === "swap") return "Swap successful!";
    if (needsUsdcApproval)        return "Step 1: Approve USDC";
    if (needsCommitApproval)      return "Step 1: Approve CommitToken";
    return <>{direction === "buy" ? "Buy" : "Sell"} {pool.symbol} <ArrowRight className="w-4 h-4" /> {toLabel}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0 cursor-pointer">
            <span className="font-bold text-sm">Raise</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets",  href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio",href: "/portfolio" },
              { label: "My Projects", href: "/my-projects" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${l.href === "/amm" ? "bg-secondary text-foreground" : ""}`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 hidden sm:flex"
              onClick={() => setShowSubmitModal(true)}
            >
              <Plus className="w-3.5 h-3.5" /> List Project
            </Button>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <TickerBar pools={pools} />
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">Decentralised Exchange</p>
            <h1 className="text-2xl font-bold">Market Place</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trade project CommitTokens against USDC. Constant-product AMM with live pool pricing.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live · Sepolia
          </div>
        </div>

        {pools.length === 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Projects", value: projectCount },
                { label: "Available", value: pools.length },
                { label: "Tradable", value: pools.length },
                { label: "Indexed", value: indexedMarketCount },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <MarketWatchlist
                markets={marketList}
                selectedId={selectedMarket?.id ?? selectedProjectId}
                onSelect={(id) => dispatch(selectProject(id))}
                search={search}
                onSearchChange={(v) => dispatch(setSearch(v))}
              />
              <div className="space-y-4">
                <MarketPreview pool={selectedMarket} role={role} />
                <MarketRequirements pool={selectedMarket} />
              </div>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">No tradable pools yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only funded, closed, and seeded project pools are shown on AMM Swap.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    Market data is live from Sepolia
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── FULL WIDTH: project selector ── */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Select Project Pool</p>
                <ProjectSelector
                  pools={pools}
                  selectedId={selectedProjectId}
                  onSelect={(id) => dispatch(selectProject(id))}
                  search={search}
                  onSearchChange={(v) => dispatch(setSearch(v))}
                />
                {pool && (
                  <div className="grid gap-3 pt-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pool starting price</p>
                      <p className="mt-1 font-mono text-2xl font-bold">{currentPriceLabel(pool)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        This is the price for a tiny trade. Larger buys move along the AMM curve.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          USDC liquidity{" "}
                          <span className="font-mono text-foreground">{fmtUSD(pool.poolUsdc)}</span>
                        </span>
                        <span>
                          Token liquidity{" "}
                          <span className="font-mono text-foreground">{fmtToken(pool.poolCommit)} {pool.symbol}</span>
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      pool.indexed
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                    }`}>
                      {pool.indexed ? "Graph indexed" : "Live only"}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── FULL WIDTH: chart ── */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold font-mono">{pool?.symbol ?? "—"}/USDC</p>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Price Chart</span>
                </div>
                <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
                  {(["1H", "6H", "1D", "1W"] as const).map((t) => {
                    const label = t === "1H" ? "24H" : t === "6H" ? "3D" : t === "1D" ? "7D" : "ALL";
                    return (
                      <button
                        key={t}
                        onClick={() => setChartRange(t)}
                        className={`text-[10px] px-2.5 py-1 rounded transition-colors font-mono ${
                          t === chartRange
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <CardContent className="p-4 pt-3">
                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { label: "Starting Price", value: pool ? currentPriceLabel(pool) : "—", tone: "text-foreground" },
                    { label: "Range Change", value: chartPoints.length ? fmtSignedPct(chartChangePct) : "—", tone: chartChangePct >= 0 ? "text-emerald-400" : "text-rose-400" },
                    { label: "USDC Liquidity", value: pool ? fmtUSD(pool.poolUsdc) : "—", tone: "text-foreground" },
                    { label: "Token Liquidity", value: pool ? `${fmtToken(pool.poolCommit)} ${pool.symbol}` : "—", tone: "text-foreground" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                      <p className={`mt-1 truncate font-mono text-sm font-semibold ${stat.tone}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
                <CandlestickChart points={chartPoints} isLoading={indexedLoading && chartPoints.length === 0} />
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                  {indexedLoading && chartPoints.length === 0
                    ? "Syncing candle data from subgraph..."
                    : indexedError
                    ? "Subgraph unavailable."
                    : chartPoints.length === 0
                    ? "No candles yet — make a swap to generate chart data."
                    : `${chartPoints.length} candle${chartPoints.length !== 1 ? "s" : ""} · ${chartRange} view`}
                </p>
              </CardContent>
            </Card>

            {/* ── BOTTOM: swap left + trade history right ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── LEFT: swap card ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* swap interface */}
              {pool && (
                <Card className="bg-card border-border overflow-hidden">
                  {/* Exchange-style buy/sell tab header */}
                  <div className="grid grid-cols-2">
                    {(["buy", "sell"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => dispatch(setDirection(mode))}
                        className={`py-3 text-sm font-bold transition-all border-b-2 ${
                          direction === mode
                            ? mode === "buy"
                              ? "border-green-400 bg-green-500/10 text-green-300"
                              : "border-red-400 bg-red-500/10 text-red-300"
                            : "border-transparent text-muted-foreground hover:text-foreground bg-black/20"
                        }`}
                      >
                        {mode === "buy" ? `▲ Buy ${pool.symbol}` : `▼ Sell ${pool.symbol}`}
                      </button>
                    ))}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          direction === "buy" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>{direction === "buy" ? "Market Buy" : "Market Sell"}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono border border-border">
                        Fee: {feeBps / 100}%
                      </span>
                    </div>

                    {direction === "sell" && commitBal <= 0 && (
                      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-300">
                        You do not hold {pool.symbol} for this project yet. Buy from the pool first or select a project token you already own.
                      </div>
                    )}

                    {(needsUsdcApproval || needsCommitApproval) && inputNum > 0 && (
                      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-300">
                        First approve the AMM to use your {fromLabel}. After that confirms, the same button will send the {direction} transaction.
                      </div>
                    )}

                    {!needsUsdcApproval && !needsCommitApproval && inputNum > 0 && (
                      <div className="rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] text-green-300">
                        Approval is ready. The next wallet confirmation will execute the {direction}.
                      </div>
                    )}

                    {/* from */}
                    <div className={`rounded-lg p-3 space-y-1.5 border ${
                      direction === "buy" ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {direction === "buy" ? "You pay" : `You sell`}
                        </span>
                        <button
                          className="text-[11px] text-primary hover:underline font-mono"
                          onClick={() => dispatch(setInputVal(userBalance.toFixed(6)))}
                        >
                          Max: {fmtToken(userBalance)} {fromLabel}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={inputVal}
                          onChange={(e) => dispatch(setInputVal(e.target.value))}
                          className="flex-1 bg-transparent text-2xl font-mono font-bold outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 shrink-0">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-primary">{fromLabel[0]}</span>
                          </div>
                          <span className="text-sm font-bold">{fromLabel}</span>
                        </div>
                      </div>
                      {/* % buttons */}
                      <div className="flex gap-1.5 pt-0.5">
                        {[25, 50, 75, 100].map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={userBalance <= 0}
                            className="flex-1 text-[10px] py-1 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-mono"
                            onClick={() => dispatch(setInputVal(((userBalance * p) / 100).toFixed(6)))}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* flip */}
                    <div className="flex justify-center -my-1">
                      <button
                        onClick={() => dispatch(flipDirection())}
                        className="p-2 rounded-full bg-card border border-border hover:border-primary/50 transition-all text-muted-foreground hover:text-foreground group shadow-sm"
                      >
                        <ArrowUpDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                      </button>
                    </div>

                    {/* to */}
                    <div className="bg-secondary/60 border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {direction === "buy" ? `You receive` : "You receive"}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Bal: {fmtToken(direction === "buy" ? commitBal : usdcBal)} {toLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex-1 text-2xl font-mono font-bold ${
                          outputNum > 0 ? (direction === "buy" ? "text-green-400" : "text-red-400") : "text-muted-foreground/30"
                        }`}>
                          {outputNum > 0 ? fmtToken(outputNum) : "0.00"}
                        </span>
                        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 shrink-0">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-primary">{toLabel[0]}</span>
                          </div>
                          <span className="text-sm font-bold">{toLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* swap details */}
                    {outputNum > 0 && (
                      <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-[11px]">
                        <div className="rounded-md border border-border bg-card/80 p-2">
                          <div className="flex justify-between gap-3 text-muted-foreground">
                            <span>Pool starting price</span>
                            <span className="font-mono text-foreground">{currentPriceLabel(pool)}</span>
                          </div>
                          <div className="mt-1 flex justify-between gap-3 text-muted-foreground">
                            <span>Average price for this swap</span>
                            <span className={`font-mono font-semibold ${impact >= 5 ? "text-red-400" : "text-foreground"}`}>
                              {fmtUSD(executionPrice)} per {pool.symbol}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{direction === "buy" ? "USDC entering pool" : `${pool.symbol} entering pool`}</span>
                          <span className="font-mono text-foreground">{tradeVsPoolPct.toFixed(1)}% of current reserve</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Price impact</span>
                          <span className={`font-mono font-semibold ${impactColor}`}>{impact.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Min. received ({SLIPPAGE_BPS / 100}% slippage)</span>
                          <span className="font-mono text-foreground">{fmtToken(minReceived)} {toLabel}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Fee ({feeBps / 100}%)</span>
                          <span className="font-mono text-foreground">{fmtUSD(inputNum * feeBps / 10_000)} {fromLabel}</span>
                        </div>
                      </div>
                    )}

                    {impact >= 5 && (
                      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-400">
                          High price impact ({impact.toFixed(1)}%). The pool only has {fmtUSD(pool.poolUsdc)} USDC and {fmtToken(pool.poolCommit)} {pool.symbol}, so this trade moves far beyond the starting price.
                        </p>
                      </div>
                    )}

                    {writeError && (
                      <p className="text-[11px] text-red-400 text-center">{writeError.message.slice(0, 80)}</p>
                    )}

                    {!hasEnoughInputBalance && inputNum > 0 && (
                      <p className="text-[11px] text-red-400 text-center">
                        Your wallet only has {fmtToken(userBalance)} {fromLabel}.
                      </p>
                    )}

                    <Button
                      className={`w-full h-12 text-sm font-bold gap-2 transition-all ${
                        direction === "buy"
                          ? "bg-green-500 hover:bg-green-400 text-black"
                          : "bg-red-500 hover:bg-red-400 text-white"
                      }`}
                      disabled={
                        !isConnected ||
                        !canSellSelectedPool ||
                        !hasEnoughInputBalance ||
                        inputNum <= 0 ||
                        isWriting ||
                        isTxPending
                      }
                      onClick={handleSwap}
                    >
                      {swapButtonLabel()}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── RIGHT: trade history ── */}
            <div className="lg:col-span-3 space-y-4">

              {/* trade history — exchange order-log style */}
              <Card className="bg-card border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 bg-muted/40 flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" /> Trade History
                  </p>
                  <span className="text-[10px] text-muted-foreground font-mono">{recentTrades.length} txns indexed</span>
                </div>
                {/* column headers */}
                <div className="grid grid-cols-12 gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-secondary/30">
                  <span className="col-span-2">Side</span>
                  <span className="col-span-3">Address</span>
                  <span className="col-span-2 text-right">USDC</span>
                  <span className="col-span-2 text-right">Tokens</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-1 text-right">Time</span>
                </div>
                <CardContent className="p-0">
                  {indexedLoading && recentTrades.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">Syncing trade history...</p>
                  ) : recentTrades.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">No trades indexed yet. Make a swap to see history.</p>
                  ) : (
                    <div>
                      {recentTrades.slice(0, 15).map((t, idx) => {
                        const isBuy = t.side === "BUY";
                        const isSell = t.side === "SELL";
                        const tone = isBuy ? "text-green-400" : isSell ? "text-red-400" : t.side === "SEED" ? "text-blue-400" : "text-yellow-400";
                        const bgTone = isBuy ? "hover:bg-green-500/5" : isSell ? "hover:bg-red-500/5" : "hover:bg-secondary/40";
                        const actor = t.user === "0x0000000000000000000000000000000000000000"
                          ? "protocol"
                          : `${t.user.slice(0, 6)}…${t.user.slice(-4)}`;

                        return (
                          <div
                            key={t.id}
                            className={`grid grid-cols-12 gap-2 items-center px-4 py-2 text-[11px] border-b border-border/20 transition-colors ${bgTone} ${idx % 2 === 0 ? "" : "bg-secondary/10"}`}
                          >
                            <span className={`col-span-2 font-bold font-mono ${tone}`}>
                              {isBuy ? "▲ BUY" : isSell ? "▼ SELL" : t.side === "LIQUIDITY_REMOVED" ? "REMOVE" : t.side}
                            </span>
                            <span className="col-span-3 font-mono truncate text-muted-foreground text-[10px]">{actor}</span>
                            <span className="col-span-2 text-right font-mono">{fmtUSD(t.usdcAmount)}</span>
                            <span className={`col-span-2 text-right font-mono ${tone}`}>{fmtToken(t.commitAmount)}</span>
                            <span className="col-span-2 text-right font-mono">{t.price > 0 ? fmtUSD(t.price) : "—"}</span>
                            <span className="col-span-1 text-right text-muted-foreground text-[10px]">{fmtTime(t.timestamp)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Raise</span>
          <span>Ethereum Sepolia</span>
        </div>
      </footer>
      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
