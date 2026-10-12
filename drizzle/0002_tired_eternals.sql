CREATE TYPE "public"."scenario_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "model_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"model_version_id" uuid,
	"project_id" uuid,
	"name" text NOT NULL,
	"notes" text,
	"state" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" "scenario_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"model_version_id" uuid,
	"state" jsonb NOT NULL,
	"notes" text,
	"saved_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_registry" ADD COLUMN "model_key" text;--> statement-breakpoint
ALTER TABLE "model_registry" ADD COLUMN "adapter_key" text;--> statement-breakpoint
ALTER TABLE "model_scenarios" ADD CONSTRAINT "model_scenarios_model_id_model_registry_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model_registry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_scenarios" ADD CONSTRAINT "model_scenarios_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_scenarios" ADD CONSTRAINT "model_scenarios_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_scenarios" ADD CONSTRAINT "model_scenarios_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_scenarios" ADD CONSTRAINT "model_scenarios_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_revisions" ADD CONSTRAINT "scenario_revisions_scenario_id_model_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."model_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_revisions" ADD CONSTRAINT "scenario_revisions_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_revisions" ADD CONSTRAINT "scenario_revisions_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_scenarios_model_project_idx" ON "model_scenarios" USING btree ("model_id","project_id");--> statement-breakpoint
CREATE INDEX "model_scenarios_creator_idx" ON "model_scenarios" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "model_scenarios_updated_idx" ON "model_scenarios" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_revisions_scenario_revision_unique" ON "scenario_revisions" USING btree ("scenario_id","revision");--> statement-breakpoint
CREATE INDEX "scenario_revisions_scenario_created_idx" ON "scenario_revisions" USING btree ("scenario_id","created_at");--> statement-breakpoint
ALTER TABLE "model_registry" ADD CONSTRAINT "model_registry_model_key_unique" UNIQUE("model_key");
--> statement-breakpoint
INSERT INTO "model_registry" ("model_key", "adapter_key", "project_id", "name", "category", "description", "status")
SELECT 'scenario-state-test', 'scenario-state-test', "id", 'Scenario State Test Model', 'other_tools', 'Platform validation adapter only. It stores and restores generic interface state; it contains no financial formulas or project data.', 'active'
FROM "projects"
WHERE "slug" = '700-project'
  AND NOT EXISTS (SELECT 1 FROM "model_registry" WHERE "model_key" = 'scenario-state-test');
--> statement-breakpoint
INSERT INTO "model_versions" ("model_id", "version", "notes")
SELECT "id", '1.0.0', 'Initial platform test adapter version.'
FROM "model_registry"
WHERE "model_key" = 'scenario-state-test'
  AND NOT EXISTS (SELECT 1 FROM "model_versions" WHERE "model_id" = "model_registry"."id" AND "version" = '1.0.0');
