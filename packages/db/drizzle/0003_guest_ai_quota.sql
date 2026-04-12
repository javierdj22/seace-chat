CREATE TABLE IF NOT EXISTS "ai_guest_quota" (
	"guest_id" text PRIMARY KEY NOT NULL,
	"monthly_credit_limit" integer DEFAULT 2 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_event" ADD COLUMN IF NOT EXISTS "guest_id" text;
