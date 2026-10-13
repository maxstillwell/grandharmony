CREATE TYPE "public"."website_media_status" AS ENUM('draft', 'public', 'archived');--> statement-breakpoint
CREATE TYPE "public"."website_revision_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "website_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"alt_text" text,
	"status" "website_media_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_media_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "website_publish_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "website_revision_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_media" ADD CONSTRAINT "website_media_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_publish_events" ADD CONSTRAINT "website_publish_events_revision_id_website_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."website_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_publish_events" ADD CONSTRAINT "website_publish_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_revisions" ADD CONSTRAINT "website_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_revisions" ADD CONSTRAINT "website_revisions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_media_status_updated_idx" ON "website_media" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "website_publish_events_revision_created_idx" ON "website_publish_events" USING btree ("revision_id","created_at");--> statement-breakpoint
CREATE INDEX "website_revisions_status_updated_idx" ON "website_revisions" USING btree ("status","updated_at");