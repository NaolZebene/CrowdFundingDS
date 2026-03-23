import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown, ChevronDown,
  Activity, Droplets, Zap, Info, Clock, BarChart2,
  ArrowRight, Flame, Landmark, Plus, Search,
} from "lucide-react";
import { Link } from "wouter";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectProject, flipDirection, setInputVal, setSearch } from "@/store/slices/ammSlice";
import { useAmmData, type AmmPool } from "@/hooks/useAmmData";
import { useAmmIndexedData, type ChartRange } from "@/hooks/useAmmIndexedData";
import { SubmitProjectModal } from "@/components/SubmitProjectModal";
import { useWallet } from "@/hooks/useWallet";

/* ─── helpers ─── */
const fmtUSD   = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;
const fmtToken = (n: number) => n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(4);
const SLIPPAGE_BPS = 50;
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

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
          <p className="text-xs font-semibold leading-none">{selected.symbol}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Project #{selected.id}</p>
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
                      <span className="text-xs font-semibold">{p.symbol}</span>
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

function PoolStat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">{icon}{label}</div>
      <p className="text-sm font-mono font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
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
    pools, pool, feeBps,
    usdcBal, commitBal,
    outputNum, minReceived, impact,
    isWriting, isTxPending, isTxSuccess,
    writeError, isConnected,
    needsUsdcApproval, needsCommitApproval,
    swap: handleSwap,
  } = useAmmData(selectedProjectId, direction, inputVal);
  const [chartRange, setChartRange] = useState<ChartRange>("1D");
  const { chartPoints, recentTrades, loading: indexedLoading, error: indexedError } =
    useAmmIndexedData(pool?.id ?? selectedProjectId, chartRange);

  const chartPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const min = Math.min(...chartPoints.map((p) => p.close));
    const max = Math.max(...chartPoints.map((p) => p.close));
    const range = Math.max(max - min, 0.000001);
    return chartPoints
      .map((p, i) => {
        const x = (i / (chartPoints.length - 1)) * 600;
        const y = 120 - ((p.close - min) / range) * 90;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [chartPoints]);

  const inputNum    = parseFloat(inputVal) || 0;
  const impactColor = impact < 1 ? "text-green-400" : impact < 3 ? "text-yellow-400" : "text-red-400";
  const fromLabel   = direction === "buy" ? "USDC" : (pool?.symbol ?? "NST");
  const toLabel     = direction === "buy" ? (pool?.symbol ?? "NST") : "USDC";
  const userBalance = direction === "buy" ? usdcBal : commitBal;

  /* ── button label ── */
  function swapButtonLabel() {
    if (!isConnected)             return "Connect wallet to swap";
    if (!pool)                    return "No pools available";
    if (inputNum <= 0)            return "Enter an amount";
    if (isTxPending || isWriting) return "Confirming…";
    if (isTxSuccess)              return "Swap successful!";
    if (needsUsdcApproval)        return "Approve USDC";
    if (needsCommitApproval)      return "Approve CommitToken";
    return <>{`Swap ${fromLabel}`} <ArrowRight className="w-4 h-4" /> {toLabel}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0 cursor-pointer">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Landmark className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-wide">CrowdVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets",  href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio",href: "/portfolio" },
              { label: "Governance",href: "/governance" },
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

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">CommitToken AMM</p>
          <h1 className="text-2xl font-bold">Swap CommitTokens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trade project CommitTokens against USDC using the constant-product AMM.
          </p>
        </div>

        {pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Droplets className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-semibold">No pools seeded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Pools are seeded by the admin after projects are approved.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── LEFT: swap card ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* project selector */}
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
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xl font-mono font-bold">{fmtUSD(pool.price)}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">per {pool.symbol}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* swap interface */}
              {pool && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">Swap</p>
                      <button className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                        {feeBps / 100}% fee
                      </button>
                    </div>

                    {/* from */}
                    <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-muted-foreground">You pay</span>
                        <span className="text-[11px] text-muted-foreground">
                          Balance: {fmtToken(userBalance)} {fromLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={inputVal}
                          onChange={(e) => dispatch(setInputVal(e.target.value))}
                          className="flex-1 bg-transparent text-xl font-mono font-semibold outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1.5 shrink-0">
                          <span className="text-sm font-semibold">{fromLabel}</span>
                        </div>
                      </div>
                      {/* % buttons */}
                      <div className="flex gap-1.5 pt-0.5">
                        {[25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            className="text-[10px] px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-mono"
                            onClick={() => dispatch(setInputVal(((userBalance * pct) / 100).toFixed(6)))}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* flip */}
                    <div className="flex justify-center -my-1">
                      <button
                        onClick={() => dispatch(flipDirection())}
                        className="p-2 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-all text-muted-foreground hover:text-foreground group"
                      >
                        <ArrowUpDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                      </button>
                    </div>

                    {/* to */}
                    <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-muted-foreground">You receive</span>
                        <span className="text-[11px] text-muted-foreground">
                          Balance: {fmtToken(direction === "buy" ? commitBal : usdcBal)} {toLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex-1 text-xl font-mono font-semibold ${outputNum > 0 ? "text-green-400" : "text-muted-foreground/40"}`}>
                          {outputNum > 0 ? fmtToken(outputNum) : "0.00"}
                        </span>
                        <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1.5 shrink-0">
                          <span className="text-sm font-semibold">{toLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* swap details */}
                    {outputNum > 0 && (
                      <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-[11px]">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Effective price</span>
                          <span className="font-mono text-foreground">1 {toLabel} = {fmtUSD(inputNum / outputNum)} {fromLabel}</span>
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
                        <p className="text-[11px] text-red-400">High price impact ({impact.toFixed(1)}%). Consider reducing your swap size.</p>
                      </div>
                    )}

                    {writeError && (
                      <p className="text-[11px] text-red-400 text-center">{writeError.message.slice(0, 80)}</p>
                    )}

                    <Button
                      className="w-full h-11 text-sm font-semibold gap-2"
                      disabled={!isConnected || inputNum <= 0 || isWriting || isTxPending}
                      onClick={handleSwap}
                    >
                      {swapButtonLabel()}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── RIGHT: pool info ── */}
            <div className="lg:col-span-3 space-y-4">

              {pool && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Pool Statistics — {pool.symbol}/USDC
                      </p>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Zap className="w-2.5 h-2.5" /> Live
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <PoolStat label="Liquidity"    value={fmtUSD(pool.poolUsdc * 2)}   sub="USDC + tokens"   icon={<Droplets className="w-3 h-3" />} />
                      <PoolStat label="Pool USDC"    value={fmtUSD(pool.poolUsdc)}                              icon={<Activity  className="w-3 h-3" />} />
                      <PoolStat label={`Pool ${pool.symbol}`} value={fmtToken(pool.poolCommit)}                 icon={<BarChart2 className="w-3 h-3" />} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* chart */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">{pool?.symbol ?? "—"}/USDC</p>
                    <div className="flex items-center gap-1">
                      {(["1H", "6H", "1D", "1W"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartRange(t)}
                          className={`text-[10px] px-2 py-1 rounded transition-colors font-mono ${t === chartRange ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-40 w-full relative">
                    <svg viewBox="0 0 600 140" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {chartPath ? (
                        <>
                          <path d={chartPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                          <path d={`${chartPath} L600,140 L0,140 Z`} fill="url(#chartGrad)" />
                        </>
                      ) : (
                        <line x1="0" y1="100" x2="600" y2="100" stroke="hsl(var(--border))" strokeWidth="1" />
                      )}
                    </svg>
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground mt-2">
                    {indexedLoading
                      ? "Loading indexed price data..."
                      : indexedError
                      ? "Subgraph unavailable. Showing fallback state."
                      : chartPoints.length === 0
                      ? "No indexed price data yet for this range."
                      : `${chartPoints.length} data point${chartPoints.length !== 1 ? "s" : ""}`}
                  </p>
                </CardContent>
              </Card>

              {/* recent trades */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5" /> Recent Trades
                  </p>
                  {indexedLoading ? (
                    <p className="text-center text-xs text-muted-foreground py-6">Loading indexed trades...</p>
                  ) : recentTrades.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">No indexed trades yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recentTrades.slice(0, 8).map((t) => (
                        <div
                          key={t.id}
                          className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded bg-secondary/40 text-[11px]"
                        >
                          <span className={`col-span-2 font-semibold ${t.side === "BUY" ? "text-green-400" : "text-yellow-400"}`}>
                            {t.side}
                          </span>
                          <span className="col-span-4 font-mono truncate text-muted-foreground">
                            {t.user.slice(0, 6)}...{t.user.slice(-4)}
                          </span>
                          <span className="col-span-3 text-right font-mono">{fmtToken(t.commitAmount)}</span>
                          <span className="col-span-2 text-right font-mono">{fmtUSD(t.price)}</span>
                          <span className="col-span-1 text-right text-muted-foreground">{fmtTime(t.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* info cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: <Droplets className="w-4 h-4 text-blue-400" />,  title: "Constant-Product Formula",   body: "Price is determined by x·y=k. Larger swaps move price more. Always check your price impact before swapping." },
                  { icon: <Zap      className="w-4 h-4 text-yellow-400" />, title: "Instant Liquidity Exit",     body: "CommitTokens are ERC-1155. Sell your position at any time — no lockup, no waiting for milestones." },
                ].map((item) => (
                  <div key={item.title} className="bg-card border border-border rounded-lg p-4 flex gap-3">
                    <div className="p-2 rounded-lg bg-secondary h-fit">{item.icon}</div>
                    <div>
                      <p className="text-xs font-semibold mb-1">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Landmark className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">CrowdVault</span>
            <span>— Ethereum Sepolia testnet</span>
          </div>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            All systems operational
          </span>
        </div>
      </footer>
      <SubmitProjectModal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
}
