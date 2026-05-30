import { logger } from "./logger";

const CALCOM_BASE_URL = "https://api.cal.com/v2";
const CALCOM_API_VERSION = "2024-08-13";

function getApiKey(): string {
  const key = process.env.CALCOM_API_KEY;
  if (!key) throw new Error("CALCOM_API_KEY is not configured");
  return key;
}

async function calcomRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getApiKey();
  const res = await fetch(`${CALCOM_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": CALCOM_API_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as unknown;
  if (!res.ok) {
    logger.error({ status: res.status, path, body: json }, "Cal.com API error");
    throw new Error(`Cal.com API error: ${res.status}`);
  }
  return json;
}

export async function confirmCalBooking(bookingUid: string): Promise<void> {
  logger.info({ bookingUid }, "Confirming Cal.com booking");
  await calcomRequest("POST", `/bookings/${bookingUid}/confirm`);
  logger.info({ bookingUid }, "Cal.com booking confirmed");
}

export async function declineCalBooking(bookingUid: string, reason?: string): Promise<void> {
  logger.info({ bookingUid }, "Declining Cal.com booking");
  await calcomRequest("POST", `/bookings/${bookingUid}/decline`, reason ? { reason } : undefined);
  logger.info({ bookingUid }, "Cal.com booking declined");
}
