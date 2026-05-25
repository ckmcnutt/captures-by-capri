import { logger } from "./logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ADMIN_PHONE_NUMBER = process.env.ADMIN_PHONE_NUMBER;

function buildTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return null;
  }
  // Dynamic import to avoid crashing when Twilio env vars are not set
  return { accountSid: TWILIO_ACCOUNT_SID, authToken: TWILIO_AUTH_TOKEN };
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    logger.warn("Twilio credentials not configured — SMS not sent");
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: body,
    });

    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Twilio SMS failed");
      return false;
    }

    logger.info({ to }, "SMS sent successfully");
    return true;
  } catch (err) {
    logger.error({ err }, "Error sending SMS via Twilio");
    return false;
  }
}

export async function sendAdminNewBookingNotification(params: {
  bookingId: number;
  clientName: string;
  sessionType: string;
  preferredDate: string;
  adminDashboardUrl: string;
}): Promise<boolean> {
  if (!ADMIN_PHONE_NUMBER) {
    logger.warn("ADMIN_PHONE_NUMBER not set — admin SMS skipped");
    return false;
  }

  const message =
    `New photoshoot request from ${params.clientName}!\n` +
    `Session: ${params.sessionType}\n` +
    `Date: ${params.preferredDate}\n` +
    `Review & approve: ${params.adminDashboardUrl}/admin/bookings/${params.bookingId}`;

  return sendSms(ADMIN_PHONE_NUMBER, message);
}

export async function sendClientApprovalSms(params: {
  clientPhone: string;
  clientName: string;
  sessionType: string;
  preferredDate: string;
}): Promise<boolean> {
  const message =
    `Hi ${params.clientName}! Great news — your ${params.sessionType} session on ${params.preferredDate} has been approved by Captures By Capri. ` +
    `We'll be in touch with further details. Can't wait to work with you!`;

  return sendSms(params.clientPhone, message);
}

export async function sendClientDeclineSms(params: {
  clientPhone: string;
  clientName: string;
  sessionType: string;
  reason?: string | null;
}): Promise<boolean> {
  const reasonPart = params.reason ? ` Reason: ${params.reason}` : "";
  const message =
    `Hi ${params.clientName}, unfortunately your ${params.sessionType} session request with Captures By Capri could not be confirmed at this time.${reasonPart} ` +
    `Please feel free to reach out to book a different date!`;

  return sendSms(params.clientPhone, message);
}
