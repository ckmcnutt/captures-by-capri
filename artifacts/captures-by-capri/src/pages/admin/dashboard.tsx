import { useState, useEffect, useCallback } from "react";
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
  stripe_final_invoice_id: string | null;
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

function StatusBadge({ statusName }: { statusName: string }) {
  const colors = STATUS_COLORS[statusName] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  const label = statusName.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors} capitalize`}>
      {label}
    </span>
  );
}

function DetailPanel({
  appt,
  onClose,
}: {
  appt: Appointment;
  onClose: () => void;
}) {
  const customer = appt.customer;
  const status = appt.appointment_status;
  const category = appt.category;
  const startDate = new Date(appt.start_time);
  const endDate = new Date(appt.end_time);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-950 border-l border-border/50 overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-zinc-950 border-b border-border/50 p-6 flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-wide">
            Appointment #{appt.id}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm tracking-widest uppercase"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            {status && <StatusBadge statusName={status.status_name} />}
            <span className="text-muted-foreground text-sm">
              {category?.category_name ?? "—"}
            </span>
          </div>

          <section>
            <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
              Session
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{format(startDate, "MMMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>
                  {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aesthetic</span>
                <span className="text-right max-w-xs">{appt.aesthetic}</span>
              </div>
            </div>
          </section>

          {customer && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Client
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>
                    {customer.first_name} {customer.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <a
                    href={`mailto:${customer.email_address}`}
                    className="hover:text-foreground/70 transition-colors"
                  >
                    {customer.email_address}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <a
                    href={`tel:${customer.phone_number}`}
                    className="hover:text-foreground/70 transition-colors"
                  >
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

          {appt.customer_notes && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Client Notes
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {appt.customer_notes}
              </p>
            </section>
          )}

          {appt.internal_notes && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Internal Notes
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {appt.internal_notes}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
              Payment
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit invoice</span>
                <span>{appt.stripe_deposit_invoice_id ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final invoice</span>
                <span>{appt.stripe_final_invoice_id ?? "—"}</span>
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

          {appt.photo_delivery_url && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Photo Delivery
              </h3>
              <a
                href={appt.photo_delivery_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground/80 hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {appt.photo_delivery_url}
              </a>
            </section>
          )}

          {appt.cal_booking_uid && (
            <section>
              <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Cal.com
              </h3>
              <p className="text-sm font-mono text-muted-foreground">
                {appt.cal_booking_uid}
              </p>
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

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = statusFilter
        ? `/api/admin/appointments?status=${encodeURIComponent(statusFilter)}`
        : "/api/admin/appointments";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) {
        navigate("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load appointments");
      const data = await res.json();
      setAppointments(data);
    } catch {
      setError("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, navigate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

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
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-muted-foreground text-sm tracking-widest uppercase animate-pulse">
          Loading…
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && appointments.length === 0 && (
        <p className="text-muted-foreground text-sm">No appointments found.</p>
      )}

      {!loading && !error && appointments.length > 0 && (
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium hidden md:table-cell">
                  Session type
                </th>
                <th className="text-left px-4 py-3 text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium hidden lg:table-cell">
                  Date &amp; time
                </th>
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
                    onClick={() => setSelected(appt)}
                    className="border-b border-border/30 last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-4">
                      {status ? (
                        <StatusBadge statusName={status.status_name} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {customer ? (
                        <span>
                          {customer.first_name} {customer.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden md:table-cell">
                      {appt.category?.category_name ?? "—"}
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
        <DetailPanel appt={selected} onClose={() => setSelected(null)} />
      )}
    </AdminLayout>
  );
}
