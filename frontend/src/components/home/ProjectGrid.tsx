import { Coins } from "lucide-react";
import type { MarketProject } from "@/hooks/useMarketsData";
import { ProjectCard } from "./ProjectCard";

interface ProjectGridProps {
  projects: MarketProject[];
  openCount: number;
  onSelect: (project: MarketProject) => void;
}

export function ProjectGrid({ projects, openCount, onSelect }: ProjectGridProps) {
  if (openCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 border border-dashed border-border rounded-2xl text-center bg-secondary/10">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Coins className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">No open projects right now</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Approved projects with open funding windows appear here.
        </p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-24 text-muted-foreground text-sm border border-dashed border-border rounded-2xl bg-secondary/10">
        No projects match this filter.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          onOpenDetails={onSelect}
          onBack={() => onSelect(p)}
        />
      ))}
    </div>
  );
}
