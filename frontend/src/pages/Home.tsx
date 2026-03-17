import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  Landmark,
  Clock,
  Users,
  TrendingUp,
  Plus,
  ChevronRight,
  Shield,
  Coins,
  ArrowUpRight,
  BarChart2,
  Activity,
  SlidersHorizontal,
  Flame,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/hooks/useWallet";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCategory, setSortBy, setSearchQuery } from "@/store/slices/projectsSlice";

/* ─── helpers ─── */
function pct(raised: number, goal: number) {
  return Math.min(100, Math.round((raised / goal) * 100));
}
function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}
function fmtNum(n: number) {
  return n.toLocaleString();
}

/* ─── data ─── */
const CATEGORIES = ["All", "DeFi", "Tech", "Gaming", "Art", "Science", "Social"];

const SORT_OPTIONS = ["Trending", "Most Funded", "Ending Soon", "Highest APY"];

/* ─── sub-components ─── */
function StatCard({
  label,
  value,
  sub,
  icon,
  green,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  green?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 rounded-md bg-secondary text-muted-foreground shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-xl font-mono font-bold ${green ? "text-green-400" : ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

import type { Project } from "@/store/slices/projectsSlice";

function ProjectCard({ project, onBack }: { project: Project; onBack: () => void }) {
  const percent = pct(project.raised, project.goal);
  const barColor =
    percent >= 80 ? "bg-green-500" : percent >= 40 ? "bg-blue-500" : "bg-yellow-500";

  return (
    <Card className="bg-card border-border overflow-hidden flex flex-col group hover:border-primary/40 transition-all duration-200 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]">
      <div className="relative h-40 overflow-hidden bg-secondary shrink-0">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white/80 font-medium backdrop-blur-sm">
            {project.category}
          </span>
          {project.hot && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/80 text-white font-medium flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" /> Hot
            </span>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5">
          <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/40 text-green-400 font-mono font-semibold">
            {project.apy}% APY
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
              project.daysLeft <= 10
                ? "bg-red-500/20 border border-red-500/40 text-red-400"
                : "bg-black/50 border border-white/10 text-white/70"
            }`}
          >
            <Clock className="w-2.5 h-2.5 inline mr-1" />
            {project.daysLeft}d left
          </span>
        </div>
      </div>

      <CardContent className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <h3 className="font-semibold text-sm leading-snug line-clamp-1">{project.title}</h3>
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mt-1">
            {project.description}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono font-semibold">{fmtUSD(project.raised)}</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {percent}% of {fmtUSD(project.goal)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border text-center">
          <div>
            <p className="text-[11px] font-mono font-semibold">{fmtNum(project.backers)}</p>
            <p className="text-[10px] text-muted-foreground">Backers</p>
          </div>
          <div>
            <p className="text-[11px] font-mono font-semibold">
              {project.milestonesCompleted}/{project.milestones}
            </p>
            <p className="text-[10px] text-muted-foreground">Milestones</p>
          </div>
          <div>
            <p className="text-[11px] font-mono font-semibold text-green-400">{project.apy}%</p>
            <p className="text-[10px] text-muted-foreground">APY</p>
          </div>
        </div>

        <Button size="sm" className="w-full h-8 text-xs font-semibold gap-1.5 mt-auto" onClick={onBack}>
          <Coins className="w-3.5 h-3.5" /> Back this Project
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── main ─── */
export default function Home() {
  const { isConnected } = useWallet();
  const { openConnectModal } = useConnectModal();
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((s) => s.projects.activeCategory);
  const activeSort = useAppSelector((s) => s.projects.sortBy);
  const query = useAppSelector((s) => s.projects.searchQuery);
  const PROJECTS = useAppSelector((s) => s.projects.items);

  /* ─── top 4 by raised ─── */
  const TOP_PROJECTS = useMemo(
    () => [...PROJECTS].sort((a, b) => b.raised - a.raised).slice(0, 4),
    [PROJECTS]
  );

  const filtered = PROJECTS.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchQ =
      query === "" ||
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  }).sort((a, b) => {
    if (activeSort === "Most Funded") return b.raised - a.raised;
    if (activeSort === "Ending Soon") return a.daysLeft - b.daysLeft;
    if (activeSort === "Highest APY") return b.apy - a.apy;
    if (activeSort === "Trending") return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
    return 0;
  });

  const totalRaised = PROJECTS.reduce((s, p) => s + p.raised, 0);
  const totalBackers = PROJECTS.reduce((s, p) => s + p.backers, 0);

  const [hero, ...sideProjects] = TOP_PROJECTS;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Landmark className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-wide">CrowdVault</span>
          </div>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              { label: "Markets", href: "/" },
              { label: "AMM Swap", href: "/amm" },
              { label: "Portfolio", href: "/portfolio" },
              { label: "Governance", href: "/governance" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                  l.href === "/" ? "bg-secondary text-foreground" : ""
                }`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-8 h-8 text-xs bg-secondary border-border"
              value={query}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            />
          </div>

          <Button size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0 hidden sm:flex">
            <Plus className="w-3.5 h-3.5" /> List Project
          </Button>

          <a
            href="https://github.com/NaolZebene/CrowdFundingDS"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>

          <ConnectButton accountStatus="avatar" showBalance={false} />
        </div>
      </nav>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-8">

        {/* ── Hero: Top Funded Projects ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
                Top Funded
              </p>
              <h1 className="text-2xl font-bold leading-tight">
                Projects Backed by the Community
              </h1>
            </div>
            <button className="text-xs text-primary flex items-center gap-0.5 hover:underline shrink-0">
              Browse all <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Large hero card + 3 side cards */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-auto lg:h-[360px]">

            {/* Hero card — takes 3/5 columns */}
            <div className="lg:col-span-3 relative rounded-xl overflow-hidden border border-border group cursor-pointer h-64 lg:h-full">
              <img
                src={hero.image}
                alt={hero.title}
                className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* rank badge */}
              <div className="absolute top-4 left-4">
                <span className="text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-md">
                  #1 Most Funded
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/20 border border-green-500/40 text-green-400 font-mono font-semibold">
                  {hero.apy}% APY
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/15 text-white/80">
                    {hero.category}
                  </span>
                  {hero.hot && (
                    <span className="text-[11px] text-orange-400 flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Hot
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{hero.title}</h2>
                <p className="text-sm text-white/60 mb-4 line-clamp-2">{hero.description}</p>

                {/* progress */}
                <div className="h-1.5 w-full rounded-full bg-white/20 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct(hero.raised, hero.goal)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-lg font-mono font-bold text-white">{fmtUSD(hero.raised)}</span>
                    <span className="text-xs text-white/50 ml-2">of {fmtUSD(hero.goal)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/60 font-mono">
                    <span><Users className="w-3 h-3 inline mr-1" />{fmtNum(hero.backers)}</span>
                    <span><Clock className="w-3 h-3 inline mr-1" />{hero.daysLeft}d left</span>
                  </div>
                </div>

                <Button className="gap-2 text-sm w-full sm:w-auto" onClick={() => { if (!isConnected) openConnectModal?.(); }}>
                  <Coins className="w-4 h-4" /> Back this Project
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Side cards — 2/5 columns, stacked */}
            <div className="lg:col-span-2 grid grid-cols-1 gap-3">
              {sideProjects.map((p, i) => {
                const percent = pct(p.raised, p.goal);
                return (
                  <div
                    key={p.id}
                    className="relative rounded-xl overflow-hidden border border-border group cursor-pointer flex-1"
                    style={{ minHeight: "100px" }}
                  >
                    <img
                      src={p.image}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

                    <div className="relative p-4 h-full flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">
                            #{i + 2} Funded
                          </span>
                          <h3 className="text-sm font-semibold text-white leading-tight mt-0.5">
                            {p.title}
                          </h3>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 font-mono shrink-0 ml-2">
                          {p.apy}%
                        </span>
                      </div>

                      <div>
                        <div className="h-1 w-full rounded-full bg-white/15 mb-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] font-mono text-white/60">
                          <span>{fmtUSD(p.raised)}</span>
                          <span>{percent}% · {p.daysLeft}d left</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Platform stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Value Locked"
            value={fmtUSD(totalRaised)}
            sub="+12.4% this week"
            icon={<BarChart2 className="w-4 h-4" />}
            green
          />
          <StatCard
            label="Active Projects"
            value={String(PROJECTS.length)}
            sub={`${PROJECTS.filter((p) => p.trending).length} trending now`}
            icon={<Activity className="w-4 h-4" />}
          />
          <StatCard
            label="Total Backers"
            value={fmtNum(totalBackers)}
            sub="+34 in 24h"
            icon={<Users className="w-4 h-4" />}
            green
          />
          <StatCard
            label="Avg. Yield APY"
            value="7.4%"
            sub="Via Aave lending"
            icon={<TrendingUp className="w-4 h-4" />}
            green
          />
        </div>

        {/* ── Browse all projects ── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => dispatch(setCategory(cat))}
                  className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sort:</span>
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => dispatch(setSortBy(s))}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeSort === s
                        ? "bg-secondary text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
            {query ? ` matching "${query}"` : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm border border-border rounded-lg">
              No projects found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} onBack={() => { if (!isConnected) openConnectModal?.(); }} />
              ))}
            </div>
          )}
        </section>

        {/* ── Protocol info ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              icon: <Shield className="w-5 h-5 text-blue-400" />,
              title: "Milestone-Gated Funds",
              body: "Capital is released only when founders hit verified milestones. Backers can veto suspicious releases with a 30% stake vote.",
            },
            {
              icon: <Coins className="w-5 h-5 text-yellow-400" />,
              title: "CommitTokens (ERC-1155)",
              body: "Your investment is a tradeable token. Exit your position at any time via the built-in AMM without waiting for the project to end.",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-green-400" />,
              title: "Yield While You Wait",
              body: "Idle funds earn interest via Aave while locked in milestones. Your capital is always working, never sitting still.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-lg p-5 flex gap-4">
              <div className="p-2.5 rounded-lg bg-secondary h-fit">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── CTA ── */}
        <div className="bg-card border border-border rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <p className="text-xs text-primary font-semibold mb-1 uppercase tracking-wider">Launch your project</p>
            <h3 className="font-semibold text-base mb-1">Get your idea funded — transparently.</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Submit a project with milestones, a funding goal, and a deadline. Admin reviews
              and approves. Backers earn yield from day one.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button className="gap-1.5 text-sm px-5" onClick={() => { if (!isConnected) openConnectModal?.(); }}>
              <Plus className="w-4 h-4" /> Submit Project
            </Button>
            <Button variant="outline" className="text-sm px-5">Read docs</Button>
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
