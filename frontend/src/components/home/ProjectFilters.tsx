import { SlidersHorizontal } from "lucide-react";
import { CATEGORIES, SORT_OPTIONS } from "@/utils/homeFormatters";

interface ProjectFiltersProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  activeSort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
  query: string;
}

export function ProjectFilters({
  activeCategory,
  onCategoryChange,
  activeSort,
  onSortChange,
  resultCount,
  query,
}: ProjectFiltersProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground hidden sm:block">Sort:</span>
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSortChange(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeSort === s
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {resultCount} project{resultCount !== 1 ? "s" : ""}
        {activeCategory !== "All" && <span> · {activeCategory}</span>}
        {query && <span> matching &ldquo;{query}&rdquo;</span>}
      </p>
    </div>
  );
}
