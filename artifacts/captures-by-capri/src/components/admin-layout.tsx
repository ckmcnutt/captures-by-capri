import React from "react";
import { Link } from "wouter";

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
  commit?: string | null;
}

export function AdminLayout({ children, onLogout, commit }: AdminLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="border-b border-border/50 py-4">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Captures by Capri"
              className="h-12 w-auto brightness-0 invert"
            />
            <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground font-medium">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
            >
              Appointments
            </Link>
            <Link
              href="/admin/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
            >
              Pricing
            </Link>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8">{children}</main>
      {commit && (
        <footer className="border-t border-border/50 py-3">
          <p className="container mx-auto px-6 text-[10px] tracking-widest uppercase text-muted-foreground/50 font-mono">
            {commit}
          </p>
        </footer>
      )}
    </div>
  );
}
