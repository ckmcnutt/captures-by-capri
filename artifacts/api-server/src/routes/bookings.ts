import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, bookingsTable } from "@workspace/db";
import {
  CreateBookingBody,
  GetBookingParams,
  ListBookingsQueryParams,
  ApproveBookingParams,
  DeclineBookingParams,
  DeclineBookingBody,
} from "@workspace/api-zod";
import {
  sendAdminNewBookingNotification,
  sendClientApprovalSms,
  sendClientDeclineSms,
} from "../lib/sms";

const router: IRouter = Router();

router.get("/bookings", async (req, res): Promise<void> => {
  const parsed = ListBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let bookings;
  if (parsed.data.status) {
    bookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.status, parsed.data.status))
      .orderBy(desc(bookingsTable.createdAt));
  } else {
    bookings = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt));
  }

  res.json(bookings);
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [booking] = await db
    .insert(bookingsTable)
    .values({ ...parsed.data, status: "pending" })
    .returning();

  // Send SMS notification to admin
  const host =
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : (req.headers.origin as string) ?? "https://capturesbycapri.com";

  const adminNotified = await sendAdminNewBookingNotification({
    bookingId: booking.id,
    clientName: booking.clientName,
    sessionType: booking.sessionType,
    preferredDate: booking.preferredDate,
    adminDashboardUrl: host,
  });

  if (adminNotified) {
    await db
      .update(bookingsTable)
      .set({ adminNotified: true })
      .where(eq(bookingsTable.id, booking.id));
    booking.adminNotified = true;
  }

  res.status(201).json(booking);
});

router.get("/bookings/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      approved: sql<number>`count(*) filter (where status = 'approved')::int`,
      declined: sql<number>`count(*) filter (where status = 'declined')::int`,
      thisMonth: sql<number>`count(*) filter (where created_at >= ${startOfMonth.toISOString()})::int`,
    })
    .from(bookingsTable);

  res.json(stats);
});

router.get("/bookings/recent", async (_req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(10);

  res.json(bookings);
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const params = GetBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id));

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(booking);
});

router.patch("/bookings/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const smsSent = await sendClientApprovalSms({
    clientPhone: existing.clientPhone,
    clientName: existing.clientName,
    sessionType: existing.sessionType,
    preferredDate: existing.preferredDate,
  });

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "approved", smsSent })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  res.json(updated);
});

router.patch("/bookings/:id/decline", async (req, res): Promise<void> => {
  const params = DeclineBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = DeclineBookingBody.safeParse(req.body);
  const declineReason = body.success ? (body.data.reason ?? null) : null;

  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const smsSent = await sendClientDeclineSms({
    clientPhone: existing.clientPhone,
    clientName: existing.clientName,
    sessionType: existing.sessionType,
    reason: declineReason,
  });

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "declined", declineReason, smsSent })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  res.json(updated);
});

router.post("/bookings/webhook/calcom", async (req, res): Promise<void> => {
  const { triggerEvent, payload } = req.body;

  req.log.info({ triggerEvent }, "Cal.com webhook received");

  if (triggerEvent === "BOOKING_CREATED" && payload) {
    const attendee = payload.attendees?.[0];
    if (attendee) {
      const [booking] = await db
        .insert(bookingsTable)
        .values({
          clientName: attendee.name ?? "Unknown",
          clientEmail: attendee.email ?? "",
          clientPhone: payload.responses?.phone?.value ?? "",
          sessionType: payload.title ?? "Photoshoot",
          preferredDate: payload.startTime
            ? new Date(payload.startTime).toLocaleDateString()
            : "TBD",
          calBookingId: payload.uid,
          status: "pending",
        })
        .onConflictDoNothing()
        .returning();

      if (booking) {
        const host =
          process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : "https://capturesbycapri.com";

        await sendAdminNewBookingNotification({
          bookingId: booking.id,
          clientName: booking.clientName,
          sessionType: booking.sessionType,
          preferredDate: booking.preferredDate,
          adminDashboardUrl: host,
        });

        await db
          .update(bookingsTable)
          .set({ adminNotified: true })
          .where(eq(bookingsTable.id, booking.id));
      }
    }
  }

  res.json({ received: true });
});

export default router;
