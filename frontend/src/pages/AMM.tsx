import { useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Activity,
  Droplets,
  Zap,
  Info,
  Clock,
  BarChart2,
  ArrowRight,
  Flame,
  Landmark,
  Plus,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectProject, flipDirection, setInputVal, setSearch } from "@/store/slices/ammSlice";
import type { AmmProject } from "@/store/slices/ammSlice";
import { useState } from "react";

/* ─── helpers ─── */
const fmtUSD = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtToken = (n: number) => (n >= 1_000 ? `${(n / 1_000).toFixed(2)}K` : n.toFixed(4));
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/* ─── static data ─── */
const RECENT_TRADES = [
  { type: "buy",  from: "0x1a2b", amount: 540,   tokens: 293.5, price: 1.840, time: new Date(Date.now() - 12000) },
  { type: "sell", from: "0xf3c9", amount: 120,   tokens: 66.1,  price: 1.815, time: new Date(Date.now() - 47000) },
  { type: "buy",  from: "0x88da", amount: 2200,  tokens: 1195.6,price: 1.840, time: new Date(Date.now() - 95000) },
  { type: "buy",  from: "0x5531", amount: 310,   tokens: 168.5, price: 1.839, time: new Date(Date.now() - 143000) },
  { type: "sell", from: "0xbba1", amount: 800,   tokens: 441.1, price: 1.812, time: new Date(Date.now() - 210000) },
  { type: "buy",  from: "0x22fd", amount: 90,    tokens: 48.9,  price: 1.840, time: new Date(Date.now() - 285000) },
  { type: "sell", from: "0x77ce", amount: 1600,  tokens: 883.0, price: 1.812, time: new Date(Date.now() - 360000) },
  { type: "buy",  from: "0x4411", amount: 450,   tokens: 244.6, price: 1.839, time: new Date(Date.now() - 440000) },
];

/* ─── constant product AMM math ─── */
function calcOut(amountIn: number, reserveIn: number, reserveOut: number, feeBps: number) {
  const fee = feeBps / 10_000;
  const inAfterFee = amountIn * (1 - fee);
  return (inAfterFee * reserveOut) / (reserveIn + inAfterFee);
}

function priceImpact(amountIn: number, reserveIn: number) {
  return (amountIn / (reserveIn + amountIn)) * 100;
}

/* ─── project selector dropdown ─── */
function ProjectSelector({
  projects,
  selected,
  onSelect,
  search,
  onSearchChange,
}: {
  projects: AmmProject[];
  selected: AmmProject;
  onSelect: (p: AmmProject) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  function handleOpen() {
    setOpen((o) => !o);
    onSearchChange("");
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2.5 bg-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/50 transition-colors w-full"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">{selected.symbol[0]}</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold leading-none">{selected.symbol}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-none truncate max-w-[140px]">
            {selected.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selected.hot && <Flame className="w-3 h-3 text-orange-400" />}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {/* search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search by name, symbol or category..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* results */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No pools found.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p); setOpen(false); onSearchChange(""); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 w-full text-left hover:bg-secondary transition-colors ${
                    p.id === selected.id ? "bg-secondary" : ""
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary">{p.symbol[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{p.symbol}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{p.name}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">{p.category}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono">{fmtUSD(p.price)}</p>
                    <p className={`text-[10px] font-mono ${p.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.change24h >= 0 ? "+" : ""}{p.change24h}%
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* footer hint */}
          <div className="px-3 py-1.5 border-t border-border bg-secondary/50">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} pool{filtered.length !== 1 ? "s" : ""} · type to filter
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── stat cell ─── */
function PoolStat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-sm font-mono font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ─── main ─── */
export default function AMM() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((s) => s.amm.projects);
  const selectedProjectId = useAppSelector((s) => s.amm.selectedProjectId);
  const direction = useAppSelector((s) => s.amm.direction);
  const inputVal = useAppSelector((s) => s.amm.inputVal);
  const search = useAppSelector((s) => s.amm.search);

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const inputNum = parseFloat(inputVal) || 0;
  const reserveIn  = direction === "buy" ? project.poolUsdc   : project.poolCommit;
  const reserveOut = direction === "buy" ? project.poolCommit : project.poolUsdc;

  const outputNum = useMemo(
    () => (inputNum > 0 ? calcOut(inputNum, reserveIn, reserveOut, project.fee * 100) : 0),
    [inputNum, reserveIn, reserveOut, project.fee]
  );
  const impact = useMemo(
    () => (inputNum > 0 ? priceImpact(inputNum, reserveIn) : 0),
    [inputNum, reserveIn]
  );
  const effectivePrice = outputNum > 0 ? inputNum / outputNum : project.price;
  const minReceived = outputNum * 0.995; // 0.5% slippage

  const impactColor =
    impact < 1 ? "text-green-400" : impact < 3 ? "text-yellow-400" : "text-red-400";

  const fromLabel = direction === "buy" ? "USDC" : project.symbol;
  const toLabel   = direction === "buy" ? project.symbol : "USDC";

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
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "Governance", href: "/governance" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                  l.href === "/amm" ? "bg-secondary text-foreground" : ""
                }`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" className="h-8 px-3 text-xs gap-1.5 hidden sm:flex">
              <Plus className="w-3.5 h-3.5" /> List Project
            </Button>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">

        {/* ── page title ── */}
        <div className="mb-6">
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
            CommitToken AMM
          </p>
          <h1 className="text-2xl font-bold">Swap CommitTokens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trade project CommitTokens against USDC using the constant-product AMM.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* ── LEFT: swap card ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* project selector */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Select Project Pool
                  </p>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.5">
                    {project.category}
                  </Badge>
                </div>
                <ProjectSelector
                  projects={projects}
                  selected={project}
                  onSelect={(p) => dispatch(selectProject(p.id))}
                  search={search}
                  onSearchChange={(v) => dispatch(setSearch(v))}
                />

                {/* price row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-mono font-bold">{fmtUSD(project.price)}</span>
                    <span className={`flex items-center gap-0.5 text-xs font-mono ${project.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {project.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {project.change24h >= 0 ? "+" : ""}{project.change24h}%
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">per {project.symbol}</span>
                </div>
              </CardContent>
            </Card>

            {/* swap interface */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Swap</p>
                  <div className="flex items-center gap-1">
                    <button className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors">0.3% fee</button>
                    <button className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* from */}
                <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">You pay</span>
                    <span className="text-[11px] text-muted-foreground">Balance: —</span>
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
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-blue-400">
                          {fromLabel[0]}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">{fromLabel}</span>
                    </div>
                  </div>
                  {inputNum > 0 && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      ≈ {fmtUSD(direction === "buy" ? inputNum : inputNum * project.price)}
                    </p>
                  )}
                  <div className="flex gap-1.5 pt-0.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        className="text-[10px] px-2 py-0.5 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-mono"
                        onClick={() => dispatch(setInputVal(String(pct === 100 ? 1000 : pct * 10)))}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* flip button */}
                <div className="flex justify-center -my-1">
                  <button
                    onClick={() => dispatch(flipDirection())}
                    className="p-2 rounded-lg bg-secondary border border-border hover:border-primary/50 hover:bg-secondary/80 transition-all text-muted-foreground hover:text-foreground group"
                  >
                    <ArrowUpDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                  </button>
                </div>

                {/* to */}
                <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">You receive</span>
                    <span className="text-[11px] text-muted-foreground">Balance: —</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex-1 text-xl font-mono font-semibold ${outputNum > 0 ? "text-green-400" : "text-muted-foreground/40"}`}>
                      {outputNum > 0 ? fmtToken(outputNum) : "0.00"}
                    </span>
                    <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1.5 shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-primary">{toLabel[0]}</span>
                      </div>
                      <span className="text-sm font-semibold">{toLabel}</span>
                    </div>
                  </div>
                  {outputNum > 0 && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      ≈ {fmtUSD(direction === "buy" ? outputNum * project.price : outputNum)}
                    </p>
                  )}
                </div>

                {/* swap details */}
                {outputNum > 0 && (
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-[11px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Effective price</span>
                      <span className="font-mono text-foreground">
                        1 {toLabel} = {fmtUSD(effectivePrice)} {fromLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Price impact</span>
                      <span className={`font-mono font-semibold ${impactColor}`}>{impact.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Min. received (0.5% slippage)</span>
                      <span className="font-mono text-foreground">{fmtToken(minReceived)} {toLabel}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>LP fee ({project.fee}%)</span>
                      <span className="font-mono text-foreground">
                        {fmtUSD(inputNum * project.fee / 100)} {fromLabel}
                      </span>
                    </div>
                  </div>
                )}

                {impact >= 5 && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-400">
                      High price impact ({impact.toFixed(1)}%). Consider reducing your swap size.
                    </p>
                  </div>
                )}

                <Button
                  className="w-full h-11 text-sm font-semibold gap-2"
                  disabled={inputNum <= 0}
                >
                  {inputNum <= 0 ? (
                    "Enter an amount"
                  ) : (
                    <>
                      Swap {fromLabel} <ArrowRight className="w-4 h-4" /> {toLabel}
                    </>
                  )}
                </Button>

                <p className="text-center text-[10px] text-muted-foreground">
                  Connect wallet to execute swap
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: pool info + trades ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* pool stats bar */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Pool Statistics — {project.symbol}/USDC
                  </p>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Zap className="w-2.5 h-2.5" /> Live
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <PoolStat
                    label="Liquidity"
                    value={fmtUSD(project.poolUsdc * 2)}
                    sub="USDC + tokens"
                    icon={<Droplets className="w-3 h-3" />}
                  />
                  <PoolStat
                    label="24h Volume"
                    value={fmtUSD(project.volume24h)}
                    sub={`≈${(project.volume24h / (project.poolUsdc * 2) * 100).toFixed(1)}% of pool`}
                    icon={<BarChart2 className="w-3 h-3" />}
                  />
                  <PoolStat
                    label="Pool USDC"
                    value={fmtUSD(project.poolUsdc)}
                    icon={<Activity className="w-3 h-3" />}
                  />
                  <PoolStat
                    label={`Pool ${project.symbol}`}
                    value={fmtToken(project.poolCommit)}
                    icon={<Activity className="w-3 h-3" />}
                  />
                </div>
              </CardContent>
            </Card>

            {/* price chart placeholder */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold">{project.symbol}/USDC</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-mono font-bold">{fmtUSD(project.price)}</span>
                      <span className={`text-xs font-mono flex items-center gap-0.5 ${project.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {project.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {project.change24h >= 0 ? "+" : ""}{project.change24h}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {["1H", "6H", "1D", "1W"].map((t) => (
                      <button
                        key={t}
                        className={`text-[10px] px-2 py-1 rounded transition-colors font-mono ${
                          t === "1D" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG mock chart */}
                <div className="h-40 w-full relative">
                  <svg viewBox="0 0 600 140" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,100 C30,95 60,85 90,80 C120,75 140,88 170,82 C200,76 220,60 250,55 C280,50 300,65 330,58 C360,51 380,40 410,35 C440,30 470,42 500,38 C530,34 560,28 600,25"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                    <path
                      d="M0,100 C30,95 60,85 90,80 C120,75 140,88 170,82 C200,76 220,60 250,55 C280,50 300,65 330,58 C360,51 380,40 410,35 C440,30 470,42 500,38 C530,34 560,28 600,25 L600,140 L0,140 Z"
                      fill="url(#chartGrad)"
                    />
                  </svg>
                  {/* y-axis labels */}
                  <div className="absolute right-0 top-0 h-full flex flex-col justify-between text-[9px] text-muted-foreground font-mono py-1 pointer-events-none">
                    <span>{fmtUSD(project.price * 1.08)}</span>
                    <span>{fmtUSD(project.price * 1.04)}</span>
                    <span>{fmtUSD(project.price)}</span>
                    <span>{fmtUSD(project.price * 0.96)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-1">
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                </div>
              </CardContent>
            </Card>

            {/* recent trades */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Recent Trades
                  </p>
                  <span className="text-[10px] text-muted-foreground font-mono">{project.symbol}/USDC</span>
                </div>

                {/* header */}
                <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border font-medium">
                  <span>Side</span>
                  <span className="text-right">USDC</span>
                  <span className="text-right">Tokens</span>
                  <span className="text-right">Price / Time</span>
                </div>

                <div className="space-y-0.5 mt-2">
                  {RECENT_TRADES.map((trade, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 py-1.5 hover:bg-secondary/40 rounded px-1 transition-colors">
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${trade.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${trade.type === "buy" ? "bg-green-500" : "bg-red-500"}`} />
                        {trade.type === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="text-[11px] font-mono text-right">{fmtUSD(trade.amount)}</span>
                      <span className="text-[11px] font-mono text-right">{fmtToken(trade.tokens)}</span>
                      <div className="text-right">
                        <p className="text-[11px] font-mono">{fmtUSD(trade.price)}</p>
                        <p className="text-[9px] text-muted-foreground">{fmtTime(trade.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AMM explainer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: <Droplets className="w-4 h-4 text-blue-400" />,
                  title: "Constant-Product Formula",
                  body: "Price is determined by x·y=k. Larger swaps move price more. Always check your price impact before swapping.",
                },
                {
                  icon: <Zap className="w-4 h-4 text-yellow-400" />,
                  title: "Instant Liquidity Exit",
                  body: "CommitTokens are ERC-1155. Sell your position at any time — no lockup, no waiting for milestones.",
                },
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
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-5 px-4 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Landmark className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">CrowdVault</span>
            <span>— Ethereum Sepolia testnet</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Solidity · React · wagmi · Aave</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
