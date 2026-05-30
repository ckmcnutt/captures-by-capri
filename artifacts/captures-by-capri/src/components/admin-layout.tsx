import React from "react";
import { Link } from "wouter";

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

export function AdminLayout({ children, onLogout }: AdminLayoutProps) {
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
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
            >
              Logout
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
