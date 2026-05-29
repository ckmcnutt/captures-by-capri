export type CalPayload = {
  bookingId?: number;
  startTime?: string;
  endTime?: string;
  attendees?: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phoneNumber?: string;
  }>;
  responses?: Record<string, { value?: unknown }>;
  userFieldsResponses?: Record<string, { value?: unknown }>;
};

export type CalEventMessage = {
  triggerEvent?: string;
  createdAt?: string;
  payload?: CalPayload;
};