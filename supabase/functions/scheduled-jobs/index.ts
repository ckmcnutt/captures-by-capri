import "@supabase/functions-js/edge-runtime.d.ts";
import { runScheduledJobs } from "./lib/bundle.ts";

export default {
  fetch: async (_req: Request): Promise<Response> => {
    try {
      const result = await runScheduledJobs();
      console.info("Scheduled jobs complete", result);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Scheduled jobs failed", err);
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
