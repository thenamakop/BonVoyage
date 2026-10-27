ALTER TABLE "trip_package" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "itinerary" ADD COLUMN "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary_item" ADD COLUMN "unverified_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "package_decision_one_per_member" ON "package_decision" USING btree ("package_id","user_id");