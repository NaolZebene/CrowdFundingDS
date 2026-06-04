import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "wouter";
import { XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardShell({
  title,
  subtitle,
  roleLabel,
  navMode = "user",
  showAdminShortcutInUserNav = false,
  children,
}: {
  title: string;
  subtitle: string;
  roleLabel: string;
  navMode?: "admin" | "user";
  showAdminShortcutInUserNav?: boolean;
  children: React.ReactNode;
}) {
  const navLinks = navMode === "admin"
    ? []
    : [
        ...(showAdminShortcutInUserNav ? [{ label: "Admin Dashboard", href: "/dashboard" }] : []),
        { label: "Markets", href: "/" },
        { label: "AMM Swap", href: "/amm" },
        { label: "Portfolio", href: "/portfolio" },
        { label: "My Projects", href: "/my-projects" },
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center shrink-0 cursor-pointer">
              <span className="font-bold text-sm tracking-wide">Raise</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href}>
                <button className={`px-3 py-1.5 rounded hover:bg-secondary hover:text-foreground transition-colors ${link.href === "/dashboard" ? "bg-secondary text-foreground" : ""}`}>
                  {link.label}
                </button>
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="uppercase font-mono text-[10px]">
              {roleLabel}
            </Badge>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">
            Role Dashboard
          </p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export function AccessDenied({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-8 text-center space-y-3">
        <XCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Link href={ctaHref}>
          <Button size="sm" className="h-8 text-xs">{ctaLabel}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
