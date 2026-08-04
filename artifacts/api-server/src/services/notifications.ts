import { env } from "../env";
import { gatewayDomainForCarrier, gatewayDomainForCarrierId, lookupCarrier } from "../lib/carrier-lookup";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { normalizeUsPhoneDigits } from "../lib/phone";
import { getAdminSettings } from "../repositories/admin-settings";

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
    await sendTextViaCarrierGateway(customer.phone_number, message);
  } else {
    await sendEmail(customer.email_address, subject, message);
  }
}

/**
 * "Texts" a phone number by emailing its carrier's SMS gateway address (e.g.
 * 5555550100@vtext.com) — no SMS API or per-message cost involved, just the
 * existing SMTP transport. The carrier has to be looked up rather than
 * guessed from the number, since numbers get ported between carriers and
 * the area code/prefix stops being a reliable signal once that happens.
 *
 * Used for client texts only (notifyClient) — the admin's own carrier is
 * configured directly rather than looked up, see notifyAdmin below.
 * Degrades to a warn-and-skip at every step (bad number, no API key, unknown
 * carrier), matching the rest of this file. Subject is intentionally blank:
 * carrier gateways fold it into the text body inconsistently across
 * carriers, and a real SMS never had a subject line to begin with.
 */
async function sendTextViaCarrierGateway(phoneNumber: string, message: string): Promise<void> {
  const digits = normalizeUsPhoneDigits(phoneNumber);
  if (!digits) {
    logger.warn({ phoneNumber }, "Not a 10-digit US number — can't text via carrier gateway");
    return;
  }

  const carrier = await lookupCarrier(`+1${digits}`);
  if (!carrier) return;

  const domain = gatewayDomainForCarrier(carrier);
  if (!domain) {
    logger.warn({ carrier }, "No known SMS gateway domain for this carrier — text not sent");
    return;
  }

  await sendEmail(`${digits}@${domain}`, "", message);
}

export interface AdminTextResult {
  ok: boolean;
  reason?: string;
}

/**
 * Texts an explicit phone number/carrier pair via that carrier's gateway,
 * bypassing the AbstractAPI lookup entirely — used both by notifyAdmin (with
 * the saved admin_settings row) and the admin settings page's "test" button
 * (with whatever's currently in the form, saved or not). Unlike the rest of
 * this file it reports back why a send didn't happen, since the test button
 * needs to show the admin something more useful than a server log line.
 */
async function sendAdminText(
  phoneNumber: string,
  carrierId: string,
  message: string,
): Promise<AdminTextResult> {
  const digits = normalizeUsPhoneDigits(phoneNumber);
  if (!digits) {
    return { ok: false, reason: "Not a 10-digit US phone number" };
  }

  const domain = gatewayDomainForCarrierId(carrierId);
  if (!domain) {
    return { ok: false, reason: "Not a supported carrier" };
  }

  await sendEmail(`${digits}@${domain}`, "", message);
  return { ok: true };
}

/**
 * Text the photographer via their carrier's gateway. Phone number and
 * carrier are configured on the admin settings page (persisted in
 * admin_settings, see repositories/admin-settings.ts) rather than looked up
 * via AbstractAPI on every send — it's a single fixed number, so there's no
 * reason to spend an API call figuring out its carrier every time.
 * No-ops with a warning when either is unset or unrecognized.
 */
export async function notifyAdmin(message: string): Promise<void> {
  const { admin_phone_number, admin_phone_carrier } = await getAdminSettings();
  if (!admin_phone_number || !admin_phone_carrier) {
    logger.warn(
      { message },
      "Admin phone number/carrier not configured — admin notification not sent",
    );
    return;
  }

  const result = await sendAdminText(admin_phone_number, admin_phone_carrier, message);
  if (!result.ok) {
    logger.warn(
      { phoneNumber: admin_phone_number, carrier: admin_phone_carrier, reason: result.reason },
      "Admin notification not sent",
    );
  }
}

/** Backs the admin settings page's "test" button — same gateway path notifyAdmin uses. */
export async function sendAdminTestMessage(
  phoneNumber: string,
  carrierId: string,
): Promise<AdminTextResult> {
  return sendAdminText(
    phoneNumber,
    carrierId,
    "Test message from Captures By Capri admin settings. If you got this, notifications are working.",
  );
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
