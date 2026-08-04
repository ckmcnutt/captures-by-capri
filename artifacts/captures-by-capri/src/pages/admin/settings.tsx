import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { format } from "date-fns";
import { useAdminAuth } from "./auth-guard";
import { authFetch } from "@/lib/auth-fetch";

interface Carrier {
  id: string;
  label: string;
}

interface AdminSettings {
  admin_phone_number: string | null;
  admin_phone_carrier: string | null;
  carriers: Carrier[];
}

interface PricingRow {
  kind: string;
  amount_cents: number;
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
      setMessage("Saved — applies to future deposits and final invoices that don't already have an amount set.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-4">
      <h3 className="font-serif text-lg tracking-wide">{KIND_LABELS[row.kind] ?? row.kind}</h3>

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

export default function AdminSettingsPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");
  const [, navigate] = useLocation();
  const { checked, authed, commit } = useAdminAuth();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await authFetch("/api/admin/settings", { method: "GET" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as AdminSettings;
      setPhoneNumber(data.admin_phone_number ?? "");
      setCarrier(data.admin_phone_carrier ?? "");
      setCarriers(data.carriers);
    } catch {
      setLoadError("Could not load admin notification settings.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError("");
    try {
      const res = await authFetch("/api/admin/pricing", { method: "GET" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Failed to load pricing");
      const data = (await res.json()) as PricingRow[];
      setPricingRows(data);
    } catch {
      setPricingError("Could not load default pricing.");
    } finally {
      setPricingLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!authed) return;
    fetchSettings();
    fetchPricing();
  }, [authed, fetchSettings, fetchPricing]);

  function handlePricingSaved(updated: PricingRow) {
    setPricingRows((prev) => prev.map((r) => (r.kind === updated.kind ? updated : r)));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          admin_phone_number: phoneNumber,
          admin_phone_carrier: carrier,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setMessage("Saved. New booking requests, deposits, and final invoice payments will text this number.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch("/api/admin/settings/test", {
        method: "POST",
        body: JSON.stringify({
          admin_phone_number: phoneNumber,
          admin_phone_carrier: carrier,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setMessage("Test text sent — check your phone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
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

  const canSave = /^\d{10}$/.test(phoneNumber.replace(/\D/g, "")) && carrier !== "";

  return (
    <AdminLayout onLogout={handleLogout} commit={commit}>
      <div className="mb-8">
        <h1 className="font-serif text-3xl tracking-wider">Settings</h1>
      </div>

      <section className="mb-12">
        <div className="mb-6">
          <h2 className="font-serif text-xl tracking-wide">Default Pricing</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Starting amounts for a new deposit request or final invoice. Confirming an
            appointment always lets you set (or change) its deposit amount before sending, and
            a final invoice amount can be overridden per-appointment too — these defaults only
            apply when nothing more specific has been set.
          </p>
        </div>

        {pricingLoading && (
          <div className="text-muted-foreground text-sm tracking-widest uppercase animate-pulse">Loading…</div>
        )}
        {pricingError && <div className="text-red-400 text-sm">{pricingError}</div>}

        {!pricingLoading && !pricingError && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...pricingRows]
              .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
              .map((row) => (
                <PricingCard key={row.kind} row={row} onSaved={handlePricingSaved} />
              ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-serif text-xl tracking-wide">Notification Settings</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The photographer's phone number and carrier, texted via that carrier's SMS
            gateway whenever a new appointment is requested, a deposit is paid, or a
            final invoice is paid.
          </p>
        </div>

        {loading && (
          <div className="text-muted-foreground text-sm tracking-widest uppercase animate-pulse">Loading…</div>
        )}
        {loadError && <div className="text-red-400 text-sm">{loadError}</div>}

        {!loading && !loadError && (
          <div className="border border-border/50 rounded-lg p-6 space-y-4 max-w-md">
            <div className="space-y-2">
              <label className="text-xs tracking-widest uppercase text-muted-foreground">
                Phone number
              </label>
              <input
                type="tel"
                placeholder="(555) 555-0100"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs tracking-widest uppercase text-muted-foreground">
                Carrier
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-zinc-600 transition-colors"
              >
                <option value="" disabled>
                  Select a carrier…
                </option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || testing || !canSave}
                className="inline-flex items-center justify-center px-4 py-2 text-xs tracking-widest uppercase font-medium rounded transition-all bg-white text-zinc-950 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "…" : "Save"}
              </button>
              <button
                onClick={handleTest}
                disabled={saving || testing || !canSave}
                className="inline-flex items-center justify-center px-4 py-2 text-xs tracking-widest uppercase font-medium rounded border border-zinc-700 text-foreground hover:bg-zinc-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "…" : "Send test"}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
            )}
            {message && !error && (
              <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">{message}</p>
            )}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
