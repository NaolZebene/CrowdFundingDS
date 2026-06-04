import { ArrowUpRight, ExternalLink } from "lucide-react";
import type { FundingNotification } from "@/hooks/usePortfolioData";
import { fmtUSD, shortAddr } from "@/utils/myProjectsFormatters";

interface FundingNotificationRowProps {
  notification: FundingNotification;
}

export function FundingNotificationRow({ notification }: FundingNotificationRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium">{fmtUSD(notification.amount)} received</p>
          <p className="text-[10px] text-muted-foreground">
            {shortAddr(notification.investor)} · {notification.date}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
          {notification.projectName}
        </span>
        <a
          href={`https://sepolia.etherscan.io/tx/${notification.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
