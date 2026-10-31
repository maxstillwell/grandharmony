-- REVIEW REQUIRED: do not apply to Neon Production without explicit owner approval.
-- Additive only; no inventory/price/lead/publication records are changed.
CREATE UNIQUE INDEX "sales_leads_project_id_unique" ON "sales_leads" ("project_id","id");
--> statement-breakpoint
CREATE TABLE "sales_buyer_profiles" (
"lead_id" uuid PRIMARY KEY, "project_id" uuid NOT NULL REFERENCES "projects"("id"), "preferred_bedrooms" integer CHECK ("preferred_bedrooms" BETWEEN 0 AND 99), "budget_min" numeric(14,2) CHECK ("budget_min">=0), "budget_max" numeric(14,2) CHECK ("budget_max">=0), "next_action" text, "revision" integer NOT NULL DEFAULT 1 CHECK("revision">0), "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), FOREIGN KEY("project_id","lead_id") REFERENCES "sales_leads"("project_id","id"), CHECK("budget_min" IS NULL OR "budget_max" IS NULL OR "budget_min"<="budget_max")
);
--> statement-breakpoint
CREATE TABLE "sales_offers" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT, "unit_id" uuid NOT NULL, "lead_id" uuid NOT NULL, "agent_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT, "revision" integer NOT NULL DEFAULT 1 CHECK ("revision">0), "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "notes" text, UNIQUE("project_id","id"), UNIQUE("project_id","id","unit_id","lead_id"), FOREIGN KEY("project_id","unit_id") REFERENCES "sales_units"("project_id","id"), FOREIGN KEY("project_id","lead_id") REFERENCES "sales_leads"("project_id","id"), "amount" numeric(14,2) NOT NULL CHECK("amount">0), "offered_at" timestamptz, "expires_at" timestamptz, "conditions" text, "document_reference" text, "status" text NOT NULL DEFAULT 'draft' CHECK("status" IN ('draft','submitted','accepted','rejected','withdrawn')), CHECK("expires_at" IS NULL OR "offered_at" IS NULL OR "expires_at">"offered_at")
);
--> statement-breakpoint
CREATE TABLE "sales_reservations" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT, "unit_id" uuid NOT NULL, "lead_id" uuid NOT NULL, "agent_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT, "revision" integer NOT NULL DEFAULT 1 CHECK ("revision">0), "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "notes" text, UNIQUE("project_id","id"), UNIQUE("project_id","id","unit_id","lead_id"), FOREIGN KEY("project_id","unit_id") REFERENCES "sales_units"("project_id","id"), FOREIGN KEY("project_id","lead_id") REFERENCES "sales_leads"("project_id","id"), "offer_id" uuid, "starts_at" timestamptz, "expires_at" timestamptz, "status" text NOT NULL DEFAULT 'draft' CHECK("status" IN ('draft','active','cancelled','released','expired')), CHECK("status"<>'active' OR "starts_at" IS NOT NULL), CHECK("expires_at" IS NULL OR "starts_at" IS NULL OR "expires_at">"starts_at"), FOREIGN KEY("project_id","offer_id","unit_id","lead_id") REFERENCES "sales_offers"("project_id","id","unit_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "sales_contracts" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT, "unit_id" uuid NOT NULL, "lead_id" uuid NOT NULL, "agent_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT, "revision" integer NOT NULL DEFAULT 1 CHECK ("revision">0), "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "notes" text, UNIQUE("project_id","id"), UNIQUE("project_id","id","unit_id","lead_id"), FOREIGN KEY("project_id","unit_id") REFERENCES "sales_units"("project_id","id"), FOREIGN KEY("project_id","lead_id") REFERENCES "sales_leads"("project_id","id"), "offer_id" uuid, "reservation_id" uuid, "status" text NOT NULL DEFAULT 'draft' CHECK("status" IN ('draft','signed','unconditional','completed','cancelled')), "contract_date" timestamptz, "contract_price" numeric(14,2) CHECK("contract_price">0), "deposit_amount" numeric(14,2) CHECK("deposit_amount">=0), "deposit_received_amount" numeric(14,2) CHECK("deposit_received_amount">=0), "deposit_received_at" timestamptz, "expected_settlement_at" timestamptz, "actual_settlement_at" timestamptz, "settlement_received_amount" numeric(14,2) CHECK("settlement_received_amount">=0), "settlement_received_at" timestamptz, "document_reference" text, "receipt_reference" text, FOREIGN KEY("project_id","offer_id","unit_id","lead_id") REFERENCES "sales_offers"("project_id","id","unit_id","lead_id"), FOREIGN KEY("project_id","reservation_id","unit_id","lead_id") REFERENCES "sales_reservations"("project_id","id","unit_id","lead_id"), CHECK("status"='draft' OR "status"='cancelled' OR ("contract_date" IS NOT NULL AND "contract_price" IS NOT NULL AND coalesce(length(trim("document_reference")),0)>0)), CHECK("deposit_amount" IS NULL OR "contract_price" IS NULL OR "deposit_amount"<="contract_price"), CHECK(("deposit_received_amount" IS NULL)=("deposit_received_at" IS NULL)), CHECK(("settlement_received_amount" IS NULL)=("settlement_received_at" IS NULL)), CHECK("contract_price" IS NULL OR coalesce("deposit_received_amount",0)+coalesce("settlement_received_amount",0)<="contract_price"), CHECK("status"<>'completed' OR "actual_settlement_at" IS NOT NULL), CHECK("expected_settlement_at" IS NULL OR "contract_date" IS NULL OR "expected_settlement_at">="contract_date"), CHECK("actual_settlement_at" IS NULL OR "contract_date" IS NULL OR "actual_settlement_at">="contract_date")
);
--> statement-breakpoint
CREATE TABLE "sales_lifecycle_settings" (
"project_id" uuid PRIMARY KEY REFERENCES "projects"("id"), "proposed_duration_hours" integer CHECK("proposed_duration_hours">0), "proposed_reservation_fee" numeric(14,2) CHECK("proposed_reservation_fee">=0), "automation_enabled" boolean NOT NULL DEFAULT false CHECK(NOT "automation_enabled"), "notes" text, "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "sales_offers_project_unit_idx" ON "sales_offers" ("project_id","unit_id","status");
--> statement-breakpoint
CREATE INDEX "sales_reservations_project_unit_idx" ON "sales_reservations" ("project_id","unit_id","status");
--> statement-breakpoint
CREATE INDEX "sales_contracts_project_unit_idx" ON "sales_contracts" ("project_id","unit_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_one_active_reservation" ON "sales_reservations"("unit_id") WHERE "status"='active';
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_one_active_contract" ON "sales_contracts"("unit_id") WHERE "status" IN ('signed','unconditional');
--> statement-breakpoint
CREATE INDEX "sales_contracts_settlement_idx" ON "sales_contracts"("project_id","expected_settlement_at");
--> statement-breakpoint
CREATE INDEX "sales_buyer_profiles_project_idx" ON "sales_buyer_profiles"("project_id");
--> statement-breakpoint
CREATE INDEX "sales_offers_project_buyer_idx" ON "sales_offers"("project_id","lead_id");
