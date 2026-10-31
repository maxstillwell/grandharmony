-- Owner-authorised additive platform extension; no canonical inventory or price rows are changed.
CREATE TABLE sales_workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id),scope_key text NOT NULL,kind text NOT NULL CHECK(kind IN ('real','demo')),name text NOT NULL,created_by_user_id uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,scope_key),CHECK((kind='real' AND scope_key='real') OR (kind='demo' AND scope_key LIKE 'demo:%' AND created_by_user_id IS NOT NULL)));
--> statement-breakpoint
INSERT INTO sales_workspaces(project_id,scope_key,kind,name) SELECT id,'real','real',name FROM projects;
--> statement-breakpoint
ALTER TABLE sales_leads ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_buyer_profiles ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_buyer_profiles ADD CONSTRAINT sales_buyer_profiles_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_offers ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_offers ADD CONSTRAINT sales_offers_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_reservations ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_reservations ADD CONSTRAINT sales_reservations_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_contracts ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_contracts ADD CONSTRAINT sales_contracts_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_lifecycle_settings ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_lifecycle_settings ADD CONSTRAINT sales_lifecycle_settings_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_events ADD COLUMN scope_key text NOT NULL DEFAULT 'real';
--> statement-breakpoint
ALTER TABLE sales_events ADD CONSTRAINT sales_events_workspace_fk FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_leads_scope_id_unique ON sales_leads(project_id,id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_offers_scope_id_unique ON sales_offers(project_id,id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_reservations_scope_id_unique ON sales_reservations(project_id,id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_contracts_scope_id_unique ON sales_contracts(project_id,id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_offers ADD CONSTRAINT sales_offers_buyer_scope_fk FOREIGN KEY(project_id,lead_id,scope_key) REFERENCES sales_leads(project_id,id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_reservations ADD CONSTRAINT sales_reservations_buyer_scope_fk FOREIGN KEY(project_id,lead_id,scope_key) REFERENCES sales_leads(project_id,id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_contracts ADD CONSTRAINT sales_contracts_buyer_scope_fk FOREIGN KEY(project_id,lead_id,scope_key) REFERENCES sales_leads(project_id,id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_buyer_profiles ADD CONSTRAINT buyer_profile_scope_fk FOREIGN KEY(project_id,lead_id,scope_key) REFERENCES sales_leads(project_id,id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_offers_scope_link_unique ON sales_offers(project_id,id,unit_id,lead_id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_reservations_scope_link_unique ON sales_reservations(project_id,id,unit_id,lead_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_reservations ADD CONSTRAINT sales_reservations_offer_scope_fk FOREIGN KEY(project_id,offer_id,unit_id,lead_id,scope_key) REFERENCES sales_offers(project_id,id,unit_id,lead_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_contracts ADD CONSTRAINT sales_contracts_offer_scope_fk FOREIGN KEY(project_id,offer_id,unit_id,lead_id,scope_key) REFERENCES sales_offers(project_id,id,unit_id,lead_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_contracts ADD CONSTRAINT contract_reservation_scope_fk FOREIGN KEY(project_id,reservation_id,unit_id,lead_id,scope_key) REFERENCES sales_reservations(project_id,id,unit_id,lead_id,scope_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_one_active_reservation_scope ON sales_reservations(unit_id,scope_key) WHERE status='active';
--> statement-breakpoint
CREATE UNIQUE INDEX sales_one_active_contract_scope ON sales_contracts(unit_id,scope_key) WHERE status IN ('signed','conditional','unconditional');
--> statement-breakpoint
DROP INDEX sales_one_active_reservation;
--> statement-breakpoint
DROP INDEX sales_one_active_contract;
--> statement-breakpoint
ALTER TABLE sales_lifecycle_settings DROP CONSTRAINT sales_lifecycle_settings_pkey;
--> statement-breakpoint
ALTER TABLE sales_lifecycle_settings ADD PRIMARY KEY(project_id,scope_key);
--> statement-breakpoint
ALTER TABLE sales_buyer_profiles ADD COLUMN preferred_types jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE sales_reservations ADD COLUMN fee_amount numeric(14,2) CHECK(fee_amount>=0);
--> statement-breakpoint
ALTER TABLE sales_contracts ADD COLUMN deposit_percentage numeric(7,4) CHECK(deposit_percentage BETWEEN 0 AND 100), ADD COLUMN deposit_due_at timestamptz,ADD COLUMN finance_condition text,ADD COLUMN other_conditions text,ADD COLUMN unconditional_at timestamptz,ADD COLUMN solicitor_name text,ADD COLUMN solicitor_email text,ADD COLUMN solicitor_phone text;
--> statement-breakpoint
ALTER TABLE sales_contracts DROP CONSTRAINT sales_contracts_status_check;
--> statement-breakpoint
ALTER TABLE sales_contracts ADD CONSTRAINT sales_contracts_status_check CHECK(status IN ('draft','signed','conditional','unconditional','completed','cancelled','terminated'));
--> statement-breakpoint
CREATE TABLE sales_demo_unit_state(project_id uuid NOT NULL,scope_key text NOT NULL CHECK(scope_key LIKE 'demo:%'),unit_id uuid NOT NULL,status sales_unit_status NOT NULL,revision integer NOT NULL CHECK(revision>0),contract_price numeric(14,2),deposit_amount numeric(14,2),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,scope_key,unit_id),FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),FOREIGN KEY(project_id,unit_id) REFERENCES sales_units(project_id,id));
--> statement-breakpoint
CREATE TABLE sales_agents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),user_id uuid NOT NULL REFERENCES users(id),display_name text NOT NULL,company text,email text,phone text,notes text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,scope_key,user_id),UNIQUE(project_id,id,scope_key));
--> statement-breakpoint
CREATE TABLE sales_commission_agreements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),agent_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('fixed','percentage')),rate numeric(7,4) CHECK(rate BETWEEN 0 AND 100),fixed_amount numeric(14,2) CHECK(fixed_amount>=0),gst_treatment text NOT NULL CHECK(gst_treatment IN ('unconfirmed','inclusive','exclusive','not_applicable')),gst_rate numeric(7,4) CHECK(gst_rate BETWEEN 0 AND 100),payable_milestone text NOT NULL DEFAULT 'manual' CHECK(payable_milestone IN ('manual','signed','unconditional','settled')),document_reference text,notes text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,id,scope_key),FOREIGN KEY(project_id,agent_id,scope_key) REFERENCES sales_agents(project_id,id,scope_key),CHECK((kind='fixed' AND fixed_amount IS NOT NULL) OR (kind='percentage' AND rate IS NOT NULL)));
--> statement-breakpoint
CREATE TABLE sales_commissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),agent_id uuid NOT NULL,agreement_id uuid NOT NULL,contract_id uuid NOT NULL,estimated_amount numeric(14,2) NOT NULL CHECK(estimated_amount>=0),gst_amount numeric(14,2) CHECK(gst_amount>=0),approved_amount numeric(14,2) CHECK(approved_amount>=0),paid_amount numeric(14,2) CHECK(paid_amount>=0 AND paid_amount<=approved_amount),paid_at timestamptz,payment_reference text,status text NOT NULL DEFAULT 'estimated' CHECK(status IN ('estimated','approved','part_paid','paid','cancelled')),basis jsonb NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(project_id,agent_id,scope_key) REFERENCES sales_agents(project_id,id,scope_key),FOREIGN KEY(project_id,agreement_id,scope_key) REFERENCES sales_commission_agreements(project_id,id,scope_key),FOREIGN KEY(project_id,contract_id,scope_key) REFERENCES sales_contracts(project_id,id,scope_key),UNIQUE(project_id,scope_key,agreement_id,contract_id));
--> statement-breakpoint
CREATE TABLE sales_cash_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),contract_id uuid NOT NULL,category text NOT NULL CHECK(category IN ('deposit','settlement')),amount numeric(14,2) NOT NULL CHECK(amount<>0),received_at timestamptz NOT NULL,reference text NOT NULL,reason text NOT NULL,actor_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(project_id,contract_id,scope_key) REFERENCES sales_contracts(project_id,id,scope_key));
--> statement-breakpoint
CREATE FUNCTION sales_cash_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' AND OLD.scope_key LIKE 'demo:%' THEN RETURN OLD; END IF; RAISE EXCEPTION 'Cash evidence is immutable; use an auditable adjustment'; END $$;
--> statement-breakpoint
CREATE TRIGGER sales_cash_immutable BEFORE UPDATE OR DELETE ON sales_cash_entries FOR EACH ROW EXECUTE FUNCTION sales_cash_immutable();
--> statement-breakpoint
INSERT INTO sales_cash_entries(project_id,scope_key,contract_id,category,amount,received_at,reference,reason,actor_user_id) SELECT project_id,scope_key,id,'deposit',deposit_received_amount,deposit_received_at,coalesce(receipt_reference,'Existing confirmed deposit'),'Preserved from pre-ledger confirmed receipt',updated_by_user_id FROM sales_contracts WHERE deposit_received_amount>0;
--> statement-breakpoint
INSERT INTO sales_cash_entries(project_id,scope_key,contract_id,category,amount,received_at,reference,reason,actor_user_id) SELECT project_id,scope_key,id,'settlement',settlement_received_amount,settlement_received_at,coalesce(receipt_reference,'Existing confirmed settlement'),'Preserved from pre-ledger confirmed receipt',updated_by_user_id FROM sales_contracts WHERE settlement_received_amount>0;
--> statement-breakpoint
CREATE TABLE sales_release_plans(project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),stage_id uuid NOT NULL,planned_at timestamptz,target_units integer CHECK(target_units>=0),target_value numeric(14,2) CHECK(target_value>=0),pricing_note text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,scope_key,stage_id),FOREIGN KEY(project_id,stage_id) REFERENCES sales_release_stages(project_id,id));
--> statement-breakpoint
CREATE TABLE sales_task_states(project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),user_id uuid NOT NULL REFERENCES users(id),task_key text NOT NULL,snoozed_until timestamptz,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,scope_key,user_id,task_key));
--> statement-breakpoint
CREATE INDEX sales_leads_scope_idx ON sales_leads(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_offers_scope_idx ON sales_offers(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_reservations_scope_idx ON sales_reservations(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_contracts_scope_idx ON sales_contracts(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_events_scope_idx ON sales_events(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_cash_entries_scope_idx ON sales_cash_entries(project_id,scope_key);
--> statement-breakpoint
CREATE INDEX sales_commissions_scope_idx ON sales_commissions(project_id,scope_key);

--> statement-breakpoint
ALTER TABLE sales_events ADD CONSTRAINT sales_events_buyer_scope_fk FOREIGN KEY(project_id,lead_id,scope_key) REFERENCES sales_leads(project_id,id,scope_key);
