CREATE TYPE "public"."sales_lead_status" AS ENUM('new', 'contact_attempted', 'contacted', 'qualified', 'inspection_arranged', 'negotiating', 'converted', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sales_publication_status" AS ENUM('draft', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sales_unit_status" AS ENUM('not_released', 'available', 'on_hold', 'reserved', 'contract_issued', 'contract_signed', 'unconditional', 'settled', 'withdrawn');--> statement-breakpoint
CREATE TABLE "sales_construction_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"unit_id" uuid,
	"lead_id" uuid,
	"publication_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"source" text NOT NULL,
	"status" "sales_lead_status" DEFAULT 'new' NOT NULL,
	"unit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_agent_id" uuid,
	"assigned_staff_id" uuid,
	"follow_up_at" timestamp with time zone,
	"privacy_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"contact_preference" text DEFAULT 'email' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_private_prices" (
	"unit_id" uuid PRIMARY KEY NOT NULL,
	"asking_price" numeric(14, 2),
	"minimum_price" numeric(14, 2),
	"contract_price" numeric(14, 2),
	"deposit_amount" numeric(14, 2),
	"settlement_amount" numeric(14, 2),
	"currency" text DEFAULT 'AUD' NOT NULL,
	"gst_treatment" text DEFAULT 'unconfirmed' NOT NULL,
	"deposit_due_at" timestamp with time zone,
	"settlement_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_prices_nonnegative" CHECK (coalesce("sales_private_prices"."asking_price",0) >= 0 AND coalesce("sales_private_prices"."minimum_price",0) >= 0 AND coalesce("sales_private_prices"."contract_price",0) >= 0 AND coalesce("sales_private_prices"."deposit_amount",0) >= 0 AND coalesce("sales_private_prices"."settlement_amount",0) >= 0),
	CONSTRAINT "sales_prices_aud" CHECK ("sales_private_prices"."currency" = 'AUD'),
	CONSTRAINT "sales_prices_gst" CHECK ("sales_private_prices"."gst_treatment" IN ('unconfirmed','inclusive','exclusive','margin_scheme','not_applicable'))
);
--> statement-breakpoint
CREATE TABLE "sales_projects" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"expected_units" integer,
	"next_revision" integer DEFAULT 1 NOT NULL,
	"published_publication_id" uuid,
	"enquiries_enabled" boolean DEFAULT false NOT NULL,
	"privacy_version" text,
	"privacy_notice" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_projects_public_key_unique" UNIQUE("public_key"),
	CONSTRAINT "sales_project_capacity" CHECK ("sales_projects"."expected_units" IS NULL OR "sales_projects"."expected_units" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "sales_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" "sales_publication_status" DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"digest" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"published_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"restored_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"bucket" integer NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_release_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" text NOT NULL,
	"lot" text,
	"housing_type" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"car_spaces" integer,
	"floor_levels" integer,
	"land_area_sqm" numeric(12, 2),
	"building_area_sqm" numeric(12, 2),
	"internal_area_sqm" numeric(12, 2),
	"outdoor_area_sqm" numeric(12, 2),
	"total_area_sqm" numeric(12, 2),
	"construction_stage_id" uuid,
	"release_stage_id" uuid,
	"status" "sales_unit_status" DEFAULT 'not_released' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"internal_notes" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"floor_plans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_document" text NOT NULL,
	"validation_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_visible" boolean DEFAULT false NOT NULL,
	"public_price_visible" boolean DEFAULT false NOT NULL,
	"public_asking_price" numeric(14, 2),
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_units_valid_number" CHECK (length(trim("sales_units"."number")) > 0 AND "sales_units"."number" !~* '^TEST-'),
	CONSTRAINT "sales_units_nonnegative" CHECK (coalesce("sales_units"."bedrooms",0) >= 0 AND coalesce("sales_units"."bathrooms",0) >= 0 AND coalesce("sales_units"."car_spaces",0) >= 0 AND coalesce("sales_units"."floor_levels",0) >= 0 AND coalesce("sales_units"."land_area_sqm",0) >= 0 AND coalesce("sales_units"."building_area_sqm",0) >= 0 AND coalesce("sales_units"."internal_area_sqm",0) >= 0 AND coalesce("sales_units"."outdoor_area_sqm",0) >= 0 AND coalesce("sales_units"."total_area_sqm",0) >= 0 AND coalesce("sales_units"."public_asking_price",0) >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_construction_code_unique" ON "sales_construction_stages" USING btree ("project_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_construction_project_id_unique" ON "sales_construction_stages" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_publications_project_revision_unique" ON "sales_publications" USING btree ("project_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_publications_project_id_unique" ON "sales_publications" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_release_code_unique" ON "sales_release_stages" USING btree ("project_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_release_project_id_unique" ON "sales_release_stages" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_units_project_number_unique" ON "sales_units" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_units_project_id_unique" ON "sales_units" USING btree ("project_id","id");--> statement-breakpoint
ALTER TABLE "sales_construction_stages" ADD CONSTRAINT "sales_construction_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_unit_id_sales_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."sales_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_lead_id_sales_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."sales_leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_publication_id_sales_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."sales_publications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_private_prices" ADD CONSTRAINT "sales_private_prices_unit_id_sales_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."sales_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_projects" ADD CONSTRAINT "sales_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_projects" ADD CONSTRAINT "sales_projects_project_id_published_publication_id_sales_publications_project_id_id_fk" FOREIGN KEY ("project_id","published_publication_id") REFERENCES "public"."sales_publications"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_publications" ADD CONSTRAINT "sales_publications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_publications" ADD CONSTRAINT "sales_publications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_publications" ADD CONSTRAINT "sales_publications_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_publications" ADD CONSTRAINT "sales_publications_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_release_stages" ADD CONSTRAINT "sales_release_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_units" ADD CONSTRAINT "sales_units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_units" ADD CONSTRAINT "sales_units_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_units" ADD CONSTRAINT "sales_units_project_id_construction_stage_id_sales_construction_stages_project_id_id_fk" FOREIGN KEY ("project_id","construction_stage_id") REFERENCES "public"."sales_construction_stages"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_units" ADD CONSTRAINT "sales_units_project_id_release_stage_id_sales_release_stages_project_id_id_fk" FOREIGN KEY ("project_id","release_stage_id") REFERENCES "public"."sales_release_stages"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_events_project_created_idx" ON "sales_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_events_lead_idx" ON "sales_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sales_leads_project_followup_idx" ON "sales_leads" USING btree ("project_id","follow_up_at");--> statement-breakpoint
CREATE INDEX "sales_leads_agent_idx" ON "sales_leads" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "sales_leads_staff_idx" ON "sales_leads" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "sales_rate_limits_expiry_idx" ON "sales_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sales_units_project_status_idx" ON "sales_units" USING btree ("project_id","status");
--> statement-breakpoint
-- Snapshot payloads are immutable even before approval. A correction or rollback
-- creates a new revision; only lifecycle metadata may change in place.
CREATE FUNCTION sales_publication_immutable_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.digest IS DISTINCT FROM OLD.digest
     OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.revision IS DISTINCT FROM OLD.revision
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.restored_from_id IS DISTINCT FROM OLD.restored_from_id THEN
    RAISE EXCEPTION 'Sales publication payloads are immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sales_publication_immutable_payload_trigger BEFORE UPDATE ON sales_publications
FOR EACH ROW EXECUTE FUNCTION sales_publication_immutable_payload();
