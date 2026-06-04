import { Zap, Users, Clock, Timer, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketProject } from "@/hooks/useMarketsData";
import {
  fmtUSDFull,
  fmtPct,
  pct,
  progressStyle,
  fmtTimeLeft,
  getProjectImage,
} from "@/utils/homeFormatters";

interface ProjectCardProps {
  project: MarketProject;
  onBack: () => void;
  onOpenDetails: (project: MarketProject) => void;
}

export function ProjectCard({
  project,
  onBack,
  onOpenDetails,
}: ProjectCardProps) {
  const percent = pct(project.totalRaised, project.fundingGoal);
  const days = project.daysLeft;
  const canBack = project.approved && !project.fundingClosed && !project.projectDead;
  const img = getProjectImage(project);
  const isTrending = percent >= 60;
  const isClosing = !project.fundingClosed && days <= 7 && days >= 0;
  const now = Math.floor(Date.now() / 1000);
  const milestoneDeadlineSecs = Number(project.milestoneDeadline);
  const milestoneDeadlineDays =
    milestoneDeadlineSecs > now
      ? Math.ceil((milestoneDeadlineSecs - now) / 86400)
      : 0;
  const milestoneOverdue =
    milestoneDeadlineSecs > 0 && milestoneDeadlineSecs < now && !project.projectDead;
  const submittedMilestones = Math.max(0, project.currentMilestone - 1);

  return (
    <div
      className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-[0_4px_24px_hsl(var(--primary)/0.10)] transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(project)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails(project);
        }
      }}
    >
      {/* thumbnail */}
      <div className="relative h-40 overflow-hidden bg-secondary shrink-0">
        <img
          src={img}
          alt={project.name}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isTrending && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/80 text-white font-semibold">
              <Flame className="w-2.5 h-2.5" /> Trending
            </span>
          )}
          {isClosing && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/70 text-white font-semibold">
              <Timer className="w-2.5 h-2.5" /> {fmtTimeLeft(project.fundingDeadline)}
            </span>
          )}
          {project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-700/90 text-white font-semibold">
              Dead
            </span>
          )}
          {project.timeoutActive && !project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/80 text-white font-semibold">
              Vote open
            </span>
          )}
          {milestoneOverdue && !project.timeoutActive && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-600/80 text-white font-semibold">
              Overdue
            </span>
          )}
          {project.fundingClosed && !project.projectDead && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-600/80 text-white font-semibold">
              Funded ✓
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2">
            {project.iconUrl && (
              <img
                src={project.iconUrl}
                alt=""
                className="w-8 h-8 rounded-md border border-white/20 bg-black/30 object-cover shrink-0"
              />
            )}
            <h3 className="font-bold text-sm text-white leading-snug line-clamp-1">
              {project.name}
            </h3>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.4rem]">
          {project.description || "No description provided."}
        </p>

        {/* progress */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                percent >= 80
                  ? "bg-primary"
                  : percent >= 40
                    ? "bg-primary/70"
                    : "bg-primary/40"
              }`}
              style={progressStyle(percent)}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span className="font-semibold text-foreground">
              {fmtUSDFull(project.totalRaised)}
            </span>
            <span className="text-muted-foreground">
              {fmtPct(percent)} of {fmtUSDFull(project.fundingGoal)}
            </span>
          </div>
        </div>

        {/* meta row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {submittedMilestones}/{project.milestoneCount} milestones
          </span>
          {milestoneDeadlineSecs > 0 && !project.projectDead ? (
            <span
              className={`flex items-center gap-1 ${
                milestoneOverdue
                  ? "text-orange-400"
                  : milestoneDeadlineDays <= 7
                    ? "text-yellow-400"
                    : ""
              }`}
            >
              <Timer className="w-3 h-3" />
              {milestoneOverdue
                ? "Overdue"
                : `${milestoneDeadlineDays}d milestone`}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {project.goalMet
                ? "Funded"
                : project.isExpired
                  ? "Expired"
                  : fmtTimeLeft(project.fundingDeadline)}
            </span>
          )}
        </div>

        <Button
          size="sm"
          variant={canBack ? "default" : "outline"}
          className="w-full h-8 text-xs font-semibold mt-auto gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          disabled={!canBack}
        >
          {!project.approved ? (
            "Pending Approval"
          ) : project.fundingClosed ? (
            "View Project"
          ) : (
            <>
              <Zap className="w-3 h-3" /> Back this Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
