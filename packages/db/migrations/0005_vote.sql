CREATE TABLE "vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"trip_member_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_run_id_recommendation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recommendation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_trip_member_id_trip_member_id_fk" FOREIGN KEY ("trip_member_id") REFERENCES "public"."trip_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_run_item_fk" FOREIGN KEY ("run_id","destination_id") REFERENCES "public"."recommendation_item"("run_id","destination_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vote_one_per_member" ON "vote" USING btree ("run_id","trip_member_id");--> statement-breakpoint
CREATE INDEX "vote_trip_member_idx" ON "vote" USING btree ("trip_member_id");--> statement-breakpoint
CREATE INDEX "vote_run_destination_idx" ON "vote" USING btree ("run_id","destination_id");