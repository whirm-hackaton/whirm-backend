CREATE TABLE "wallet_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"challenge_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "wallet_verifications_challenge_hash_unique" UNIQUE("challenge_hash")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "wallets_address_check" CHECK ("wallets"."address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "wallets_chain_check" CHECK ("wallets"."chain_id" = 84532),
	CONSTRAINT "wallets_status_check" CHECK ("wallets"."status" IN ('candidate', 'unverified', 'verified')),
	CONSTRAINT "wallets_verified_at_check" CHECK (("wallets"."status" = 'verified') = ("wallets"."verified_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "wallet_verifications" ADD CONSTRAINT "wallet_verifications_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_verifications_wallet_id_idx" ON "wallet_verifications" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_chain_idx" ON "wallets" USING btree ("address","chain_id");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_verified_user_idx" ON "wallets" USING btree ("user_id") WHERE "wallets"."status" = 'verified';