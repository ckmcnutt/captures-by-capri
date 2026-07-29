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

const MS_PER_MINUTE = 1000 * 60;

/**
 * Which configured final-invoice price tier an appointment falls into.
 *
 * Bookings aren't a strict 30/60min enum (Cal.com allows arbitrary times), so
 * this buckets on the midpoint between the two: 45 minutes or less counts as
 * the 30min tier, anything longer counts as the 1hr tier.
 */
export function durationTier(start: Date, end: Date): "final_30" | "final_60" {
  const minutes = (end.getTime() - start.getTime()) / MS_PER_MINUTE;
  return minutes <= 45 ? "final_30" : "final_60";
}
