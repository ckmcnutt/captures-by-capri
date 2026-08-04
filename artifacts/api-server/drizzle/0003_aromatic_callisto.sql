CREATE TABLE "admin_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"admin_phone_number" text,
	"admin_phone_carrier" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
