CREATE TABLE "pricing_config" (
	"kind" text PRIMARY KEY NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_price_id" text,
	"stripe_payment_link_id" text,
	"stripe_payment_link_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
