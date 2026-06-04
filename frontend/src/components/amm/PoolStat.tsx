import type { ReactNode } from "react";

interface PoolStatProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  green?: boolean;
  red?: boolean;
}

export function PoolStat({
  label,
  value,
  sub,
  icon,
  green,
  red,
}: PoolStatProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p
        className={`text-sm font-mono font-semibold ${
          green ? "text-green-400" : red ? "text-red-400" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
