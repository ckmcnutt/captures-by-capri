import { normString } from "./utils.ts";
import { APIError } from "./models/api-error.ts";
import { WebhookEvent } from "./models/webhook-event.ts";
import { SupabaseContext } from "@supabase/server";
import { Database } from "./database.types.ts";
import { processBookingRequested } from "./events/booking-requested.ts";
import { processBookingCanceled } from "./events/booking-cancelled.ts";
import { processBookingCreated } from "./events/booking-created.ts";
import { processBookingRejected } from "./events/booking-rejected.ts";
import { processBookingRescheduled } from "./events/booking-rescheduled.ts";
import { CalEventMessage } from "./models/cal.ts";

export async function processWebhookEvent(
  msg: CalEventMessage,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  const triggerEvent = normString(msg.triggerEvent) ?? "";

  const payload = msg.payload;
  if (!payload) throw new APIError("Missing payload", 400);

  const bookingId = payload.bookingId;
  if (!bookingId) throw new APIError("Missing payload.bookingId", 400);

  console.log(
    `Processing webhook event ${triggerEvent} for appointment ${bookingId}...`,
  );
  switch (triggerEvent as WebhookEvent) {
    case WebhookEvent.BOOKING_CANCELED:
      await processBookingCanceled(payload, bookingId, ctx);
      break;
    case WebhookEvent.BOOKING_REJECTED:
      await processBookingRejected(payload, bookingId, ctx);
      break;
    case WebhookEvent.BOOKING_CREATED:
      await processBookingCreated(payload, bookingId, ctx);
      break;
    case WebhookEvent.BOOKING_REQUESTED:
      await processBookingRequested(payload, bookingId, ctx);
      break;
    case WebhookEvent.BOOKING_RESCHEDULED:
      await processBookingRescheduled(payload, bookingId);
      break;
    default:
      throw new APIError("Invalid triggerEvent", 400);
  }
  console.log(
    `Webhook event ${triggerEvent} for appointment ${bookingId} processed successfully!`,
  );
}
