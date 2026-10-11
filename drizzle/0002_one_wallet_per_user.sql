DROP INDEX "wallets_verified_user_idx";--> statement-breakpoint
DROP INDEX "wallets_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");