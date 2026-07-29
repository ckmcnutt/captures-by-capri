import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { format } from "date-fns";
import { useAdminAuth } from "./auth-guard";
import { authFetch } from "@/lib/auth-fetch";

interface PricingRow {
  kind: string;
  amount_cents: number;
  stripe_price_id: string | null;
  stripe_payment_link_id: string | null;
  stripe_payment_link_url: string | null;
  updated_at: string;
}

const KIND_LABELS: Record<string, string> = {
  deposit: "Deposit",
  final_30: "Final Invoice — 30 min session",
  final_60: "Final Invoice — 1 hr session",
};

const KIND_ORDER = ["deposit", "final_30", "final_60"];

function PricingCard({
  row,
  onSaved,
}: {
  row: PricingRow;
  onSaved: (row: PricingRow) => void;
}) {
  const [amount, setAmount] = useState(String(row.amount_cents / 100));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`/api/admin/pricing/${row.kind}`, {
        method: "PUT",
        body: JSON.stringify({ amount: parsed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { config: PricingRow };
      onSaved(data.config);
      setMessage("Saved — applies to new sends going forward; existing appointments are unaffected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg tracking-wide">{KIND_LABELS[row.kind] ?? row.kind}</h3>
        {row.stripe_payment_link_url ? (
          <a
            href={row.stripe_payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Open current link ↗
          </a>
        ) : (
          <span className="text-xs text-amber-400">Not configured yet</span>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-muted-foreground text-sm">$</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-zinc-600 transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
          className="inline-flex items-center justify-center px-4 py-2 text-xs tracking-widest uppercase font-medium rounded transition-all bg-white text-zinc-950 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
      )}
      {message && !error && (
        <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">{message}</p>
      )}

      <p className="text-xs text-muted-foreground/60">
        Last updated {format(new Date(row.updated_at), "MMM d, yyyy 'at' h:mm a")}
      </p>
    </div>
  );
}

export default function AdminPricing() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const { checked, authed, commit } = useAdminAuth();

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/pricing", { method: "GET" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Failed to load pricing");
      const data = (await res.json()) as PricingRow[];
      setRows(data);
    } catch {
      setError("Could not load pricing config.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!authed) return;
    fetchPricing();
  }, [authed, fetchPricing]);

  function handleSaved(updated: PricingRow) {
    setRows((prev) => prev.map((r) => (r.kind === updated.kind ? updated : r)));
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    navigate("/admin/login");
  }

  if (!checked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background dark">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Checking…</p>
      </div>
    );
  }

  if (!authed) return null;

  const sorted = [...rows].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );

  return (
    <AdminLayout onLogout={handleLogout} commit={commit}>
      <div className="mb-8">
        <h1 className="font-serif text-3xl tracking-wider">Pricing</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Each price is a persistent Stripe payment link, shared by every customer. Saving a
          new amount regenerates that link and makes it the default for future confirmations
          and final invoices — appointments already in progress keep the link they already
          have.
        </p>
      </div>

      {loading && (
        <div className="text-muted-foreground text-sm tracking-widest uppercase animate-pulse">Loading…</div>
      )}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((row) => (
            <PricingCard key={row.kind} row={row} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
