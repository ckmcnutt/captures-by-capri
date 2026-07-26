/**
 * Fetch wrapper for authenticated admin API calls.
 *
 * Auth is a signed httpOnly session cookie set by POST /api/admin/login, so there
 * is no token for the client to hold or attach — `credentials: "include"` is the
 * whole mechanism. This replaces reading a Supabase session and setting an
 * Authorization: Bearer header.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  // Only declare JSON when there is actually a body to describe.
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers, credentials: "include" });
}
