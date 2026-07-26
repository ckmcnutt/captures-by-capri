import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { customer } from "../db/schema";

export interface CustomerInput {
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string;
  preferred_contact_method: string;
}

/**
 * Find-or-create a customer by email, atomically.
 *
 * The Supabase edge function did a select followed by a conditional insert, which
 * races: two near-simultaneous bookings from the same address created duplicate
 * customers. The `customer_email_lower_uniq` index added in the baseline migration
 * makes this a single upsert instead.
 *
 * On a repeat booking the contact details are refreshed, since the newest booking
 * form is the better source of a phone number or contact preference.
 */
export async function findOrCreateByEmail(
  input: CustomerInput,
): Promise<number> {
  const email = input.email_address.trim().toLowerCase();

  // Raw SQL because the conflict target is an EXPRESSION index
  // (customer_email_lower_uniq on lower(email_address)), and drizzle's
  // onConflictDoUpdate({ target }) only accepts plain columns. Values are still
  // parameterised by the sql`` template.
  //
  // A plain unique index on email_address would let the query builder express
  // this, but it would also let mixed-case duplicates from the old Supabase data
  // coexist, which is exactly what this is meant to prevent.
  const result = await db.execute<{ id: number }>(sql`
    INSERT INTO ${customer}
      (first_name, last_name, email_address, phone_number, preferred_contact_method)
    VALUES (
      ${input.first_name},
      ${input.last_name},
      ${email},
      ${input.phone_number},
      ${input.preferred_contact_method}
    )
    ON CONFLICT (lower(email_address)) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone_number = EXCLUDED.phone_number,
      preferred_contact_method = EXCLUDED.preferred_contact_method
    RETURNING id
  `);

  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(`Failed to upsert customer for ${email}`);
  }
  return id;
}
