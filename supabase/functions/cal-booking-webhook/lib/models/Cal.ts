export type CalPayload = {
  bookingId?: number;
  uid?: string;
  startTime?: string;
  endTime?: string;
  attendees?: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phoneNumber?: string;
  }>;
  // deno-lint-ignore no-explicit-any
  responses?: Record<string, { value?: any }>;
  userFieldsResponses?: Record<string, { value?: unknown }>;
  cancellationReason?: string;
  rejectionReason?: string;
};

export type CalEventMessage = {
  triggerEvent?: string;
  createdAt?: string;
  payload?: CalPayload;
};
