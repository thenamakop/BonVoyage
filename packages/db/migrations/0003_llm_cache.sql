CREATE TABLE "llm_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "llm_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE INDEX "llm_cache_expires_at_idx" ON "llm_cache" USING btree ("expires_at");