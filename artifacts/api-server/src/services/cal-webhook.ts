import type { Logger } from "pino";
import {
  insertAppointment,
  updateStatusByCalUid,
} from "../repositories/appointments";
import { listCategories, matchCategory } from "../repositories/categories";
import { findOrCreateByEmail } from "../repositories/customers";
import { STATUS, getStatusId } from "../repositories/status";
import { notifyAdminOfBookingRequest } from "./notifications";

/**
 * Cal.com booking webhook, ported from the Supabase edge function
 * `cal-booking-webhook` (supabase/functions/cal-booking-webhook/lib/bundle.ts,
 * which was the deployed code — the sibling lib/events/ and lib/services/ tree
 * was divergent dead code importing files that did not exist in the repo).
 *
 * Behaviour deliberately preserved:
 *   - the name normalisation, which accepts a plain "First Last" string or an
 *     object with either snake_case or camelCase keys
 *   - Cal.com's bookingId used as the appointment primary key
 *   - BOOKING_CREATED and BOOKING_RESCHEDULED as no-ops
 *   - the quirky category fuzzy match (see repositories/categories.ts)
 *
 * Behaviour deliberately changed:
 *   - statuses resolved by name instead of the hardcoded ids 2 and 12
 *   - customer lookup is an atomic upsert rather than a racy select-then-insert
 */

export const WEBHOOK_EVENTS = {
  BOOKING_CANCELED: "BOOKING_CANCELED",
  BOOKING_REJECTED: "BOOKING_REJECTED",
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_REQUESTED: "BOOKING_REQUESTED",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
} as const;

export interface CalPayload {
  bookingId?: number;
  uid?: string;
  startTime?: string;
  endTime?: string;
  responses?: Record<string, { value?: unknown } | undefined>;
  cancellationReason?: string;
  rejectionReason?: string;
}

export interface CalEventMessage {
  triggerEvent?: string;
  createdAt?: string;
  payload?: CalPayload;
}

/** Error carrying an HTTP status, so the route can map it to a response. */
export class WebhookError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "WebhookError";
    this.status = status;
  }
}

function normString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Cal.com sends the name either as "First Last" or as an object with
 * {first_name,last_name} or {firstName,lastName}. Preserved verbatim from the
 * edge function; this is the fiddly part and it was correct.
 */
function parseName(raw: unknown): { first_name: string; last_name: string } {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      first_name: normString(obj.first_name ?? obj.firstName) ?? "",
      last_name: normString(obj.last_name ?? obj.lastName) ?? "",
    };
  }
  if (typeof raw === "string") {
    const parts = raw.trim().split(/\s+/);
    return {
      first_name: parts[0] ?? "",
      last_name: parts.slice(1).join(" "),
    };
  }
  return { first_name: "", last_name: "" };
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new WebhookError(`Invalid ${field}: ${value}`, 400);
  }
  return date;
}

export async function processCalWebhook(
  msg: CalEventMessage,
  log: Logger,
): Promise<void> {
  const trigger = normString(msg.triggerEvent) ?? "";
  const payload = msg.payload;
  if (!payload) throw new WebhookError("Missing payload", 400);

  const uid = normString(payload.uid);

  switch (trigger) {
    case WEBHOOK_EVENTS.BOOKING_CANCELED: {
      if (!uid) throw new WebhookError("Missing uid", 400);
      const statusId = await getStatusId(STATUS.canceled);
      const notes = `CANCELED: ${payload.cancellationReason ?? ""}`;
      const affected = await updateStatusByCalUid(uid, statusId, notes);
      logCalUidUpdate(log, trigger, uid, affected);
      return;
    }

    case WEBHOOK_EVENTS.BOOKING_REJECTED: {
      if (!uid) throw new WebhookError("Missing uid", 400);
      const statusId = await getStatusId(STATUS.rejected);
      const notes = `REJECTED: ${payload.rejectionReason ?? ""}`;
      const affected = await updateStatusByCalUid(uid, statusId, notes);
      logCalUidUpdate(log, trigger, uid, affected);
      return;
    }

    case WEBHOOK_EVENTS.BOOKING_REQUESTED:
      await handleBookingRequested(payload, uid, log);
      return;

    case WEBHOOK_EVENTS.BOOKING_CREATED:
    case WEBHOOK_EVENTS.BOOKING_RESCHEDULED:
      // No-ops, as in the original. Returning ok stops Cal.com from retrying.
      log.debug({ trigger, uid }, "Cal webhook event ignored");
      return;

    default:
      log.warn({ trigger }, "Unrecognised Cal webhook trigger — ignoring");
      return;
  }
}

function logCalUidUpdate(
  log: Logger,
  trigger: string,
  uid: string,
  affected: number,
): void {
  if (affected === 0) {
    log.warn({ trigger, uid }, "Cal webhook matched no appointment");
  } else if (affected > 1) {
    // cal_booking_uid has no unique constraint, so this is possible.
    log.warn(
      { trigger, uid, affected },
      "Cal webhook updated multiple appointments for one uid",
    );
  } else {
    log.info({ trigger, uid }, "Appointment status updated from Cal webhook");
  }
}

async function handleBookingRequested(
  payload: CalPayload,
  uid: string | null,
  log: Logger,
): Promise<void> {
  const responses = payload.responses;
  if (!responses) throw new WebhookError("No responses", 400);

  const missing: string[] = [];
  const required = (key: string): string => {
    const value = normString(responses[key]?.value);
    if (!value) missing.push(key);
    return value ?? "";
  };

  const { first_name, last_name } = parseName(responses.name?.value);
  if (!first_name) missing.push("firstName");

  const email_address = required("email");
  const aesthetic = required("aesthetic");
  const session_type = required("session_type");

  const phone_number =
    normString(responses.attendeePhoneNumber?.value) ??
    normString(responses.phone?.value) ??
    "";
  const preferred_contact_method =
    normString(responses.contact_method?.value) ?? "email";
  const customer_notes = normString(responses.notes?.value);

  if (!payload.startTime) missing.push("startTime");
  if (!payload.endTime) missing.push("endTime");

  if (missing.length > 0) {
    throw new WebhookError(`Missing: ${missing.join(",")}`, 400);
  }

  const start_time = parseDate(payload.startTime as string, "startTime");
  const end_time = parseDate(payload.endTime as string, "endTime");

  const customer_id = await findOrCreateByEmail({
    first_name,
    last_name,
    email_address,
    phone_number,
    preferred_contact_method,
  });

  const categories = await listCategories();
  let category = matchCategory(categories, session_type);

  if (!category) {
    // The Supabase version passed category_id: undefined here and relied on the
    // column's DB default. Rejecting the request instead would lose a real
    // booking outright, which is worse than an imprecise category the admin can
    // correct in the dashboard — so fall back to the first category and log
    // loudly enough that it gets noticed.
    if (categories.length === 0) {
      throw new WebhookError("No categories are configured", 500);
    }
    category = categories[0];
    log.error(
      {
        session_type,
        fallback: category.category_name,
        available: categories.map((c) => c.category_name),
      },
      "No category matched the Cal session_type — falling back to the first category",
    );
  }

  const status_id = await getStatusId(STATUS.requested);

  const appointmentId = await insertAppointment({
    // Cal.com's bookingId becomes the primary key when present. insertAppointment
    // fast-forwards the id sequence to compensate.
    ...(payload.bookingId ? { id: payload.bookingId } : {}),
    start_time,
    end_time,
    category_id: category.id,
    aesthetic,
    customer_notes,
    customer_id,
    status_id,
    cal_booking_uid: uid,
  });

  log.info(
    { appointmentId, customer_id, category: category.category_name },
    "Appointment created from Cal booking request",
  );

  await notifyAdminOfBookingRequest(
    first_name,
    last_name,
    session_type,
    start_time,
  );
}
