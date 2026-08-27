CREATE TABLE "bank_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"bank_module" text DEFAULT 'cmb' NOT NULL,
	"accounts_data" jsonb NOT NULL,
	"total_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
