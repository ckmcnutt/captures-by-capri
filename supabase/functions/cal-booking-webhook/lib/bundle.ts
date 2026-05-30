import { SupabaseContext } from "@supabase/server";
import type { Database, Appointment, Customer, Category } from "./database.types.ts";

export const headers = { "Content-Type": "application/json" };
export function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers });
}
export function normString(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}
export class APIError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, APIError.prototype);
    this.name = "APIError";
  }
}
export enum WebhookEvent {
  BOOKING_CANCELED = "BOOKING_CANCELED",
  BOOKING_REJECTED = "BOOKING_REJECTED",
  BOOKING_CREATED = "BOOKING_CREATED",
  BOOKING_REQUESTED = "BOOKING_REQUESTED",
  BOOKING_RESCHEDULED = "BOOKING_RESCHEDULED",
}
export type CalPayload = { bookingId?: number; uid?: string; startTime?: string; endTime?: string; responses?: Record<string, { value?: unknown }>; cancellationReason?: string; rejectionReason?: string; };
export type CalEventMessage = { triggerEvent?: string; createdAt?: string; payload?: CalPayload; };

class AppointmentService {
  constructor(private ctx: SupabaseContext<Database>) {}
  async insert(a: Appointment): Promise<number> {
    const { error, data } = await this.ctx.supabase.from("appointment").insert(a).select();
    if (error) throw error;
    return data[0].id;
  }
  async updateStatus(id: number, status_id: number, notes: string) {
    const { error } = await this.ctx.supabase.from("appointment").update({ status_id, internal_notes: notes }).eq("id", id);
    if (error) throw error;
  }
}
class CustomerService {
  constructor(private ctx: SupabaseContext<Database>) {}
  async insert(c: Customer): Promise<number> {
    const { error, data } = await this.ctx.supabase.from("customer").insert(c).select();
    if (error) throw error;
    return data[0].id;
  }
  async getByEmail(email: string): Promise<Customer | null> {
    const { data, error } = await this.ctx.supabase.from("customer").select().eq("email_address", email);
    if (error) throw error;
    return (data[0] as Customer) ?? null;
  }
}
class CategoryService {
  constructor(private ctx: SupabaseContext<Database>) {}
  async list(): Promise<Category[]> {
    const { error, data } = await this.ctx.supabase.from("category").select();
    if (error) throw error;
    return (data as Category[]) ?? [];
  }
}

async function sendAdminSms(first: string, last: string, session: string, start: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  const to = Deno.env.get("ADMIN_PHONE_NUMBER");
  if (!sid || !tok || !from || !to) { console.warn("Twilio not configured"); return; }
  const d = new Date(start);
  const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const body = "New booking request! Client: " + first + " " + last + ". Session: " + session + ". " + dateStr + " at " + timeStr + ". Log in to review.";
  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(sid + ":" + tok), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (!res.ok) console.error("Twilio SMS failed: " + res.status); else console.debug("Admin SMS sent");
}

export async function processWebhookEvent(msg: CalEventMessage, ctx: SupabaseContext<Database>): Promise<void> {
  const trig = normString(msg.triggerEvent) ?? "";
  const p = msg.payload;
  if (!p) throw new APIError("Missing payload", 400);
  if (!p.bookingId) throw new APIError("Missing bookingId", 400);
  const apptSvc = new AppointmentService(ctx);
  if (trig === WebhookEvent.BOOKING_CANCELED) {
    await apptSvc.updateStatus(p.bookingId, 2, "CANCELED: " + p.cancellationReason);
  } else if (trig === WebhookEvent.BOOKING_REJECTED) {
    await apptSvc.updateStatus(p.bookingId, 12, "REJECTED: " + p.rejectionReason);
  } else if (trig === WebhookEvent.BOOKING_REQUESTED) {
    const r = p.responses;
    if (!r) throw new APIError("No responses", 400);
    const missing: string[] = [];
    const g = (k: string) => { const v = r[k]?.value as string; if (!v) missing.push(k); return v ?? ""; };
    const nameVal = r["name"]?.value as Record<string, string> | undefined;
    const first_name = nameVal?.first_name ?? (missing.push("firstName"), "");
    const last_name = nameVal?.last_name ?? (missing.push("lastName"), "");
    const email_address = g("email");
    const phone_number = g("attendeePhoneNumber");
    const preferred_contact_method = g("contact_method");
    const aesthetic = g("aesthetic");
    const session_type = g("session_type");
    const customer_notes = r["notes"]?.value as string;
    const start_time = p.startTime ?? (missing.push("startTime"), "");
    const end_time = p.endTime ?? (missing.push("endTime"), "");
    if (missing.length) throw new APIError("Missing: " + missing.join(","), 400);
    const custSvc = new CustomerService(ctx);
    const existing = await custSvc.getByEmail(email_address);
    const customer_id = existing?.id ?? await custSvc.insert({ first_name, last_name, email_address, phone_number, preferred_contact_method });
    const cats = await new CategoryService(ctx).list();
    const cat = cats.find((c) => c.category_name?.toLowerCase().includes(session_type.trim().toLowerCase()));
    const { data: sr, error: se } = await ctx.supabase.from("appointment_status").select("id").eq("status_name", "appointment_requested").limit(1);
    if (se) throw se;
    const status_id = (sr as {id: number}[])?.[0]?.id ?? null;
    await apptSvc.insert({ id: p.bookingId, start_time, end_time, category_id: cat?.id as number, aesthetic, customer_notes, customer_id, status_id, cal_booking_uid: p.uid ?? null });
    await sendAdminSms(first_name, last_name, session_type, start_time);
  }
}
