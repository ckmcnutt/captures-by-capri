import { env } from "../env";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { sendSms } from "../lib/twilio";

/** The customer fields any notification needs. */
export interface NotifiableCustomer {
  first_name: string;
  phone_number: string;
  email_address: string;
  preferred_contact_method: string;
}

const DEFAULT_SUBJECT = "Update from Captures By Capri";

/**
 * Notify a client over their preferred channel.
 *
 * Lifted out of routes/admin/actions.ts so the scheduled jobs can use it too. The
 * Supabase scheduled-jobs function only ever `console.info`'d the email branch —
 * three notifications that were never actually sent. Routing everything through
 * here means the email path works everywhere.
 *
 * Both transports degrade to a warn-and-skip when unconfigured, which is what
 * makes it safe to exercise these paths locally.
 */
export async function notifyClient(
  customer: NotifiableCustomer,
  message: string,
  subject: string = DEFAULT_SUBJECT,
): Promise<void> {
  if (customer.preferred_contact_method === "sms") {
    await sendSms(customer.phone_number, message);
  } else {
    await sendEmail(customer.email_address, subject, message);
  }
}

/** Send an SMS to the photographer. No-ops with a warning when unset. */
export async function notifyAdmin(message: string): Promise<void> {
  if (!env.ADMIN_PHONE_NUMBER) {
    logger.warn(
      { message },
      "ADMIN_PHONE_NUMBER not configured — admin notification not sent",
    );
    return;
  }
  await sendSms(env.ADMIN_PHONE_NUMBER, message);
}

/**
 * Admin alert for a new booking request, formatted as the Supabase edge function
 * did (long weekday/month date, 12-hour time).
 */
export async function notifyAdminOfBookingRequest(
  firstName: string,
  lastName: string,
  sessionType: string,
  startTime: Date,
): Promise<void> {
  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: env.CRON_TIMEZONE,
  });
  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: env.CRON_TIMEZONE,
  });

  await notifyAdmin(
    `New booking request! Client: ${firstName} ${lastName}. ` +
      `Session: ${sessionType}. ${dateStr} at ${timeStr}. Log in to review.`,
  );
}
