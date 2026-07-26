import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { appointment, type AppointmentInsert } from "../db/schema";

/**
 * The column set the admin dashboard consumes. Previously copy-pasted in three
 * places (twice in routes/admin/appointments.ts, a variant in actions.ts).
 */
const DETAIL_COLUMNS = {
  id: true,
  start_time: true,
  end_time: true,
  aesthetic: true,
  customer_notes: true,
  internal_notes: true,
  cal_booking_uid: true,
  stripe_deposit_invoice_id: true,
  stripe_deposit_url: true,
  stripe_final_invoice_id: true,
  stripe_final_url: true,
  final_invoice_amount: true,
  photo_delivery_url: true,
  created_at: true,
} as const;

/**
 * Relation keys match the old PostgREST embed aliases exactly, so the JSON shape
 * the dashboard receives is unchanged.
 */
const DETAIL_WITH = {
  customer: {
    columns: {
      id: true,
      first_name: true,
      last_name: true,
      email_address: true,
      phone_number: true,
      preferred_contact_method: true,
    },
  },
  category: {
    columns: { id: true, category_name: true, category_desc: true },
  },
  appointment_status: {
    columns: { id: true, status_name: true, status_desc: true },
  },
} as const;

export type AppointmentDetail = Awaited<ReturnType<typeof getAppointment>>;

/**
 * List appointments, optionally filtered to a set of status names.
 *
 * Behaviour note: the Supabase version skipped the filter entirely when none of
 * the supplied status names existed, so a typo returned EVERY appointment — a
 * filter that failed open. This fails closed instead: unknown names match nothing.
 */
export async function listAppointments(statusIds: number[] | null) {
  return db.query.appointment.findMany({
    columns: DETAIL_COLUMNS,
    with: DETAIL_WITH,
    where: statusIds ? inArray(appointment.status_id, statusIds) : undefined,
    orderBy: [desc(appointment.start_time)],
  });
}

/**
 * Fetch one appointment, or undefined if it doesn't exist.
 *
 * This fixes a real bug: PostgREST's `.single()` raised an error on zero rows, so
 * the old handler returned 500 and its `if (!data) -> 404` branch was
 * unreachable. `findFirst` returns undefined, so the 404 now works.
 */
export async function getAppointment(id: number) {
  return db.query.appointment.findFirst({
    columns: DETAIL_COLUMNS,
    with: DETAIL_WITH,
    where: eq(appointment.id, id),
  });
}

export async function updateAppointment(
  id: number,
  values: Partial<AppointmentInsert>,
): Promise<void> {
  await db.update(appointment).set(values).where(eq(appointment.id, id));
}

export async function setStatus(id: number, statusId: number): Promise<void> {
  await db
    .update(appointment)
    .set({ status_id: statusId })
    .where(eq(appointment.id, id));
}

/**
 * Update status and internal notes for every appointment with this Cal.com uid.
 *
 * cal_booking_uid is not unique in the schema, so this can legitimately touch
 * more than one row. Returns the count so callers can log an anomaly.
 */
export async function updateStatusByCalUid(
  calBookingUid: string,
  statusId: number,
  internalNotes: string,
): Promise<number> {
  const rows = await db
    .update(appointment)
    .set({ status_id: statusId, internal_notes: internalNotes })
    .where(eq(appointment.cal_booking_uid, calBookingUid))
    .returning({ id: appointment.id });
  return rows.length;
}

/**
 * Resolve a Stripe payment-link id to the appointment and which invoice it is.
 *
 * The Supabase version interpolated the id directly into PostgREST's filter
 * grammar (`.or("a.eq.<id>,b.eq.<id>")`); this is parameterised.
 */
export async function findByPaymentLinkId(
  paymentLinkId: string,
): Promise<{ appointmentId: number; invoiceType: "deposit" | "final" } | null> {
  const [row] = await db
    .select({
      id: appointment.id,
      stripe_deposit_invoice_id: appointment.stripe_deposit_invoice_id,
      stripe_final_invoice_id: appointment.stripe_final_invoice_id,
    })
    .from(appointment)
    .where(
      or(
        eq(appointment.stripe_deposit_invoice_id, paymentLinkId),
        eq(appointment.stripe_final_invoice_id, paymentLinkId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    appointmentId: row.id,
    invoiceType:
      row.stripe_deposit_invoice_id === paymentLinkId ? "deposit" : "final",
  };
}

export async function getCalBookingUid(id: number): Promise<string | null> {
  const [row] = await db
    .select({ cal_booking_uid: appointment.cal_booking_uid })
    .from(appointment)
    .where(eq(appointment.id, id))
    .limit(1);
  return row?.cal_booking_uid ?? null;
}

/**
 * Insert an appointment, optionally with an explicit id.
 *
 * The Cal.com webhook passes the Cal bookingId as the primary key, which means
 * the id sequence is never advanced for those rows. Left alone, `max(id)`
 * eventually outruns the sequence and the next sequence-driven insert collides.
 * So the sequence is fast-forwarded in the same transaction whenever an explicit
 * id is supplied. `GREATEST(last_value, max(id))` never moves it backwards, so
 * this is safe to run unconditionally.
 */
export async function insertAppointment(
  values: AppointmentInsert,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(appointment)
      .values(values)
      .returning({ id: appointment.id });

    if (values.id !== undefined) {
      await tx.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('appointment', 'id'),
          GREATEST(
            (SELECT last_value FROM appointment_id_seq),
            (SELECT COALESCE(MAX(id), 1) FROM appointment)
          )
        )
      `);
    }

    return row.id;
  });
}

/** Shape used by the scheduled jobs — narrower than the dashboard detail view. */
const JOB_COLUMNS = {
  id: true,
  start_time: true,
  end_time: true,
  cal_booking_uid: true,
  final_invoice_amount: true,
  stripe_final_invoice_id: true,
} as const;

const JOB_WITH = {
  customer: {
    columns: {
      first_name: true,
      phone_number: true,
      email_address: true,
      preferred_contact_method: true,
    },
  },
} as const;

export type JobAppointment = Awaited<
  ReturnType<typeof listByStatusForJobs>
>[number];

export async function listByStatusForJobs(statusId: number) {
  return db.query.appointment.findMany({
    columns: JOB_COLUMNS,
    with: JOB_WITH,
    where: eq(appointment.status_id, statusId),
    orderBy: [appointment.start_time],
  });
}
