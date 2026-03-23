import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Landmark,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Users,
  Zap,
  Shield,
  Activity,
  AlertCircle,
  ArrowRight,
  FileText,
  ThumbsUp,
  ThumbsDown,
  BarChart2,
  Lock,
  Unlock,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useWallet } from "@/hooks/useWallet";
import { useGovernanceIndexedData } from "@/hooks/useGovernanceIndexedData";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveTab, castVote, setShowCreateModal, addProposal } from "@/store/slices/governanceSlice";
import type { Proposal, ProposalStatus, ProposalCategory } from "@/store/slices/governanceSlice";

/* ─── types ─── */
type TabFilter = "all" | "active" | "passed" | "failed" | "executed";

const PROTOCOL_PARAMS = [
  { label: "Submission Fee",     value: "$50 flat",    category: "Fee",      locked: false },
  { label: "Release Fee",        value: "0.5%",         category: "Fee",      locked: false },
  { label: "Veto Threshold",     value: "30%",          category: "Security", locked: false },
  { label: "Min Funding Period", value: "3 days",       category: "Protocol", locked: true  },
  { label: "Max Funding Period", value: "90 days",      category: "Protocol", locked: true  },
  { label: "Active Oracle",      value: "Chainlink",    category: "Oracle",   locked: false },
  { label: "Active Lender",      value: "Aave V3",      category: "Protocol", locked: false },
  { label: "AMM Swap Fee",       value: "0.3%",         category: "Fee",      locked: false },
];

/* ─── helpers ─── */
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

const fmtCountdown = (d: Date) => {
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
};

const STATUS_META: Record<ProposalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active:   { label: "Active",   color: "text-blue-400 bg-blue-500/15 border-blue-500/30",   icon: <Activity className="w-3 h-3" /> },
  passed:   { label: "Passed",   color: "text-green-400 bg-green-500/15 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:   { label: "Failed",   color: "text-red-400 bg-red-500/15 border-red-500/30",       icon: <XCircle className="w-3 h-3" /> },
  pending:  { label: "Pending",  color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  executed: { label: "Executed", color: "text-purple-400 bg-purple-500/15 border-purple-500/30", icon: <Zap className="w-3 h-3" /> },
};

const CAT_COLOR: Record<ProposalCategory, string> = {
  Fee:      "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Security: "text-red-400 bg-red-500/10 border-red-500/20",
  Protocol: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Treasury: "text-green-400 bg-green-500/10 border-green-500/20",
  Oracle:   "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

/* ─── proposal card ─── */
function ProposalCard({
  proposal,
  voted,
  onVote,
}: {
  proposal: Proposal;
  voted: "for" | "against" | null;
  onVote: (v: "for" | "against") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const total   = proposal.votesFor + proposal.votesAgainst;
  const forPct  = total > 0 ? (proposal.votesFor / total) * 100 : 0;
  const quorumPct = Math.min(100, (total / proposal.quorum) * 100);
  const quorumMet = total >= proposal.quorum;
  const status  = STATUS_META[proposal.status];
  const isActive = proposal.status === "active";

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      isActive ? "border-primary/30 bg-card" : "border-border bg-card"
    }`}>
      {/* header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-5 py-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${status.color}`}>
                {status.icon}{status.label}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${CAT_COLOR[proposal.category]}`}>
                {proposal.category}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">PCV-{proposal.id}</span>
            </div>
            <h3 className="text-sm font-semibold leading-snug">{proposal.title}</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {proposal.summary}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>

        {/* vote bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-green-400 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {forPct.toFixed(1)}% For ({(proposal.votesFor / 1000).toFixed(0)}K)
            </span>
            <span className="text-red-400 flex items-center gap-1">
              {((100 - forPct)).toFixed(1)}% Against ({(proposal.votesAgainst / 1000).toFixed(0)}K)
              <ThumbsDown className="w-3 h-3" />
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden flex">
            <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-red-500 rounded-r-full transition-all" style={{ width: `${100 - forPct}%` }} />
          </div>
          {/* quorum */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              {quorumMet
                ? <CheckCircle2 className="w-3 h-3 text-green-400" />
                : <AlertCircle className="w-3 h-3 text-yellow-400" />}
              Quorum {quorumPct.toFixed(0)}% ({(total / 1000).toFixed(0)}K / {(proposal.quorum / 1000).toFixed(0)}K)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isActive ? fmtCountdown(new Date(proposal.ends)) : `Ended ${fmtDate(new Date(proposal.ends))}`}
            </span>
          </div>
        </div>
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-secondary/20 px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
              Full Description
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{proposal.details}</p>
          </div>

          {/* proposed changes */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Parameter Changes
            </p>
            <div className="space-y-1.5">
              {proposal.changes.map((c) => (
                <div key={c.param} className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2">
                  <code className="text-[11px] text-primary font-mono flex-1">{c.param}</code>
                  <span className="text-[11px] font-mono text-muted-foreground line-through">{c.from}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-mono text-green-400 font-semibold">{c.to}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Proposed by <span className="font-mono text-foreground">{proposal.proposer}</span></span>
            <span>Created {fmtDate(new Date(proposal.created))}</span>
          </div>

          {/* voting actions */}
          {isActive && (
            <>
              <Separator className="bg-border" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold mb-0.5">Cast your vote</p>
                  <p className="text-[11px] text-muted-foreground">
                    Your voting power: <span className="font-mono text-foreground">4,200 VAULT</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {voted ? (
                    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border ${
                      voted === "for"
                        ? "text-green-400 bg-green-500/10 border-green-500/30"
                        : "text-red-400 bg-red-500/10 border-red-500/30"
                    }`}>
                      {voted === "for" ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                      Voted {voted === "for" ? "For" : "Against"}
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="h-8 px-4 text-xs gap-1.5 bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"
                        variant="outline"
                        onClick={() => onVote("for")}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Vote For
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-4 text-xs gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                        variant="outline"
                        onClick={() => onVote("against")}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> Vote Against
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {(proposal.status === "passed" || proposal.status === "executed") && proposal.executed && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-[11px] text-green-400">
                Executed on-chain — {fmtDate(new Date(proposal.executed))}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── create proposal modal ─── */
function CreateProposalModal({
  onClose,
  canCreate,
}: {
  onClose: () => void;
  canCreate: boolean;
}) {
  const dispatch = useAppDispatch();
  const [title, setTitle]     = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<ProposalCategory>("Protocol");
  const [param, setParam]     = useState("");
  const [fromVal, setFromVal] = useState("");
  const [toVal, setToVal]     = useState("");

  function handleSubmit() {
    if (!canCreate) return;
    if (!title || !summary) return;
    dispatch(addProposal({
      title,
      summary,
      category,
      quorum: 200000,
      totalSupply: 1000000,
      proposer: "0xYou...rAddr",
      details: summary,
      changes: param ? [{ param, from: fromVal, to: toVal }] : [],
    }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">New Proposal</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Min. 1,000 VAULT to propose</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Title
            </label>
            <input
              type="text"
              placeholder="Short, descriptive title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["Fee", "Security", "Protocol", "Treasury", "Oracle"] as ProposalCategory[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Summary
            </label>
            <textarea
              placeholder="Explain what this proposal changes and why..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Parameter Change
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="param name"
                value={param}
                onChange={(e) => setParam(e.target.value)}
                className="bg-secondary border border-border rounded-md px-2.5 py-2 text-xs font-mono outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
              <input
                type="text"
                placeholder="current value"
                value={fromVal}
                onChange={(e) => setFromVal(e.target.value)}
                className="bg-secondary border border-border rounded-md px-2.5 py-2 text-xs font-mono outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
              <input
                type="text"
                placeholder="new value"
                value={toVal}
                onChange={(e) => setToVal(e.target.value)}
                className="bg-secondary border border-border rounded-md px-2.5 py-2 text-xs font-mono outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 text-green-400"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">param name → current value → proposed value</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            Voting period: <span className="font-mono text-foreground">7 days</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!canCreate || !title || !summary}
              onClick={handleSubmit}
            >
              <FileText className="w-3.5 h-3.5" /> Submit Proposal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── main ─── */
export default function Governance() {
  const { isConnected, isWrongNetwork, address, role, isAdmin, isRoleLoading } = useWallet();
  const dispatch = useAppDispatch();
  const proposals = useAppSelector((s) => s.governance.proposals);
  const tab = useAppSelector((s) => s.governance.activeTab);
  const showCreate = useAppSelector((s) => s.governance.showCreateModal);
  const votes = useAppSelector((s) => s.governance.votes);
  const {
    loading: indexLoading,
    error: indexError,
    stats,
    recentVotes,
    topParticipants,
    myGovernance,
  } = useGovernanceIndexedData(address);
  const {
    positions,
    vetoLoading,
    votingId,
    castVeto: castVetoOnchain,
  } = usePortfolioData();

  const liveVetoProjects = positions.filter((p) => p.vetoOpen);

  const filtered = tab === "all"
    ? proposals
    : proposals.filter((p) => p.status === tab || (tab === "passed" && p.status === "executed"));

  const activeCount   = proposals.filter((p) => p.status === "active").length;
  const passedCount   = proposals.filter((p) => p.status === "passed" || p.status === "executed").length;
  const failedCount   = proposals.filter((p) => p.status === "failed").length;
  const totalVoters = stats.uniqueVoters;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 shrink-0 cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-wide">CrowdVault</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {[
              ...(role === "admin" ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
              { label: "Markets",    href: "/" },
              { label: "AMM Swap",   href: "/amm" },
              { label: "Portfolio",  href: "/portfolio" },
              { label: "Governance", href: "/governance" },
            ].map((l) => (
              <Link key={l.label} href={l.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${
                  l.href === "/governance" ? "bg-secondary text-foreground" : ""
                }`}>
                  {l.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isAdmin && !isRoleLoading ? (
              <Button
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 hidden sm:flex"
                onClick={() => dispatch(setShowCreateModal(true))}
              >
                <Plus className="w-3.5 h-3.5" /> New Proposal
              </Button>
            ) : null}
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      {(!isConnected || isWrongNetwork) ? <ConnectPrompt /> : (
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">

        {/* ── page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
              On-Chain Governance
            </p>
            <h1 className="text-2xl font-bold">Protocol Proposals</h1>
            <p className="text-sm text-muted-foreground mt-1">
              VAULT token holders vote on parameter changes, upgrades, and protocol direction.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Session role:{" "}
              <span className="font-mono text-foreground uppercase">
                {isRoleLoading ? "checking..." : role}
              </span>
            </p>
          </div>
          {isAdmin && !isRoleLoading ? (
            <Button
              className="gap-1.5 text-sm self-start sm:self-auto"
              onClick={() => dispatch(setShowCreateModal(true))}
            >
              <Plus className="w-4 h-4" /> New Proposal
            </Button>
          ) : null}
        </div>

        {/* ── stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active Proposals",   value: String(activeCount),  icon: <Activity className="w-4 h-4" />,  green: false },
            { label: "Proposals Passed",   value: String(passedCount),  icon: <CheckCircle2 className="w-4 h-4" />, green: true },
            { label: "Proposals Failed",   value: String(failedCount),  icon: <XCircle className="w-4 h-4" />,  green: false },
            { label: "Unique Voters",      value: String(totalVoters),  icon: <Users className="w-4 h-4" />,    green: false },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <div className="p-2 rounded-md bg-secondary text-muted-foreground shrink-0">{s.icon}</div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-mono font-bold ${s.green ? "text-green-400" : ""}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {indexLoading
            ? "Syncing governance relationships from subgraph..."
            : indexError
            ? "Subgraph unavailable: governance analytics temporarily using stale/cache data."
            : `Indexed governance active: ${stats.projectsTracked} projects tracked, ${stats.votedProjectsCount} projects with veto activity.`}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── proposals list ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-3">
              {([
                { id: "all",      label: "All",      count: proposals.length },
                { id: "active",   label: "Active",   count: activeCount },
                { id: "passed",   label: "Passed",   count: passedCount },
                { id: "failed",   label: "Failed",   count: failedCount },
              ] as { id: TabFilter; label: string; count: number }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => dispatch(setActiveTab(t.id as "all" | "active" | "passed" | "failed"))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    tab === t.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    tab === t.id ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  }`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm border border-border rounded-lg">
                  No proposals found.
                </div>
              ) : (
                filtered.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    voted={votes[p.id] ?? null}
                    onVote={(v) => dispatch(castVote({ id: p.id, vote: v }))}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── right sidebar ── */}
          <div className="space-y-4">

            {/* your voting power */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Your Governance Stake
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-mono font-bold">{myGovernance.stakeUsdc.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">USDC stake</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Projects involved</span>
                    <span className="font-mono">{myGovernance.projectsInvolved}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Veto votes cast: <span className="font-mono text-foreground">{myGovernance.votesCast}</span>
                  </p>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Indexed participants</span>
                  <span className="font-mono">{stats.uniqueParticipants}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Voters observed</span>
                  <span className="font-mono">{stats.uniqueVoters}</span>
                </div>
              </CardContent>
            </Card>

            {/* live on-chain veto actions */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Live Release Vetoes
                </p>
                {liveVetoProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No open release-veto windows for your current holdings.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {liveVetoProjects.map((p) => (
                      <div key={p.id.toString()} className="border border-border rounded-md p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            Project #{p.id.toString()}
                          </span>
                          <span className="font-mono text-foreground">
                            Stake {p.tokensHeld.toFixed(2)}
                          </span>
                        </div>
                        {p.hasVoted ? (
                          <div className="text-[11px] text-green-400 border border-green-500/30 bg-green-500/10 rounded px-2 py-1">
                            You already cast your veto vote.
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 w-full text-xs gap-1.5"
                            disabled={vetoLoading}
                            onClick={() => castVetoOnchain(p.id)}
                          >
                            {vetoLoading && votingId === p.id ? (
                              <>
                                <Clock className="w-3.5 h-3.5 animate-spin" /> Confirming...
                              </>
                            ) : (
                              <>
                                <Shield className="w-3.5 h-3.5" /> Cast On-Chain Veto
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  This section calls the real `veto(projectId)` contract method.
                </p>
              </CardContent>
            </Card>

            {/* recent veto activity */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Recent Veto Activity
                </p>
                {recentVotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No veto votes indexed yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentVotes.map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {shortAddr(v.voter)} on Project #{v.projectId}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {fmtDate(new Date(v.timestamp))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* top participants */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Top Participants
                </p>
                {topParticipants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No governance participants indexed yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topParticipants.map((p) => (
                      <div key={`${p.user}-${p.investedUsdc}`} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{shortAddr(p.user)}</span>
                        <span className="font-mono">{p.investedUsdc.toFixed(2)} USDC</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* protocol params */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Current Parameters
                  </p>
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  {PROTOCOL_PARAMS.map((param) => (
                    <div key={param.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {param.locked
                          ? <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                          : <Unlock className="w-3 h-3 text-primary/60 shrink-0" />}
                        <span className="text-[11px] text-muted-foreground truncate">{param.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[11px] font-mono font-semibold">{param.value}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${CAT_COLOR[param.category as ProposalCategory]}`}>
                          {param.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Locked params require a supermajority (66%) to change.
                </p>
              </CardContent>
            </Card>

            {/* how it works */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  How Governance Works
                </p>
                <div className="space-y-3">
                  {[
                    { step: "1", icon: <FileText className="w-3.5 h-3.5" />, title: "Propose", body: "Hold 1,000+ VAULT and submit a proposal describing what to change and why." },
                    { step: "2", icon: <BarChart2 className="w-3.5 h-3.5" />, title: "Vote", body: "7-day voting window. Any VAULT holder votes For or Against. Quorum: 200K tokens." },
                    { step: "3", icon: <Shield className="w-3.5 h-3.5" />, title: "Execute", body: "If quorum is met and For > Against, the admin executes the change on-chain." },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary">
                        {s.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded border border-border hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-all group">
                  <span>Read full governance docs</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      )}

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

      {showCreate && (
        <CreateProposalModal
          canCreate={isAdmin}
          onClose={() => dispatch(setShowCreateModal(false))}
        />
      )}
    </div>
  );
}
