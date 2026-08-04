import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
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

  useEffect(() => {
    if (!authed) return;
    fetchSettings();
  }, [authed, fetchSettings]);

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
        <h1 className="font-serif text-3xl tracking-wider">Notification Settings</h1>
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
    </AdminLayout>
  );
}
