/**
 * Normalizes a phone number to its bare 10 digits, dropping a leading US
 * country code if present. Used both as the carrier-lookup query and as the
 * local part of a carrier SMS gateway address (e.g. "5555550100@vtext.com").
 *
 * Returns null for anything that isn't a plain US number (already-malformed
 * data, international numbers) — callers should treat that as "can't
 * gateway this number" rather than throw, since phone_number is unvalidated
 * free text sourced from Cal.com.
 */
export function normalizeUsPhoneDigits(phoneNumber: string): string | null {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
}
