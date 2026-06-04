import { Link } from "wouter";
import {
  BarChart3,
  CircleDollarSign,
  Eye,
  KeyRound,
  Layers,
  LayoutDashboard,
  PackageCheck,
  Settings,
  Shield,
} from "lucide-react";

export type AdminSection =
  | "overview"
  | "approvals"
  | "financials"
  | "revenue"
  | "vault"
  | "amm"
  | "permissions";

export function AdminSidebar({
  section,
  onSection,
}: {
  section: AdminSection;
  onSection: (next: AdminSection) => void;
}) {
  const items: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "approvals", label: "Approvals", icon: <PackageCheck className="w-4 h-4" /> },
    { id: "financials", label: "Financial Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "revenue", label: "Revenue", icon: <CircleDollarSign className="w-4 h-4" /> },
    { id: "vault", label: "Vault Config", icon: <Settings className="w-4 h-4" /> },
    { id: "amm", label: "AMM Config", icon: <Layers className="w-4 h-4" /> },
    { id: "permissions", label: "Permissions", icon: <KeyRound className="w-4 h-4" /> },
  ];

  return (
    <aside className="bg-card border border-border rounded-lg h-fit lg:sticky lg:top-20 lg:min-h-[calc(100vh-6.5rem)] overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Admin Console</p>
            <p className="text-[11px] text-muted-foreground mt-1">Protocol controls</p>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSection(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-xs transition-colors ${section === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="pt-2 mt-2 border-t border-border">
          <Link href="/">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <Eye className="w-4 h-4" />
              User Mode
            </button>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
