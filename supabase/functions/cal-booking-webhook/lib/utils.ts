export const headers = { "Content-Type": "application/json" };

export function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers,
  });
}

export function normString(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

export function getResponseValue(
  obj: Record<string, { value?: unknown }> | undefined,
  key: string,
): string | null {
  const v = obj?.[key]?.value;
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}
