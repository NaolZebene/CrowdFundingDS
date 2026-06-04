import { TrendingUp, Coins, Users } from "lucide-react";
import { fmtUSD } from "@/utils/homeFormatters";

interface HeroSectionProps {
  totalRaised: number;
  tvl: number;
  activeProjectCount: number;
}

export function HeroSection({ totalRaised, tvl, activeProjectCount }: HeroSectionProps) {
  const stats = [
    {
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      label: "Total Raised",
      value: fmtUSD(totalRaised),
      color: "text-primary",
    },
    {
      icon: <Coins className="w-3.5 h-3.5" />,
      label: "TVL",
      value: fmtUSD(tvl),
      color: "text-emerald-600",
    },
    {
      icon: <Users className="w-3.5 h-3.5" />,
      label: "Active Projects",
      value: String(activeProjectCount),
      color: "text-foreground",
    },
  ];

  return (
    <div className="border-b border-border bg-gradient-to-br from-card via-background to-primary/5">
      <div className="max-w-screen-xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wide uppercase">
              Live on Sepolia
            </span>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
              On-chain governed
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            Fund the future,
            <br />
            <span className="text-primary">stake your vote.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
            Milestone-gated crowdfunding where backers hold liquid tokens, earn
            yield, and vote on fund releases — all on-chain.
          </p>
        </div>

        {/* stats pills */}
        <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 min-w-[180px]"
            >
              <span className={`${s.color}`}>{s.icon}</span>
              <div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
