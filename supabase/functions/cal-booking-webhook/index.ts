import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { APIError, jsonError, headers, processWebhookEvent, CalEventMessage } from "./lib/bundle.ts";
import { Database } from "./lib/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: ["none"] }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);
    let msg: CalEventMessage;
    try { msg = (await req.json()) as CalEventMessage; } catch { return jsonError("Invalid JSON body"); }
    try {
      await processWebhookEvent(msg, ctx);
    } catch (error) {
      console.error(error);
      if (error instanceof APIError) return jsonError(error.message, error.status);
      return jsonError(String(error), 500);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }),
};
