import { logger } from "./logger";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export async function sendSms(to: string, body: string): Promise<void> {
  if (!accountSid || !authToken || !fromNumber) {
    logger.warn("Twilio credentials not configured — SMS not sent");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams({
    From: fromNumber,
    To: to,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text, to }, "Twilio SMS failed");
    throw new Error(`Twilio SMS failed: ${res.status}`);
  }

  logger.info({ to }, "SMS sent via Twilio");
}
