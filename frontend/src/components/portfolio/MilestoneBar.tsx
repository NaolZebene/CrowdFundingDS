interface MilestoneBarProps {
  completed: number;
  total: number;
}

export function MilestoneBar({ completed, total }: MilestoneBarProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i < completed ? "bg-primary" : "bg-secondary"
          }`}
        />
      ))}
    </div>
  );
}
