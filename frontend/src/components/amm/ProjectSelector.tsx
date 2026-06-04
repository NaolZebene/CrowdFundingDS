import { useState } from "react";
import { ChevronDown, Flame, Search } from "lucide-react";
import type { AmmPool } from "@/hooks/useAmmData";
import { fmtUSD } from "@/utils/ammFormatters";

interface ProjectSelectorProps {
  pools: AmmPool[];
  selectedId: number;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function ProjectSelector({
  pools,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = pools.find((p) => p.id === selectedId) ?? pools[0];
  if (!selected) return null;

  const filtered = pools.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search)
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          onSearchChange("");
        }}
        className="flex items-center gap-2.5 bg-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/50 transition-colors w-full"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">
            {selected.symbol[0]}
          </span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold leading-none truncate">
            {selected.name}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
            {selected.symbol} · Project #{selected.id}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selected.poolUsdc > 50_000 && (
            <Flame className="w-3 h-3 text-orange-400" />
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
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
              <p className="text-center text-xs text-muted-foreground py-6">
                No pools found.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                    onSearchChange("");
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 w-full text-left hover:bg-secondary transition-colors ${
                    p.id === selectedId ? "bg-secondary" : ""
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary">
                      {p.symbol[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Project #{p.id}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">
                      {fmtUSD(p.poolUsdc * 2)} liquidity
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono">{fmtUSD(p.price)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-border bg-secondary/50">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} pool{filtered.length !== 1 ? "s" : ""} · type to
              filter
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
