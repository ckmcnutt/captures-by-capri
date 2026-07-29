import { relations } from "drizzle-orm";
import {
  appointment,
  appointment_status,
  category,
  customer,
} from "./schema";

/**
 * Relation keys are named `customer`, `category` and `appointment_status`
 * deliberately: those are the exact aliases Supabase's PostgREST embeds produced
 * (`customer:customer_id ( ... )`). Keeping them identical means
 * `db.query.appointment.findMany({ with: { ... } })` yields the same nested JSON
 * the admin dashboard already expects.
 */

export const appointmentRelations = relations(appointment, ({ one, many }) => ({
  customer: one(customer, {
    fields: [appointment.customer_id],
    references: [customer.id],
  }),
  category: one(category, {
    fields: [appointment.category_id],
    references: [category.id],
  }),
  appointment_status: one(appointment_status, {
    fields: [appointment.status_id],
    references: [appointment_status.id],
  }),
}));

export const customerRelations = relations(customer, ({ many }) => ({
  appointments: many(appointment),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  appointments: many(appointment),
}));

export const appointmentStatusRelations = relations(
  appointment_status,
  ({ many }) => ({
    appointments: many(appointment),
  }),
);
