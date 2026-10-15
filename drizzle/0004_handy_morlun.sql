CREATE TYPE "public"."scenario_share_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "scenario_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "scenario_share_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_share_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_link_id" uuid NOT NULL,
	"session_hash" text NOT NULL,
	"contributor_user_id" uuid NOT NULL,
	"contributor_name" text NOT NULL,
	"contributor_email" text,
	"scenario_id" uuid,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenario_share_links" ADD CONSTRAINT "scenario_share_links_scenario_id_model_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."model_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_share_links" ADD CONSTRAINT "scenario_share_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_share_sessions" ADD CONSTRAINT "scenario_share_sessions_share_link_id_scenario_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."scenario_share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_share_sessions" ADD CONSTRAINT "scenario_share_sessions_contributor_user_id_users_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_share_sessions" ADD CONSTRAINT "scenario_share_sessions_scenario_id_model_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."model_scenarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_share_links_token_hash_unique" ON "scenario_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "scenario_share_links_scenario_status_idx" ON "scenario_share_links" USING btree ("scenario_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_share_sessions_session_hash_unique" ON "scenario_share_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE INDEX "scenario_share_sessions_link_idx" ON "scenario_share_sessions" USING btree ("share_link_id");