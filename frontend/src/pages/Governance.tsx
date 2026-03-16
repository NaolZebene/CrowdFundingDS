import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

/* ─── types ─── */
type ProposalStatus = "active" | "passed" | "failed" | "pending" | "executed";
type ProposalCategory = "Fee" | "Security" | "Protocol" | "Treasury" | "Oracle";

interface Proposal {
  id: number;
  title: string;
  summary: string;
  category: ProposalCategory;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  totalSupply: number;
  proposer: string;
  created: Date;
  ends: Date;
  executed?: Date;
  details: string;
  changes: { param: string; from: string; to: string }[];
}

/* ─── mock data ─── */
const PROPOSALS: Proposal[] = [
  {
    id: 5,
    title: "Reduce submission fee from $50 to $25",
    summary: "Lower the project submission fee to attract more early-stage founders to the platform.",
    category: "Fee",
    status: "active",
    votesFor: 142000,
    votesAgainst: 38000,
    quorum: 200000,
    totalSupply: 1000000,
    proposer: "0xaB3f...91Cd",
    created: new Date(Date.now() - 2 * 86400000),
    ends: new Date(Date.now() + 5 * 86400000),
    details:
      "The current $50 submission fee was set during the bootstrap phase to deter spam. With the protocol now established and audited, reducing this to $25 lowers the barrier for genuine founders while still filtering low-effort submissions. Revenue impact is estimated at -$150/month based on current submission volume.",
    changes: [{ param: "submissionFeeBps", from: "$50 flat", to: "$25 flat" }],
  },
  {
    id: 4,
    title: "Add Compound V3 as an approved lender",
    summary: "Whitelist Compound V3 (Comet) as a second yield source alongside Aave.",
    category: "Protocol",
    status: "active",
    votesFor: 95000,
    votesAgainst: 67000,
    quorum: 200000,
    totalSupply: 1000000,
    proposer: "0x77Ce...F312",
    created: new Date(Date.now() - 1 * 86400000),
    ends: new Date(Date.now() + 6 * 86400000),
    details:
      "Adding Compound V3 as an approved lender gives the admin the ability to switch yield sources when Compound offers better rates than Aave. This does not change lender automatically — it only expands the whitelist of callable lenders. The admin still executes `setLender()` manually after a governance vote.",
    changes: [
      { param: "approvedLenders", from: "[Aave V3]", to: "[Aave V3, Compound V3]" },
    ],
  },
  {
    id: 3,
    title: "Lower veto threshold from 30% to 20%",
    summary: "Make it easier for backers to block suspicious milestone releases.",
    category: "Security",
    status: "passed",
    votesFor: 218000,
    votesAgainst: 52000,
    quorum: 200000,
    totalSupply: 1000000,
    proposer: "0x55A1...B09E",
    created: new Date(Date.now() - 10 * 86400000),
    ends: new Date(Date.now() - 3 * 86400000),
    executed: new Date(Date.now() - 2 * 86400000),
    details:
      "Backers reported that reaching 30% stake coordination is difficult in practice for smaller projects. Lowering to 20% increases backer protection without significantly affecting normal project flow. Simulation across 12 past projects shows only 1 additional veto would have triggered under the new threshold.",
    changes: [{ param: "VETO_THRESHOLD_BPS", from: "3000 (30%)", to: "2000 (20%)" }],
  },
  {
    id: 2,
    title: "Increase release fee from 0.5% to 1%",
    summary: "Raise the milestone release fee sent to the RevenueRouter.",
    category: "Fee",
    status: "failed",
    votesFor: 88000,
    votesAgainst: 145000,
    quorum: 200000,
    totalSupply: 1000000,
    proposer: "0xC2Fa...4401",
    created: new Date(Date.now() - 20 * 86400000),
    ends: new Date(Date.now() - 13 * 86400000),
    details:
      "The proposal aimed to double the protocol's take rate on milestone releases. The community rejected this as it would reduce founder net proceeds and make CrowdVault less competitive against other crowdfunding platforms.",
    changes: [{ param: "releaseFeeBps", from: "50 (0.5%)", to: "100 (1%)" }],
  },
  {
    id: 1,
    title: "Add Chainlink as an approved oracle",
    summary: "Whitelist Chainlink price feeds as an approved oracle source.",
    category: "Oracle",
    status: "executed",
    votesFor: 310000,
    votesAgainst: 12000,
    quorum: 200000,
    totalSupply: 1000000,
    proposer: "0x1A2B...3C4D",
    created: new Date(Date.now() - 35 * 86400000),
    ends: new Date(Date.now() - 28 * 86400000),
    executed: new Date(Date.now() - 27 * 86400000),
    details:
      "Initial oracle setup. Chainlink was selected for its battle-tested reliability and Sepolia testnet support.",
    changes: [{ param: "oracle", from: "0x0000 (none)", to: "0xChainlink (Sepolia)" }],
  },
];

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
function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [expanded, setExpanded] = useState(false);
  const [voted, setVoted] = useState<"for" | "against" | null>(null);

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
              {isActive ? fmtCountdown(proposal.ends) : `Ended ${fmtDate(proposal.ends)}`}
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
            <span>Created {fmtDate(proposal.created)}</span>
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
                        onClick={() => setVoted("for")}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Vote For
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-4 text-xs gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                        variant="outline"
                        onClick={() => setVoted("against")}
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
                Executed on-chain — {fmtDate(proposal.executed)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── create proposal modal ─── */
function CreateProposalModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle]     = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<ProposalCategory>("Protocol");
  const [param, setParam]     = useState("");
  const [fromVal, setFromVal] = useState("");
  const [toVal, setToVal]     = useState("");

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
              disabled={!title || !summary}
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
type TabFilter = "all" | "active" | "passed" | "failed" | "executed";

export default function Governance() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = tab === "all"
    ? PROPOSALS
    : PROPOSALS.filter((p) => p.status === tab || (tab === "passed" && p.status === "executed"));

  const activeCount   = PROPOSALS.filter((p) => p.status === "active").length;
  const passedCount   = PROPOSALS.filter((p) => p.status === "passed" || p.status === "executed").length;
  const failedCount   = PROPOSALS.filter((p) => p.status === "failed").length;
  const totalVoters   = 1842;
  const vaultSupply   = "1,000,000";

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
            <Button
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 hidden sm:flex"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-3.5 h-3.5" /> New Proposal
            </Button>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

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
          </div>
          <Button
            className="gap-1.5 text-sm self-start sm:self-auto"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4" /> New Proposal
          </Button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── proposals list ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-3">
              {([
                { id: "all",      label: "All",      count: PROPOSALS.length },
                { id: "active",   label: "Active",   count: activeCount },
                { id: "passed",   label: "Passed",   count: passedCount },
                { id: "failed",   label: "Failed",   count: failedCount },
              ] as { id: TabFilter; label: string; count: number }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
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
                filtered.map((p) => <ProposalCard key={p.id} proposal={p} />)
              )}
            </div>
          </div>

          {/* ── right sidebar ── */}
          <div className="space-y-4">

            {/* your voting power */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Your Voting Power
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-mono font-bold">4,200</span>
                  <span className="text-sm text-muted-foreground mb-0.5">VAULT</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Share of supply</span>
                    <span className="font-mono">0.42%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: "0.42%" }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Total supply: <span className="font-mono text-foreground">{vaultSupply} VAULT</span>
                  </p>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Proposals you can create</span>
                  <span className="font-mono text-green-400">✓ Eligible</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Min. to propose</span>
                  <span className="font-mono">1,000 VAULT</span>
                </div>
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

      {showCreate && <CreateProposalModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
