// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { CalEventMessage } from "./lib/models/Cal.ts";
import { APIError } from "./lib/models/APIError.ts";
import { jsonError } from "./lib/utils.ts";
import { headers } from "./lib/config.ts";
import { processWebhookEvent } from "./lib/WebhookProcessor.ts";
import { Database } from "./lib/database.types.ts";

// Deno.serve(async (req) => {

// })

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  // fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
  fetch: withSupabase<Database>({}, async (req, ctx) => {
    // Called by another service with a secret key
    // ctx.supabaseAdmin bypasses RLS — use for privileged operations
    /*
    if (ctx.authMode === "secret") {
      const { user_id } = await req.json();
      const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

      return Response.json({
        email: data?.user?.email,
      });
    }
    */

    // const { name } = await req.json();

    // return Response.json({
    //   message: `Hello ${name}!`,
    // });

    if (req.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    let _msg: CalEventMessage;
    try {
      _msg = (await req.json()) as CalEventMessage;
      console.log(_msg);
    } catch {
      return jsonError("Invalid JSON body");
    }

    try {
      await processWebhookEvent(_msg, ctx);
    } catch (error) {
      if (error instanceof APIError && error.message) {
        return jsonError(error.message, error.status);
      } else {
        return jsonError(error as string, 500);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers
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
