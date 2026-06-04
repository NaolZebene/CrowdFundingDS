interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  subGreen?: boolean;
  icon: React.ReactNode;
  accent?: string;
}

export function SummaryCard({
  label,
  value,
  sub,
  subGreen,
  icon,
  accent,
}: SummaryCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-card border border-border rounded-2xl p-4 flex items-start gap-3 hover:border-primary/30 transition-colors group`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent ?? "from-primary/5"} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
      />
      <div className="relative p-2.5 rounded-xl bg-secondary text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="relative min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-xl font-mono font-bold leading-tight">{value}</p>
        {sub && (
          <p
            className={`text-[11px] font-mono mt-0.5 ${
              subGreen ? "text-green-400" : "text-muted-foreground"
            }`}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
