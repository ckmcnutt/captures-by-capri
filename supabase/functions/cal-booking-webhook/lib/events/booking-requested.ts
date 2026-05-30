import { SupabaseContext } from "@supabase/server";
import { Database } from "../database.types.ts";
import { APIError } from "../models/api-error.ts";
import { AppointmentService } from "../services/AppointmentService.ts";
import { CategoryService } from "../services/CategoryService.ts";
import { CustomerService } from "../services/CustomerService.ts";
import { CalPayload } from "../models/Cal.ts";

export async function processBookingRequested(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  console.debug("Validating and normalizing payload form reponses...");
  const {
    first_name,
    last_name,
    email_address,
    phone_number,
    preferred_contact_method,
    start_time,
    end_time,
    aesthetic,
    session_type,
    customer_notes,
  } = normalizePayloadResponses(payload);
  console.debug("Payload form responses validated successfully!");

  console.debug(
    `Checking if customer ${email_address} already exists...`,
  );
  const customerService = new CustomerService(ctx);
  const customer = await customerService.getCustomerByEmail(email_address);
  console.debug(
    `Customer ${email_address} ${
      customer ? "already exists" : "does not exist"
    }`,
  );

  let customer_id = customer ? customer.id : null;
  if (!customer_id) {
    console.log(`Adding new customer ${email_address}...`);
    customer_id = await customerService.insertCustomer({
      first_name,
      last_name,
      email_address,
      phone_number,
      preferred_contact_method
    });
    console.debug(`New customer ${email_address} added successfully!`);
  }

  console.debug(
    `Searching for photo category ${session_type}...`,
  );
  const categoryService = new CategoryService(ctx);
  const categories = await categoryService.listCategories();
  const category = categories?.find((cat) =>
    cat.category_name.includes(session_type.trim().toLowerCase())
  );
  console.debug(`Category ${category?.category_name} found!`);

  console.debug(`Looking up appointment_requested status...`);
  const { data: statusRows, error: statusError } = await ctx.supabase
    .from("appointment_status")
    .select("id")
    .eq("status_name", "appointment_requested")
    .limit(1);
  if (statusError) throw statusError;
  const status_id = statusRows?.[0]?.id ?? null;
  console.debug(`appointment_requested status_id: ${status_id}`);

  console.debug(`Adding new appointment ${bookingId}...`);
  const apptService = new AppointmentService(ctx);
  await apptService.insertAppointment({
    id: bookingId,
    start_time,
    end_time,
    category_id: category?.id as number,
    aesthetic,
    customer_notes,
    customer_id,
    status_id,
    cal_booking_uid: payload.uid ?? null,
  });
  console.debug(`Appointment ${bookingId} added successfully!`);

  await sendAdminSmsAlert({
    firstName: first_name,
    lastName: last_name,
    sessionType: session_type,
    startTime: start_time,
  });
}

async function sendAdminSmsAlert(params: {
  firstName: string;
  lastName: string;
  sessionType: string;
  startTime: string;
}): Promise<void> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
  const adminPhone = Deno.env.get("ADMIN_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber || !adminPhone) {
    console.warn("Twilio credentials not fully configured — admin SMS not sent");
    return;
  }

  const startDate = new Date(params.startTime);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const body =
    `New booking request!\n` +
    `Client: ${params.firstName} ${params.lastName}\n` +
    `Session: ${params.sessionType}\n` +
    `Date/Time: ${formattedDate} at ${formattedTime}\n` +
    `Log in to review.`;

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);

  const formParams = new URLSearchParams({
    From: fromNumber,
    To: adminPhone,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formParams.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Twilio SMS failed (${res.status}): ${text}`);
  } else {
    console.debug("Admin SMS alert sent successfully via Twilio");
  }
}

function normalizePayloadResponses(payload: CalPayload) {
  const responses = payload.responses;
  if (!responses) throw new APIError("No responses in payload", 400);
  const missing: string[] = [];

  const first_name = responses.name.value.firstName
    ? responses.name.value.first_name as string
    : missing.push("firstName");
  const last_name = responses.name.value.lastName
    ? responses.name.value.last_name as string
    : missing.push("lastName");
  const email_address = responses.email.value
    ? responses.email.value as string
    : missing.push("email");
  const phone_number = responses.attendeePhoneNumber.value
    ? responses.attendeePhoneNumber.value as string
    : missing.push("attendeePhoneNumber");
  const preferred_contact_method = responses.contact_method.value
    ? responses.contact_method.value as string
    : missing.push("contact_method");
  const start_time = payload.startTime ?? missing.push("startTime");
  const end_time = payload.endTime ?? missing.push("startTime");
  const aesthetic = responses.aesthetic.value
    ? responses.aesthetic.value as string
    : missing.push("aesthetic");
  const session_type = responses.session_type.value
    ? responses.session_type.value as string
    : missing.push("session_type");
  // optional
  const customer_notes = responses.notes.value as string;

  if (missing.length) {
    throw new APIError(
      `Missing key/values from payload: ${missing.join(",")}`,
      400,
    );
  }
  return {
    first_name: first_name as string,
    last_name: last_name as string,
    email_address: email_address as string,
    phone_number: phone_number as string,
    preferred_contact_method: preferred_contact_method as string,
    start_time: start_time as string,
    end_time: end_time as string,
    aesthetic: aesthetic as string,
    session_type: session_type as string,
    customer_notes,
  };
}
