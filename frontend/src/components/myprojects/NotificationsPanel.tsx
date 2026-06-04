import { Bell, Loader2 } from "lucide-react";
import type { FundingNotification } from "@/hooks/usePortfolioData";
import { FundingNotificationRow } from "./FundingNotificationRow";

interface NotificationsPanelProps {
  notifications: FundingNotification[];
  isLoading: boolean;
}

export function NotificationsPanel({ notifications, isLoading }: NotificationsPanelProps) {
  return (
    <div className="border border-border rounded-2xl bg-card p-4 h-fit">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Bell className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Funding Activity</h3>
          <p className="text-[10px] text-muted-foreground">
            Recent investments in your projects
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No recent funding activity
        </div>
      ) : (
        <div className="space-y-0">
          {notifications.slice(0, 10).map((n) => (
            <FundingNotificationRow key={n.id} notification={n} />
          ))}
          {notifications.length > 10 && (
            <p className="text-[10px] text-muted-foreground text-center pt-2">
              +{notifications.length - 10} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
