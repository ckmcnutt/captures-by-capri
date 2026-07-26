const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Fractional days from now until `target`. Negative once the target has passed.
 *
 * The scheduled jobs bucket appointments with expressions like `d <= 3 && d > 2`,
 * so each band is a full 24 hours wide. That is why the cron schedule must fire at
 * most once a day — see services/scheduler.ts.
 */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return (target.getTime() - now.getTime()) / MS_PER_DAY;
}
