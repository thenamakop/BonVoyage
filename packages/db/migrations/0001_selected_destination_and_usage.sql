CREATE TABLE "provider_usage" (
	"provider" text NOT NULL,
	"day" date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "provider_usage_provider_day_pk" PRIMARY KEY("provider","day"),
	CONSTRAINT "provider_usage_calls_nonnegative" CHECK ("provider_usage"."calls" >= 0)
);
--> statement-breakpoint
ALTER TABLE "past_trip" ALTER COLUMN "place_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "selected_destination_id" uuid;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_selected_destination_id_destination_id_fk" FOREIGN KEY ("selected_destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_selected_destination_idx" ON "trip" USING btree ("selected_destination_id");--> statement-breakpoint
-- S2-2: clear copied catalogue names before enforcing exactly one place representation.
UPDATE "past_trip" SET "place_name" = NULL WHERE "destination_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "past_trip" ADD CONSTRAINT "past_trip_place_one_of" CHECK (num_nonnulls("past_trip"."destination_id", "past_trip"."place_name") = 1);