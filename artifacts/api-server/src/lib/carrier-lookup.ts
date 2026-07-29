import { env } from "../env";
import { logger } from "./logger";

/**
 * Carrier name substrings -> that carrier's SMS-to-email gateway domain.
 * Order matters: MVNO sub-brands (Cricket, MetroPCS, Boost, etc.) must be
 * checked before the parent network they run on, since the lookup API
 * reports the sub-brand name but the parent's gateway won't accept the
 * sub-brand's numbers.
 */
const CARRIER_GATEWAYS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /cricket/i, domain: "sms.cricketwireless.net" },
  { pattern: /metro\s*pcs|metro by t-?mobile/i, domain: "mymetropcs.com" },
  { pattern: /boost/i, domain: "sms.myboostmobile.com" },
  { pattern: /virgin/i, domain: "vmobl.com" },
  { pattern: /google fi/i, domain: "msg.fi.google.com" },
  { pattern: /republic wireless/i, domain: "text.republicwireless.com" },
  { pattern: /us cellular|united states cellular/i, domain: "email.uscc.net" },
  { pattern: /sprint/i, domain: "messaging.sprintpcs.com" },
  { pattern: /t-?mobile/i, domain: "tmomail.net" },
  { pattern: /at&t|^att\b|\batt\s*wireless/i, domain: "txt.att.net" },
  { pattern: /verizon/i, domain: "vtext.com" },
];

/** Maps a carrier name (as reported by the lookup API) to its SMS gateway domain, if known. */
export function gatewayDomainForCarrier(carrierName: string): string | null {
  const match = CARRIER_GATEWAYS.find(({ pattern }) => pattern.test(carrierName));
  return match?.domain ?? null;
}

/**
 * Looks up the carrier for a US phone number via AbstractAPI's phone
 * validation endpoint (free tier: ~250 requests/month at time of writing).
 * Carrier can't be inferred from the number's area code/prefix alone since
 * numbers get ported between carriers, so this makes a real lookup rather
 * than guessing from a static table.
 *
 * Returns null (never throws) whenever the carrier can't be determined, so
 * callers can fall back to a warn-and-skip like the other notification
 * transports.
 */
export async function lookupCarrier(e164Phone: string): Promise<string | null> {
  if (!env.ABSTRACT_API_KEY) {
    logger.warn("ABSTRACT_API_KEY not configured — carrier lookup skipped");
    return null;
  }

  const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${env.ABSTRACT_API_KEY}&phone=${encodeURIComponent(e164Phone)}`;

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(url);
  } catch (err) {
    logger.warn({ err }, "Carrier lookup request failed");
    return null;
  }

  if (!res.ok) {
    logger.warn({ status: res.status }, "Carrier lookup API returned an error");
    return null;
  }

  const data = (await res.json()) as { valid?: boolean; carrier?: string | null };
  if (!data.valid || !data.carrier) {
    logger.warn({ phone: e164Phone }, "Carrier lookup returned no usable carrier");
    return null;
  }

  return data.carrier;
}
