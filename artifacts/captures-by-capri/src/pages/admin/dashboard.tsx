import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { format } from "date-fns";

interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string;
  preferred_contact_method: string;
}

interface Category {
  id: number;
  category_name: string;
  category_desc: string | null;
}

interface AppointmentStatus {
  id: number;
  status_name: string;
  status_desc: string | null;
}

interface Appointment {
  id: number;
  start_time: string;
  end_time: string;
  aesthetic: string;
  customer_notes: string | null;
  internal_notes: string | null;
  cal_booking_uid: string | null;
  stripe_deposit_invoice_id: string | null;
  stripe_deposit_url: string | null;
  stripe_final_invoice_id: string | null;
  stripe_final_url: string | null;
  final_invoice_amount: number | null;
  photo_delivery_url: string | null;
  created_at: string;
  customer: Customer | null;
  category: Category | null;
  appointment_status: AppointmentStatus | null;
}

const STATUS_COLORS: Record<string, string> = {
  appointment_requested: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  appointment_confirmed: "bg-green-500/20 text-green-300 border-green-500/30",
  appointment_canceled: "bg-red-500/20 text-red-400 border-red-500/30",
  appointment_rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  deposit_requested: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  deposit_paid: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  invoice_sent: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  invoice_paid: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  editing_photos: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  photos_released: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  appointment_complete: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const TIMELINE_STEPS = [
  { key: "appointment_requested", label: "Requested" },
  { key: "deposit_requested", label: "Deposit sent" },
  { key: "deposit_paid", label: "Deposit paid" },
  { key: "invoice_sent", label: "Invoice sent" },
  { key: "invoice_paid", label: "Invoice paid" },
  { key: "editing_photos", label: "Editing" },
  { key: "photos_released", label: "Photos out" },
  { key: "appointment_complete", label: "Complete" },
];

const TERMINAL_STATUSES = new Set(["appointment_canceled", "appointment_rejected"]);

function StatusBadge({ statusName }: { statusName: string }) {
  const colors = STATUS_COLORS[statusName] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  const label = statusName.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors} capitalize`}>
      {label}
    </span>
  );
}

function StatusTimeline({ statusName }: { statusName: string }) {
  if (TERMINAL_STATUSES.has(statusName)) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-400 capitalize">{statusName.replace(/_/g, " ")}</span>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === statusName);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-0 min-w-max">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    active
                      ? "bg-white ring-2 ring-white/30"
                      : done
                        ? "bg-zinc-400"
                        : "bg-zinc-700"
                  }`}
                />
                <span
                  className={`text-[9px] tracking-wide uppercase whitespace-nowrap ${
                    active ? "text-white" : done ? "text-zinc-500" : "text-zinc-700"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < TIMELINE_STEPS.length - 1 && (
                <div className={`w-8 h-px mb-3 mx-1 ${i < currentIdx ? "bg-zinc-500" : "bg-zinc-800"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  variant = "default",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "danger" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const base = "inline-flex items-center justify-center px-4 py-2 text-xs tracking-widest uppercase font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    default: "bg-white text-zinc-950 hover:bg-white/90",
    danger: "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30",
    secondary: "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700",
    ghost: "text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

function DetailPanel({
  appt,
  onClose,
  onRefresh,
}: {
  appt: Appointment;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const customer = appt.customer;
  const status = appt.appointment_status;
  const category = appt.category;
  const startDate = new Date(appt.start_time);
  const endDate = new Date(appt.end_time);
  const statusName = status?.status_name ?? "";
  const isPast = new Date(appt.end_time) < new Date();

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [finalPrice, setFinalPrice] = useState(
    appt.final_invoice_amount != null ? String(appt.final_invoice_amount) : ""
  );
  const [photoUrl, setPhotoUrl] = useState(appt.photo_delivery_url ?? "");
  const [rejectReason, setRejectReason] = useState("");

  async function apiCall(method: string, path: string, body?: object): Promise<void> {
    const res = await fetch(`/api/admin/appointments/${appt.id}/${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
  }

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    setError("");
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-950 border-l border-border/50 overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-zinc-950 border-b border-border/50 p-6 flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-wide">Appointment #{appt.id}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm tracking-widest uppercase"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status + timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {status && <StatusBadge statusName={status.status_name} />}
            </div>
            <StatusTimeline statusName={statusName} />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* ── Actions ── */}
          {statusName === "appointment_requested" && (
            <section className="space-y-3">
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Actions</h3>
              <div className="flex gap-3">
                <ActionButton onClick={() => run("confirm", () => apiCall("POST", "confirm"))} loading={loading === "confirm"}>
                  Confirm
                </ActionButton>
                <ActionButton variant="danger" onClick={() => run("reject", () => apiCall("POST", "reject", { reason: rejectReason || undefined }))} loading={loading === "reject"}>
                  Reject
                </ActionButton>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rejection reason (optional)</label>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="We are unable to accommodate…"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
            </section>
          )}

          {statusName === "deposit_requested" && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Actions</h3>
              <ActionButton variant="secondary" onClick={() => run("remind", () => apiCall("POST", "remind-deposit"))} loading={loading === "remind"}>
                Send Deposit Reminder
              </ActionButton>
            </section>
          )}

          {statusName === "deposit_paid" && (
            <section className="space-y-3">
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Final Invoice</h3>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  placeholder="e.g. 350.00"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                <ActionButton
                  variant="ghost"
                  onClick={() => run("set-price", () => apiCall("PATCH", "set-price", { amount: parseFloat(finalPrice) }))}
                  loading={loading === "set-price"}
                  disabled={!finalPrice || isNaN(parseFloat(finalPrice))}
                >
                  Save
                </ActionButton>
              </div>
              <ActionButton
                onClick={() => run("send-final-invoice", () => apiCall("POST", "send-final-invoice"))}
                loading={loading === "send-final-invoice"}
                disabled={!appt.final_invoice_amount}
              >
                Send Final Invoice
              </ActionButton>
              {!appt.final_invoice_amount && (
                <p className="text-xs text-muted-foreground/70">Set and save a price first.</p>
              )}
              {isPast && (
                <ActionButton
                  variant="secondary"
                  onClick={() => run("mark-editing", () => apiCall("POST", "mark-editing"))}
                  loading={loading === "mark-editing"}
                >
                  Mark as Editing
                </ActionButton>
              )}
            </section>
          )}

          {statusName === "invoice_sent" && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Actions</h3>
              <ActionButton
                variant="secondary"
                onClick={() => run("remind-final", () => apiCall("POST", "remind-final-invoice"))}
                loading={loading === "remind-final"}
              >
                Send Final Invoice Reminder
              </ActionButton>
            </section>
          )}

          {(statusName === "invoice_paid" || (statusName === "deposit_paid" && isPast)) && statusName !== "deposit_paid" && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Actions</h3>
              {isPast && (
                <ActionButton
                  variant="secondary"
                  onClick={() => run("mark-editing", () => apiCall("POST", "mark-editing"))}
                  loading={loading === "mark-editing"}
                >
                  Mark as Editing
                </ActionButton>
              )}
            </section>
          )}

          {statusName === "invoice_paid" && isPast && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Actions</h3>
              <ActionButton
                variant="secondary"
                onClick={() => run("mark-editing", () => apiCall("POST", "mark-editing"))}
                loading={loading === "mark-editing"}
              >
                Mark as Editing
              </ActionButton>
            </section>
          )}

          {statusName === "editing_photos" && (
            <section className="space-y-3">
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Send Photo Link</h3>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-zinc-600 transition-colors"
              />
              <ActionButton
                onClick={() => run("send-photo-link", () => apiCall("POST", "send-photo-link", { photoUrl }))}
                loading={loading === "send-photo-link"}
                disabled={!photoUrl.trim()}
              >
                Send to Client
              </ActionButton>
            </section>
          )}

          {/* ── Session ── */}
          <section>
            <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Session</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{format(startDate, "MMMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>{format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aesthetic</span>
                <span className="text-right max-w-xs">{appt.aesthetic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Type</span>
                <span className="text-right max-w-xs">{appt.category?.category_desc}</span>
              </div>
            </div>
          </section>

          {/* ── Client ── */}
          {customer && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Client</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{customer.first_name} {customer.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <a href={`mailto:${customer.email_address}`} className="hover:text-foreground/70 transition-colors">
                    {customer.email_address}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <a href={`tel:${customer.phone_number}`} className="hover:text-foreground/70 transition-colors">
                    {customer.phone_number}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preferred contact</span>
                  <span className="capitalize">{customer.preferred_contact_method}</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Notes ── */}
          {appt.customer_notes && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Client Notes</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{appt.customer_notes}</p>
            </section>
          )}

          {appt.internal_notes && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Internal Notes</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{appt.internal_notes}</p>
            </section>
          )}

          {/* ── Payment ── */}
          <section>
            <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Deposit link</span>
                {appt.stripe_deposit_url ? (
                  <a
                    href={appt.stripe_deposit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[12rem]"
                  >
                    Open link ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Final invoice link</span>
                {appt.stripe_final_url ? (
                  <a
                    href={appt.stripe_final_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[12rem]"
                  >
                    Open link ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final amount</span>
                <span>
                  {appt.final_invoice_amount != null
                    ? `$${appt.final_invoice_amount.toFixed(2)}`
                    : "—"}
                </span>
              </div>
            </div>
          </section>

          {/* ── Photo Delivery ── */}
          {appt.photo_delivery_url && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Photo Delivery</h3>
              <a
                href={appt.photo_delivery_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground/80 hover:text-foreground underline underline-offset-2 transition-colors break-all"
              >
                {appt.photo_delivery_url}
              </a>
            </section>
          )}

          {/* ── Cal.com ── */}
          {appt.cal_booking_uid && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Cal.com</h3>
              <p className="text-sm font-mono text-muted-foreground">{appt.cal_booking_uid}</p>
            </section>
          )}

          <p className="text-xs text-muted-foreground/50 pt-2">
            Booked {format(new Date(appt.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
    </div>
  );
}

const ALL_STATUSES = [
  "appointment_requested",
  "appointment_confirmed",
  "appointment_canceled",
  "appointment_rejected",
  "deposit_requested",
  "deposit_paid",
  "invoice_sent",
  "invoice_paid",
  "editing_photos",
  "photos_released",
  "appointment_complete",
];

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [, navigate] = useLocation();
  const selectedIdRef = useRef<number | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = statusFilter === "all"
        ? "/api/admin/appointments"
        : statusFilter
          ? `/api/admin/appointments?status=${encodeURIComponent(statusFilter)}`
          : "/api/admin/appointments?status=appointment_requested&status=deposit_requested&status=deposit_paid&status=invoice_sent&status=invoice_paid&status=editing_photos";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (!res.ok) throw new Error("Failed to load appointments");
      const data = (await res.json()) as Appointment[];
      setAppointments(data);
      if (selectedIdRef.current != null) {
        const updated = data.find((a) => a.id === selectedIdRef.current);
        setSelected(updated ?? null);
      }
    } catch {
      setError("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, navigate]);

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleSelect(appt: Appointment) {
    selectedIdRef.current = appt.id;
    setSelected(appt);
  }

  function handleClose() {
    selectedIdRef.current = null;
    setSelected(null);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    navigate("/admin/login");
  }

  return (
    <AdminLayout onLogout={handleLogout}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-serif text-3xl tracking-wider">Appointments</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-transparent border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 transition-colors"
        >
          <option value="">Active (default)</option>
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-muted-foreground text-sm tracking-widest uppercase animate-pulse">Loading…</div>
      )}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!loading && !error && appointments.length === 0 && (
        <p className="text-muted-foreground text-sm">No appointments found.</p>
      )}

      {!loading && !error && appointments.length > 0 && (
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">Client</th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium hidden md:table-cell">Session type</th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium hidden lg:table-cell">Date &amp; time</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => {
                const customer = appt.customer;
                const status = appt.appointment_status;
                const startDate = new Date(appt.start_time);
                return (
                  <tr
                    key={appt.id}
                    onClick={() => handleSelect(appt)}
                    className="border-b border-border/30 last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-4">
                      {status ? <StatusBadge statusName={status.status_name} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      {customer ? <span>{customer.first_name} {customer.last_name}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden md:table-cell">
                      {appt.category?.category_desc ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden lg:table-cell">
                      {format(startDate, "MMM d, yyyy 'at' h:mm a")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetailPanel
          appt={selected}
          onClose={handleClose}
          onRefresh={fetchAppointments}
        />
      )}
    </AdminLayout>
  );
}
