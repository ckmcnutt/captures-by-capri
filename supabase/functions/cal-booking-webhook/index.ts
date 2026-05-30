import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { APIError } from "./lib/models/api-error.ts";
import { jsonError, headers } from "./lib/utils.ts";
import { processWebhookEvent } from "./lib/webhook-event-processor.ts";
import { Database } from "./lib/database.types.ts";
import { CalEventMessage } from "./lib/models/cal.ts";

export default {
  fetch: withSupabase<Database>({ auth: ["none"] }, async (req, ctx) => {

    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    let _msg: CalEventMessage;
    try {
      _msg = (await req.json()) as CalEventMessage;
      console.debug(_msg);
    } catch {
      return jsonError("Invalid JSON body");
    }

    try {
      await processWebhookEvent(_msg, ctx);
    } catch (error) {
      if (error instanceof APIError && error.message) {
        console.error(error);
        return jsonError(error.message, error.status);
      } else {
        console.error(error);
        return jsonError(error as string, 500);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cal-booking-webhook' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
