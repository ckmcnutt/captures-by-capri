import { CalEventMessage, CalPayload } from "./models/Cal.ts";
import { getResponseValue, normString } from "./utils.ts";
import { APIError } from "./models/APIError.ts";
import { WebhookEvent } from "./models/WebhookEvent.ts";
import { SupabaseContext } from "@supabase/server";
import { Customer, Database } from "./database.types.ts";
import { CustomerService } from "./services/CustomerService.ts";
import { AppointmentService } from "./services/AppointmentService.ts";
import { CategoryService } from "./services/CategoryService.ts";

export async function processWebhookEvent(
  msg: CalEventMessage,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  const triggerEvent = normString(msg.triggerEvent) ?? "";

  const payload = msg.payload;
  if (!payload) throw new APIError("Missing payload.msg", 400);

  const bookingId = payload.bookingId;
  if (!bookingId) throw new APIError("Missing payload.bookingId", 400);

  switch (triggerEvent as WebhookEvent) {
    case WebhookEvent.BOOKING_CANCELED:
      await processBookingCanceled(payload, bookingId);
      break;
    case WebhookEvent.BOOKING_REJECTED:
      await processBookingRejected(payload, bookingId);
      break;
    case WebhookEvent.BOOKING_CREATED:
      await processBookingCreated(payload, bookingId, ctx);
      break;
    case WebhookEvent.BOOKING_REQUESTED:
      await processBookingRequested(payload, bookingId);
      break;
    case WebhookEvent.BOOKING_RESCHEDULED:
      await processBookingRescheduled(payload, bookingId);
      break;
    default:
      throw new APIError("Invalid triggerEvent", 400);
  }
}

async function processBookingCanceled(
  payload: CalPayload,
  bookingId: number,
): Promise<void> {
}

async function processBookingRequested(
  payload: CalPayload,
  bookingId: number,
): Promise<void> {
}

async function processBookingCreated(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  const responses = payload.responses;
  if (!responses) throw new APIError("No responses in payload", 404);

  const missing: string[] = [];
  if (!responses.first_name) missing.push("first_name");
  if (!responses.last_name) missing.push("last_name");
  if (!responses.email) missing.push("email");
  if (!responses.attendeePhoneNumber) missing.push("attendeePhoneNumber");
  if (!responses.choice) missing.push("choice");
  if (!responses.aesthetic) missing.push("aesthetic");
  if (!responses.session_type) missing.push("session_type");
  if (!responses.notes) missing.push("notes");
  if (missing.length) {
    throw new APIError(
      `Missing required fields derived from Cal payload: ${missing.join(", ")}`,
      400,
    );
  }

  const customerService = new CustomerService(ctx);
  const customer = await customerService.getCustomerByName(
    responses.first_name.value as string,
    responses.last_name.value as string,
  );
  let customerId = customer ? customer.id : null;

  if (!customerId) {
    customerId = await customerService.insertCustomer({
      first_name: responses.first_name.value as string,
      last_name: responses.last_name.value as string,
      email_address: responses.email.value as string,
      phone_number: responses.attendeePhoneNumber.value as string,
      preferred_contact_method: responses.choice.value as string,
    });
  }

  const categoryService = new CategoryService(ctx);
  const category = await categoryService.getCategory(
    responses.session_type.value as string,
  );

  const apptService = new AppointmentService(ctx);
  await apptService.insertAppointment({
    id: bookingId,
    start_time: responses.startTime.value as string,
    end_time: responses.endTime.value as string,
    category_id: category?.id as number ?? 6,
    aesthetic: responses.aesthetic.value as string,
    additional_notes: responses.notes.value as string
  });
}

async function processBookingRejected(
  payload: CalPayload,
  bookingId: number,
): Promise<void> {
}
async function processBookingRescheduled(
  payload: CalPayload,
  bookingId: number,
): Promise<void> {
}
