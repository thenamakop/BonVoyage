CREATE TYPE "public"."climate" AS ENUM('cold', 'mild', 'warm');--> statement-breakpoint
CREATE TYPE "public"."climate_preference" AS ENUM('cold', 'mild', 'warm', 'any');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('onward', 'return', 'stay', 'food', 'activities', 'local');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('accept', 'modify', 'reject');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."itinerary_item_kind" AS ENUM('travel', 'stay', 'activity', 'meal', 'free');--> statement-breakpoint
CREATE TYPE "public"."itinerary_status" AS ENUM('proposed', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('organiser', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('proposed', 'hidden', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."poi_category" AS ENUM('sight', 'temple', 'fort_palace', 'museum', 'market', 'nature', 'adventure', 'food', 'viewpoint', 'wellness');--> statement-breakpoint
CREATE TYPE "public"."provenance" AS ENUM('live', 'cached', 'curated', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."recommendation_kind" AS ENUM('shortlist', 'diagnostic');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('draft', 'verified');--> statement-breakpoint
CREATE TYPE "public"."stay_tier" AS ENUM('budget', 'mid', 'premium');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('bus', 'train', 'car');--> statement-breakpoint
CREATE TYPE "public"."travel_style" AS ENUM('budget', 'comfort', 'premium');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('draft', 'collecting_preferences', 'ready_for_recommendation', 'shortlisted', 'packages_proposed', 'package_selected', 'itinerary_proposed', 'finalised', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_rule" (
	"key" text PRIMARY KEY NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_url" text,
	"collected_on" date NOT NULL,
	"review_status" "review_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"types" text[] NOT NULL,
	"activities" text[] NOT NULL,
	"climate" "climate" NOT NULL,
	"best_months" smallint[] NOT NULL,
	"min_nights" smallint NOT NULL,
	"stay_budget_inr" integer,
	"stay_mid_inr" integer,
	"stay_premium_inr" integer,
	"food_per_day_inr" integer,
	"local_per_day_inr" integer,
	"source_url" text,
	"collected_on" date NOT NULL,
	"review_status" "review_status" NOT NULL,
	"cost_source_url" text,
	"cost_collected_on" date,
	"cost_review_status" "review_status" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destination_slug_unique" UNIQUE("slug"),
	CONSTRAINT "destination_lat_india" CHECK ("destination"."lat" between 6.0 and 37.6),
	CONSTRAINT "destination_lng_india" CHECK ("destination"."lng" between 68.0 and 97.5),
	CONSTRAINT "destination_min_nights" CHECK ("destination"."min_nights" between 1 and 14),
	CONSTRAINT "destination_costs_nonnegative" CHECK (("destination"."stay_budget_inr" is null or "destination"."stay_budget_inr" >= 0)
        and ("destination"."stay_mid_inr" is null or "destination"."stay_mid_inr" >= 0)
        and ("destination"."stay_premium_inr" is null or "destination"."stay_premium_inr" >= 0)
        and ("destination"."food_per_day_inr" is null or "destination"."food_per_day_inr" >= 0)
        and ("destination"."local_per_day_inr" is null or "destination"."local_per_day_inr" >= 0)),
	CONSTRAINT "destination_stay_order" CHECK (("destination"."stay_budget_inr" is null or "destination"."stay_mid_inr" is null or "destination"."stay_premium_inr" is null)
        or ("destination"."stay_budget_inr" <= "destination"."stay_mid_inr" and "destination"."stay_mid_inr" <= "destination"."stay_premium_inr"))
);
--> statement-breakpoint
CREATE TABLE "distance_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_key" text NOT NULL,
	"destination_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"distance_km" integer NOT NULL,
	"duration_min" integer,
	"provenance" "provenance" NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_fallback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_hub_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"mode" "transport_mode" NOT NULL,
	"fare_per_person_inr" integer,
	"duration_minutes" integer NOT NULL,
	"distance_km" integer NOT NULL,
	"source_url" text,
	"collected_on" date NOT NULL,
	"review_status" "review_status" NOT NULL,
	CONSTRAINT "fare_car_no_fare" CHECK ("fare_fallback"."mode" <> 'car' or "fare_fallback"."fare_per_person_inr" is null)
);
--> statement-breakpoint
CREATE TABLE "hub" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"source_url" text,
	"collected_on" date NOT NULL,
	"review_status" "review_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "poi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"poi_key" text NOT NULL,
	"name" text NOT NULL,
	"category" "poi_category" NOT NULL,
	"typical_minutes" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"closed_days" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"entry_fee_inr" integer DEFAULT 0 NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"source_url" text,
	"collected_on" date NOT NULL,
	"review_status" "review_status" NOT NULL,
	CONSTRAINT "poi_open_close_pair" CHECK (("poi"."open_time" is null) = ("poi"."close_time" is null)),
	CONSTRAINT "poi_close_after_open" CHECK ("poi"."open_time" is null or "poi"."close_time" > "poi"."open_time")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"status" "invitation_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"organiser_id" text NOT NULL,
	"origin_hub_id" uuid NOT NULL,
	"duration_nights" smallint NOT NULL,
	"budget_total_inr" integer NOT NULL,
	"radius_km" integer NOT NULL,
	"status" "trip_status" DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_title_len" CHECK (length("trip"."title") between 1 and 120),
	CONSTRAINT "trip_duration_nights" CHECK ("trip"."duration_nights" between 1 and 14),
	CONSTRAINT "trip_budget_positive" CHECK ("trip"."budget_total_inr" > 0),
	CONSTRAINT "trip_radius_positive" CHECK ("trip"."radius_km" > 0),
	CONSTRAINT "trip_date_order" CHECK ("trip"."start_date" is null or "trip"."end_date" is null or "trip"."start_date" <= "trip"."end_date")
);
--> statement-breakpoint
CREATE TABLE "trip_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trip_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"transition_id" text NOT NULL,
	"event" text NOT NULL,
	"from_status" "trip_status",
	"to_status" "trip_status" NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"home_hub_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "past_trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"destination_id" uuid,
	"place_name" text NOT NULL,
	"visited_on" date,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "past_trip_rating" CHECK ("past_trip"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_member_id" uuid NOT NULL,
	"destination_types" text[] NOT NULL,
	"activities" text[] NOT NULL,
	"climate" "climate_preference" NOT NULL,
	"travel_style" "travel_style" NOT NULL,
	"budget_min_inr" integer NOT NULL,
	"budget_max_inr" integer NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preference_budget_min" CHECK ("preference"."budget_min_inr" >= 0),
	CONSTRAINT "preference_budget_order" CHECK ("preference"."budget_min_inr" <= "preference"."budget_max_inr"),
	CONSTRAINT "preference_date_order" CHECK ("preference"."date_start" <= "preference"."date_end")
);
--> statement-breakpoint
CREATE TABLE "recommendation_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"gfs" double precision NOT NULL,
	"mean" double precision NOT NULL,
	"min" double precision NOT NULL,
	"sd" double precision NOT NULL,
	"estimated_cost_inr" integer NOT NULL,
	"distance_km" integer NOT NULL,
	"distance_provenance" "provenance" NOT NULL,
	"reasons" jsonb
);
--> statement-breakpoint
CREATE TABLE "recommendation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"round" smallint DEFAULT 1 NOT NULL,
	"kind" "recommendation_kind" NOT NULL,
	"alpha" double precision NOT NULL,
	"beta" double precision NOT NULL,
	"gamma" double precision NOT NULL,
	"feasible_count" integer NOT NULL,
	"binding_constraint" text,
	"diagnostic" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"category" "cost_category" NOT NULL,
	"label" text NOT NULL,
	"amount_inr" integer NOT NULL,
	"provenance" "provenance" NOT NULL,
	"source_ref" text,
	CONSTRAINT "cost_item_amount" CHECK ("cost_item"."amount_inr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "package_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"decision" "decision" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"transport_mode" "transport_mode" NOT NULL,
	"stay_tier" "stay_tier" NOT NULL,
	"rooms" smallint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_inr" integer NOT NULL,
	"per_person_inr" integer NOT NULL,
	"over_budget" boolean DEFAULT false NOT NULL,
	"status" "package_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_package_rooms" CHECK ("trip_package"."rooms" > 0)
);
--> statement-breakpoint
CREATE TABLE "itinerary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"version" smallint NOT NULL,
	"status" "itinerary_status" DEFAULT 'proposed' NOT NULL,
	"model" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_version" CHECK ("itinerary"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "itinerary_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"decision" "decision" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" uuid NOT NULL,
	"day_number" smallint NOT NULL,
	"position" smallint NOT NULL,
	"start_time" time,
	"end_time" time,
	"kind" "itinerary_item_kind" NOT NULL,
	"poi_id" uuid,
	"note" text,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "itinerary_item_day" CHECK ("itinerary_item"."day_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distance_cache" ADD CONSTRAINT "distance_cache_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_fallback" ADD CONSTRAINT "fare_fallback_origin_hub_id_hub_id_fk" FOREIGN KEY ("origin_hub_id") REFERENCES "public"."hub"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_fallback" ADD CONSTRAINT "fare_fallback_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi" ADD CONSTRAINT "poi_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_organiser_id_user_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_origin_hub_id_hub_id_fk" FOREIGN KEY ("origin_hub_id") REFERENCES "public"."hub"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transition" ADD CONSTRAINT "trip_transition_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transition" ADD CONSTRAINT "trip_transition_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_home_hub_id_hub_id_fk" FOREIGN KEY ("home_hub_id") REFERENCES "public"."hub"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_trip" ADD CONSTRAINT "past_trip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_trip" ADD CONSTRAINT "past_trip_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference" ADD CONSTRAINT "preference_trip_member_id_trip_member_id_fk" FOREIGN KEY ("trip_member_id") REFERENCES "public"."trip_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_run_id_recommendation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recommendation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_package_id_trip_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."trip_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_decision" ADD CONSTRAINT "package_decision_package_id_trip_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."trip_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_decision" ADD CONSTRAINT "package_decision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_package" ADD CONSTRAINT "trip_package_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_package" ADD CONSTRAINT "trip_package_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary" ADD CONSTRAINT "itinerary_package_id_trip_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."trip_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_decision" ADD CONSTRAINT "itinerary_decision_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_decision" ADD CONSTRAINT "itinerary_decision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_item" ADD CONSTRAINT "itinerary_item_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_item" ADD CONSTRAINT "itinerary_item_poi_id_poi_id_fk" FOREIGN KEY ("poi_id") REFERENCES "public"."poi"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "distance_cache_key" ON "distance_cache" USING btree ("origin_key","destination_id","provider");--> statement-breakpoint
CREATE INDEX "distance_cache_destination_idx" ON "distance_cache" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fare_fallback_trip_key" ON "fare_fallback" USING btree ("origin_hub_id","destination_id","mode");--> statement-breakpoint
CREATE INDEX "fare_fallback_origin_hub_idx" ON "fare_fallback" USING btree ("origin_hub_id");--> statement-breakpoint
CREATE INDEX "fare_fallback_destination_idx" ON "fare_fallback" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poi_destination_key" ON "poi" USING btree ("destination_id","poi_key");--> statement-breakpoint
CREATE INDEX "poi_destination_id_idx" ON "poi" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "invitation_trip_idx" ON "invitation" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "invitation_created_by_idx" ON "invitation" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "trip_status_idx" ON "trip" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trip_organiser_idx" ON "trip" USING btree ("organiser_id");--> statement-breakpoint
CREATE INDEX "trip_origin_hub_idx" ON "trip" USING btree ("origin_hub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_member_unique" ON "trip_member" USING btree ("trip_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_member_one_organiser" ON "trip_member" USING btree ("trip_id") WHERE "trip_member"."role" = 'organiser';--> statement-breakpoint
CREATE INDEX "trip_member_trip_idx" ON "trip_member" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_member_user_idx" ON "trip_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_transition_trip_idx" ON "trip_transition" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_transition_actor_idx" ON "trip_transition" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "user_profile_home_hub_idx" ON "user_profile" USING btree ("home_hub_id");--> statement-breakpoint
CREATE INDEX "past_trip_user_idx" ON "past_trip" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "past_trip_destination_idx" ON "past_trip" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_member_unique" ON "preference" USING btree ("trip_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_item_rank" ON "recommendation_item" USING btree ("run_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_item_destination" ON "recommendation_item" USING btree ("run_id","destination_id");--> statement-breakpoint
CREATE INDEX "recommendation_item_run_idx" ON "recommendation_item" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "recommendation_item_destination_idx" ON "recommendation_item" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "recommendation_run_trip_idx" ON "recommendation_run" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "cost_item_package_idx" ON "cost_item" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_decision_package_idx" ON "package_decision" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_decision_user_idx" ON "package_decision" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_package_trip_idx" ON "trip_package" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_package_destination_idx" ON "trip_package" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_package_version" ON "itinerary" USING btree ("package_id","version");--> statement-breakpoint
CREATE INDEX "itinerary_package_idx" ON "itinerary" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "itinerary_decision_itinerary_idx" ON "itinerary_decision" USING btree ("itinerary_id");--> statement-breakpoint
CREATE INDEX "itinerary_decision_user_idx" ON "itinerary_decision" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_item_slot" ON "itinerary_item" USING btree ("itinerary_id","day_number","position");--> statement-breakpoint
CREATE INDEX "itinerary_item_itinerary_idx" ON "itinerary_item" USING btree ("itinerary_id");--> statement-breakpoint
CREATE INDEX "itinerary_item_poi_idx" ON "itinerary_item" USING btree ("poi_id");--> statement-breakpoint
CREATE INDEX "notification_user_read_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notification_trip_idx" ON "notification" USING btree ("trip_id");