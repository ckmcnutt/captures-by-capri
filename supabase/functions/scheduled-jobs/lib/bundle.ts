import { createClient } from "@supabase/supabase-js";

export const headers = { "Content-Type": "application/json" };

function getEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error("Missing env: " + key);
  return v;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

async function sendSms(to: string, body: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !tok || !from) { console.warn("Twilio not configured"); return; }
  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(sid + ":" + tok), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (!res.ok) console.error("SMS failed: " + res.status + " " + await res.text());
}

async function createStripePaymentLink(appointmentId: number, amountCents: number): Promise<{ url: string; id: string }> {
  const key = getEnv("STRIPE_SECRET_KEY");
  const authHeader = "Basic " + btoa(key + ":");

  const priceRes = await fetch("https://api.stripe.com/v1/prices", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      "currency": "usd",
      "unit_amount": String(amountCents),
      "product_data[name]": "Photography Session Final Invoice",
    }).toString(),
  });
  if (!priceRes.ok) throw new Error("Stripe price create failed: " + priceRes.status);
  const price = await priceRes.json() as { id: string };

  const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",
      "metadata[appointmentId]": String(appointmentId),
      "metadata[invoiceType]": "final",
    }).toString(),
  });
  if (!linkRes.ok) throw new Error("Stripe payment link create failed: " + linkRes.status);
  const link = await linkRes.json() as { id: string; url: string };
  return { url: link.url, id: link.id };
}

async function cancelCalBooking(uid: string): Promise<void> {
  const key = getEnv("CALCOM_API_KEY");
  const res = await fetch("https://api.cal.com/v2/bookings/" + uid + "/cancel", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Invoice not paid by appointment time" }),
  });
  if (!res.ok) console.error("Cal.com cancel failed: " + res.status);
}

export async function runScheduledJobs(): Promise<{ processed: number; errors: string[] }> {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const adminPhone = Deno.env.get("ADMIN_PHONE_NUMBER") ?? "";

  const db = createClient(supabaseUrl, serviceKey);
  const errors: string[] = [];
  let processed = 0;

  async function getStatusId(name: string): Promise<number | null> {
    const { data } = await db.from("appointment_status").select("id").eq("status_name", name).limit(1).single();
    return (data as { id: number } | null)?.id ?? null;
  }

  // ── Process deposit_paid appointments ────────────────────────────────────────
  const { data: depositPaidAppts, error: dpErr } = await db
    .from("appointment")
    .select(`id, start_time, end_time, final_invoice_amount, customer:customer_id(first_name, phone_number, email_address, preferred_contact_method), appointment_status:status_id(status_name)`)
    .eq("status_id", (await db.from("appointment_status").select("id").eq("status_name", "deposit_paid").limit(1).single()).data?.id ?? 0);

  if (dpErr) {
    errors.push("Failed to fetch deposit_paid appointments: " + dpErr.message);
  } else {
    for (const appt of (depositPaidAppts ?? []) as Array<Record<string, unknown>>) {
      try {
        const d = daysUntil(appt.start_time as string);
        const customer = (Array.isArray(appt.customer) ? appt.customer[0] : appt.customer) as Record<string, string> | null;

        if (d <= 3 && d > 2 && !appt.final_invoice_amount && adminPhone) {
          await sendSms(adminPhone, "Reminder: Appointment #" + String(appt.id) + " is in 3 days and has no final invoice amount set.");
          processed++;
        } else if (d <= 2 && d > 1 && appt.final_invoice_amount) {
          const amountCents = Math.round((appt.final_invoice_amount as number) * 100);
          const link = await createStripePaymentLink(appt.id as number, amountCents);
          const invoiceSentId = await getStatusId("invoice_sent");
          await db.from("appointment").update({ stripe_final_invoice_id: link.id, status_id: invoiceSentId }).eq("id", appt.id);
          if (customer) {
            const contact = customer.preferred_contact_method;
            if (contact === "sms") {
              await sendSms(customer.phone_number, "Hi " + customer.first_name + "! Your final invoice for your photography session is ready: " + link.url);
            } else {
              console.info("Email final invoice to " + customer.email_address + ": " + link.url);
            }
          }
          processed++;
        }
      } catch (e) {
        errors.push("deposit_paid appt #" + String((appt as { id: number }).id) + ": " + String(e));
      }
    }
  }

  // ── Process invoice_sent appointments ────────────────────────────────────────
  const { data: invoiceSentAppts, error: isErr } = await db
    .from("appointment")
    .select(`id, start_time, end_time, cal_booking_uid, stripe_final_invoice_id, customer:customer_id(first_name, phone_number, email_address, preferred_contact_method), appointment_status:status_id(status_name)`)
    .eq("status_id", (await db.from("appointment_status").select("id").eq("status_name", "invoice_sent").limit(1).single()).data?.id ?? 0);

  if (isErr) {
    errors.push("Failed to fetch invoice_sent appointments: " + isErr.message);
  } else {
    for (const appt of (invoiceSentAppts ?? []) as Array<Record<string, unknown>>) {
      try {
        const d = daysUntil(appt.start_time as string);
        const customer = (Array.isArray(appt.customer) ? appt.customer[0] : appt.customer) as Record<string, string> | null;

        if (d <= 1 && d > 0) {
          if (customer && customer.preferred_contact_method === "sms") {
            await sendSms(customer.phone_number, "Hi " + customer.first_name + ", your photography session is tomorrow! Please complete your final invoice payment as soon as possible to keep your session.");
          } else if (customer) {
            console.info("Email 1-day reminder to " + customer.email_address);
          }
          if (adminPhone) {
            await sendSms(adminPhone, "Warning: Appointment #" + String(appt.id) + " is tomorrow but invoice is still unpaid.");
          }
          processed++;
        } else if (d <= 0) {
          const canceledId = await getStatusId("appointment_canceled");
          await db.from("appointment").update({ status_id: canceledId, internal_notes: "Canceled: invoice not paid by appointment time" }).eq("id", appt.id);
          if (appt.cal_booking_uid) await cancelCalBooking(appt.cal_booking_uid as string);
          if (customer && customer.preferred_contact_method === "sms") {
            await sendSms(customer.phone_number, "Hi " + customer.first_name + ", your photography session with Captures By Capri has been canceled due to an unpaid invoice. Please contact us to reschedule.");
          } else if (customer) {
            console.info("Email cancellation notice to " + customer.email_address);
          }
          processed++;
        }
      } catch (e) {
        errors.push("invoice_sent appt #" + String((appt as { id: number }).id) + ": " + String(e));
      }
    }
  }

  return { processed, errors };
}
