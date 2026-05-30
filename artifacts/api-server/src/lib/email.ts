import { logger } from "./logger";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Captures By Capri <bookings@capturesbycapri.com>";

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ to, subject }, "RESEND_API_KEY not configured — email not sent");
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent via Resend");
}
