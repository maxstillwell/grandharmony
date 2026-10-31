-- Additive media versioning, not canonical inventory or pricing changes.
CREATE TABLE sales_residence_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',unit_id uuid NOT NULL,
 floor_id text NOT NULL CHECK(floor_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),floor_label text NOT NULL,slot text NOT NULL CHECK(slot ~ '^[a-z0-9][a-z0-9-]{0,79}$'),kind text NOT NULL CHECK(kind IN ('floor-plan','illustration','presentation-board','download','context','palette')),
 version_number integer NOT NULL CHECK(version_number>0),title text NOT NULL,url text NOT NULL,mime text NOT NULL CHECK(mime IN ('image/svg+xml','image/png','image/jpeg','image/webp','application/pdf')),sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),bytes integer CHECK(bytes>0),source_revision text NOT NULL,source_document text NOT NULL,source_floor_id text,previous_id uuid,
 change_status text NOT NULL CHECK(change_status IN ('unchanged','changed','manual-review')),comparison_evidence text,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','approved','rejected')),synthetic boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 reviewed_by_user_id uuid REFERENCES users(id),approved_by_user_id uuid REFERENCES users(id),reviewed_at timestamptz,approved_at timestamptz,approval_evidence text,created_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,scope_key) REFERENCES sales_workspaces(project_id,scope_key),FOREIGN KEY(project_id,unit_id) REFERENCES sales_units(project_id,id),
 UNIQUE(project_id,scope_key,unit_id,floor_id,slot,id),UNIQUE(project_id,scope_key,unit_id,floor_id,slot,version_number),
 FOREIGN KEY(project_id,scope_key,unit_id,floor_id,slot,previous_id) REFERENCES sales_residence_media(project_id,scope_key,unit_id,floor_id,slot,id),
 CHECK(NOT synthetic OR scope_key LIKE 'demo:%'),CHECK(status<>'approved' OR (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL AND length(trim(approval_evidence))>0))
);
--> statement-breakpoint
CREATE INDEX sales_media_project_scope_unit_idx ON sales_residence_media(project_id,scope_key,unit_id);
--> statement-breakpoint
CREATE TABLE sales_residence_media_current (
 project_id uuid NOT NULL,scope_key text NOT NULL DEFAULT 'real',unit_id uuid NOT NULL,floor_id text NOT NULL,slot text NOT NULL,media_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),published_by_user_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,scope_key,unit_id,floor_id,slot),FOREIGN KEY(project_id,scope_key,unit_id,floor_id,slot,media_id) REFERENCES sales_residence_media(project_id,scope_key,unit_id,floor_id,slot,id)
);
--> statement-breakpoint
CREATE FUNCTION sales_media_immutable_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status='approved' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Approved media is immutable; register a replacement'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','revision','reviewed_by_user_id','approved_by_user_id','reviewed_at','approved_at','approval_evidence','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','reviewed_by_user_id','approved_by_user_id','reviewed_at','approved_at','approval_evidence','updated_at']) THEN RAISE EXCEPTION 'Media source metadata is immutable; register a new version'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER sales_media_source_immutable BEFORE UPDATE ON sales_residence_media FOR EACH ROW EXECUTE FUNCTION sales_media_immutable_source();
--> statement-breakpoint
CREATE FUNCTION sales_media_approved_pointer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM sales_residence_media m WHERE m.id=NEW.media_id AND m.project_id=NEW.project_id AND m.scope_key=NEW.scope_key AND m.unit_id=NEW.unit_id AND m.floor_id=NEW.floor_id AND m.slot=NEW.slot AND m.status='approved') THEN RAISE EXCEPTION 'Media pointer requires an approved version in the matching residence and floor'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER sales_media_pointer_approved BEFORE INSERT OR UPDATE ON sales_residence_media_current FOR EACH ROW EXECUTE FUNCTION sales_media_approved_pointer();
