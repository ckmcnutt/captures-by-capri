import { env } from "../env";
import { logger } from "./logger";

/**
 * One entry per supported carrier: its SMS-to-email gateway domain, plus a
 * `pattern` matching that carrier's free-text name as reported by
 * AbstractAPI's phone lookup (used for client numbers, whose carrier isn't
 * known ahead of time — see lookupCarrier). `id`/`label` back the admin
 * settings page's carrier dropdown, where the photographer picks their own
 * carrier directly instead of paying for a lookup on every send.
 *
 * Order matters: MVNO sub-brands (Cricket, MetroPCS, Boost, etc.) must be
 * checked before the parent network they run on, since the lookup API
 * reports the sub-brand name but the parent's gateway won't accept the
 * sub-brand's numbers.
 */
export interface CarrierGateway {
  id: string;
  label: string;
  domain: string;
  pattern: RegExp;
}

export const CARRIER_GATEWAYS: CarrierGateway[] = [
  { id: "cricket", label: "Cricket Wireless", domain: "sms.cricketwireless.net", pattern: /cricket/i },
  { id: "metro", label: "Metro by T-Mobile", domain: "mymetropcs.com", pattern: /metro\s*pcs|metro by t-?mobile/i },
  { id: "boost", label: "Boost Mobile", domain: "sms.myboostmobile.com", pattern: /boost/i },
  { id: "virgin", label: "Virgin Mobile", domain: "vmobl.com", pattern: /virgin/i },
  { id: "google_fi", label: "Google Fi", domain: "msg.fi.google.com", pattern: /google fi/i },
  { id: "republic_wireless", label: "Republic Wireless", domain: "text.republicwireless.com", pattern: /republic wireless/i },
  { id: "us_cellular", label: "US Cellular", domain: "email.uscc.net", pattern: /us cellular|united states cellular/i },
  { id: "sprint", label: "Sprint", domain: "messaging.sprintpcs.com", pattern: /sprint/i },
  { id: "t_mobile", label: "T-Mobile", domain: "tmomail.net", pattern: /t-?mobile/i },
  { id: "att", label: "AT&T", domain: "txt.att.net", pattern: /at&t|^att\b|\batt\s*wireless/i },
  { id: "verizon", label: "Verizon", domain: "vtext.com", pattern: /verizon/i },
];

/** Maps a carrier name (as reported by the lookup API) to its SMS gateway domain, if known. */
export function gatewayDomainForCarrier(carrierName: string): string | null {
  const match = CARRIER_GATEWAYS.find(({ pattern }) => pattern.test(carrierName));
  return match?.domain ?? null;
}

/** Maps a carrier `id` (as stored in admin_settings / picked from the dropdown) to its gateway domain. */
export function gatewayDomainForCarrierId(carrierId: string): string | null {
  return CARRIER_GATEWAYS.find((c) => c.id === carrierId)?.domain ?? null;
}

export function isKnownCarrierId(carrierId: string): boolean {
  return CARRIER_GATEWAYS.some((c) => c.id === carrierId);
}

/** The list backing the admin settings page's carrier dropdown. */
export function listCarriers(): Array<{ id: string; label: string }> {
  return CARRIER_GATEWAYS.map(({ id, label }) => ({ id, label }));
}

/**
 * Looks up the carrier for a US phone number via AbstractAPI's phone
 * validation endpoint (free tier: ~250 requests/month at time of writing).
 * Carrier can't be inferred from the number's area code/prefix alone since
 * numbers get ported between carriers, so this makes a real lookup rather
 * than guessing from a static table.
 *
 * Used for client numbers only — the admin's own carrier is configured
 * directly on the admin settings page (see gatewayDomainForCarrierId) and
 * never needs this lookup.
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
