import cron, { type ScheduledTask } from "node-cron";
import { env } from "../env";
import { logger } from "../lib/logger";
import { runScheduledJobs } from "./scheduled-jobs";

/**
 * In-process cron for the time-based appointment workflow, replacing the Supabase
 * `scheduled-jobs` edge function.
 *
 * CRON_SCHEDULE MUST FIRE AT MOST ONCE PER DAY.
 *
 * The reminder windows in scheduled-jobs.ts (`d <= 3 && d > 2`, `d <= 2 && d > 1`,
 * `d <= 1 && d > 0`) are each a full 24-hour band, and nothing in the schema
 * records that a reminder was already sent. An hourly schedule would therefore
 * send every reminder up to 24 times — real Twilio spend and real annoyance for
 * clients. Getting finer resolution requires a schema change (a
 * last_reminder_sent_at column), not a config change.
 */
let task: ScheduledTask | null = null;
let running = false;

export function startScheduler(): void {
  if (task) {
    logger.warn("Scheduler already started");
    return;
  }

  if (!cron.validate(env.CRON_SCHEDULE)) {
    throw new Error(`Invalid CRON_SCHEDULE: "${env.CRON_SCHEDULE}"`);
  }

  task = cron.schedule(
    env.CRON_SCHEDULE,
    async () => {
      // A run that outlives its interval must not overlap itself: the jobs are
      // not idempotent, so a second concurrent pass would double-send.
      if (running) {
        logger.warn("Scheduled jobs still running from a previous tick — skipping");
        return;
      }
      running = true;
      const startedAt = Date.now();
      try {
        const result = await runScheduledJobs(logger);
        logger.info(
          { ...result, durationMs: Date.now() - startedAt },
          "Scheduled jobs complete",
        );
      } catch (err) {
        logger.error({ err }, "Scheduled jobs failed");
      } finally {
        running = false;
      }
    },
    { timezone: env.CRON_TIMEZONE },
  );

  logger.info(
    { schedule: env.CRON_SCHEDULE, timezone: env.CRON_TIMEZONE },
    "Scheduler started",
  );
}

export async function stopScheduler(): Promise<void> {
  if (!task) return;
  await task.stop();
  task = null;
  logger.info("Scheduler stopped");
}
