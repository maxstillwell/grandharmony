import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PublicSnapshot } from "../sales/domain";

export const appRole = pgEnum("app_role", ["super_admin", "management", "project_manager", "finance", "sales_manager", "external_agent"]);
export const modelStatus = pgEnum("model_status", ["not_integrated", "active", "archived"]);
export const scenarioStatus = pgEnum("scenario_status", ["active", "archived"]);
export const scenarioShareStatus = pgEnum("scenario_share_status", ["active", "revoked"]);
export const websiteRevisionStatus = pgEnum("website_revision_status", ["draft", "published", "archived"]);
export const websiteMediaStatus = pgEnum("website_media_status", ["draft", "public", "archived"]);

const timestamps = { createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull() };

export const users = pgTable("users", { id: uuid("id").defaultRandom().primaryKey(), email: text("email").notNull(), name: text("name"), image: text("image"), passwordHash: text("password_hash"), emailVerified: timestamp("email_verified", { withTimezone: true }), isActive: boolean("is_active").default(true).notNull(), ...timestamps }, (table) => [uniqueIndex("users_email_unique").on(table.email)]);
export const roles = pgTable("roles", { id: uuid("id").defaultRandom().primaryKey(), name: appRole("name").notNull().unique(), description: text("description"), ...timestamps });
export const userRoles = pgTable("user_roles", { userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }), ...timestamps }, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const projects = pgTable("projects", { id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), slug: text("slug").notNull(), location: text("location"), isActive: boolean("is_active").default(true).notNull(), ...timestamps }, (table) => [uniqueIndex("projects_slug_unique").on(table.slug)]);
export const projectMemberships = pgTable("project_memberships", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), role: appRole("role").notNull(), canManage: boolean("can_manage").default(false).notNull(), ...timestamps }, (table) => [uniqueIndex("project_memberships_project_user_unique").on(table.projectId, table.userId), index("project_memberships_user_id_idx").on(table.userId)]);

export const modelRegistry = pgTable("model_registry", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), modelKey: text("model_key").unique(), adapterKey: text("adapter_key"), name: text("name").notNull(), category: text("category").notNull(), description: text("description").notNull(), status: modelStatus("status").default("not_integrated").notNull(), ...timestamps });
export const modelVersions = pgTable("model_versions", { id: uuid("id").defaultRandom().primaryKey(), modelId: uuid("model_id").notNull().references(() => modelRegistry.id, { onDelete: "cascade" }), version: text("version").notNull(), integrationUrl: text("integration_url"), notes: text("notes"), ...timestamps }, (table) => [uniqueIndex("model_versions_model_version_unique").on(table.modelId, table.version)]);
export const modelScenarios = pgTable("model_scenarios", { id: uuid("id").defaultRandom().primaryKey(), modelId: uuid("model_id").notNull().references(() => modelRegistry.id, { onDelete: "restrict" }), modelVersionId: uuid("model_version_id").references(() => modelVersions.id, { onDelete: "set null" }), projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), name: text("name").notNull(), notes: text("notes"), state: jsonb("state").$type<Record<string, unknown>>().notNull(), revision: integer("revision").default(1).notNull(), status: scenarioStatus("status").default("active").notNull(), createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), ...timestamps }, (table) => [index("model_scenarios_model_project_idx").on(table.modelId, table.projectId), index("model_scenarios_creator_idx").on(table.createdByUserId), index("model_scenarios_updated_idx").on(table.updatedAt)]);
export const scenarioRevisions = pgTable("scenario_revisions", { id: uuid("id").defaultRandom().primaryKey(), scenarioId: uuid("scenario_id").notNull().references(() => modelScenarios.id, { onDelete: "cascade" }), revision: integer("revision").notNull(), modelVersionId: uuid("model_version_id").references(() => modelVersions.id, { onDelete: "set null" }), state: jsonb("state").$type<Record<string, unknown>>().notNull(), notes: text("notes"), savedByUserId: uuid("saved_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull() }, (table) => [uniqueIndex("scenario_revisions_scenario_revision_unique").on(table.scenarioId, table.revision), index("scenario_revisions_scenario_created_idx").on(table.scenarioId, table.createdAt)]);
// Raw collaboration tokens and browser-session tokens are never stored. Only
// their SHA-256 hashes reach the database, so a database export cannot mint a
// usable external editing link or take over a contributor's draft.
export const scenarioShareLinks = pgTable("scenario_share_links", { id: uuid("id").defaultRandom().primaryKey(), scenarioId: uuid("scenario_id").notNull().references(() => modelScenarios.id, { onDelete: "cascade" }), tokenHash: text("token_hash").notNull(), status: scenarioShareStatus("status").default("active").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), revokedAt: timestamp("revoked_at", { withTimezone: true }), createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), ...timestamps }, (table) => [uniqueIndex("scenario_share_links_token_hash_unique").on(table.tokenHash), index("scenario_share_links_scenario_status_idx").on(table.scenarioId, table.status)]);
export const scenarioShareSessions = pgTable("scenario_share_sessions", { id: uuid("id").defaultRandom().primaryKey(), shareLinkId: uuid("share_link_id").notNull().references(() => scenarioShareLinks.id, { onDelete: "cascade" }), sessionHash: text("session_hash").notNull(), contributorUserId: uuid("contributor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), contributorName: text("contributor_name").notNull(), contributorEmail: text("contributor_email"), scenarioId: uuid("scenario_id").references(() => modelScenarios.id, { onDelete: "restrict" }), lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(), ...timestamps }, (table) => [uniqueIndex("scenario_share_sessions_session_hash_unique").on(table.sessionHash), index("scenario_share_sessions_link_idx").on(table.shareLinkId)]);
export const auditLogs = pgTable("audit_logs", { id: uuid("id").defaultRandom().primaryKey(), actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: uuid("entity_id"), metadata: jsonb("metadata").$type<Record<string, unknown>>(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull() }, (table) => [index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt)]);

// A revision is a complete, structured public-site snapshot. This keeps drafts
// isolated and makes publish/restore atomic without exposing internal projects.
export const websiteRevisions = pgTable("website_revisions", { id: uuid("id").defaultRandom().primaryKey(), status: websiteRevisionStatus("status").default("draft").notNull(), content: jsonb("content").$type<Record<string, unknown>>().notNull(), createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), publishedByUserId: uuid("published_by_user_id").references(() => users.id, { onDelete: "restrict" }), publishedAt: timestamp("published_at", { withTimezone: true }), ...timestamps }, (table) => [index("website_revisions_status_updated_idx").on(table.status, table.updatedAt)]);
export const websiteMedia = pgTable("website_media", { id: uuid("id").defaultRandom().primaryKey(), storageKey: text("storage_key").notNull().unique(), url: text("url").notNull(), filename: text("filename").notNull(), mimeType: text("mime_type").notNull(), bytes: integer("bytes").notNull(), width: integer("width"), height: integer("height"), durationSeconds: integer("duration_seconds"), altText: text("alt_text"), status: websiteMediaStatus("status").default("draft").notNull(), createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), ...timestamps }, (table) => [index("website_media_status_updated_idx").on(table.status, table.updatedAt)]);
export const websitePublishEvents = pgTable("website_publish_events", { id: uuid("id").defaultRandom().primaryKey(), revisionId: uuid("revision_id").notNull().references(() => websiteRevisions.id, { onDelete: "restrict" }), action: text("action").notNull(), actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), metadata: jsonb("metadata").$type<Record<string, unknown>>(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull() }, (table) => [index("website_publish_events_revision_created_idx").on(table.revisionId, table.createdAt)]);

// Auth.js adapter tables are included for future database-backed sessions and account linkage.
export const accounts = pgTable("accounts", { userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), type: text("type").notNull(), provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(), refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: timestamp("expires_at", { withTimezone: true }), token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state") }, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);
export const sessions = pgTable("sessions", { sessionToken: text("session_token").primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), expires: timestamp("expires", { withTimezone: true }).notNull() });
export const verificationTokens = pgTable("verification_tokens", { identifier: text("identifier").notNull(), token: text("token").notNull(), expires: timestamp("expires", { withTimezone: true }).notNull() }, (table) => [primaryKey({ columns: [table.identifier, table.token] })]);

// Sales is additive: no existing Portal tables or records are repurposed.
export const salesStatus = pgEnum("sales_unit_status", ["not_released", "available", "on_hold", "reserved", "contract_issued", "contract_signed", "unconditional", "settled", "withdrawn"]);
export const leadStatus = pgEnum("sales_lead_status", ["new", "contact_attempted", "contacted", "qualified", "inspection_arranged", "negotiating", "converted", "lost", "archived"]);
export const publicationStatus = pgEnum("sales_publication_status", ["draft", "approved", "published", "archived"]);

export const salesConstructionStages = pgTable("sales_construction_stages", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }), code: text("code").notNull(), name: text("name").notNull(), sequence: integer("sequence").default(0).notNull(), ...timestamps,
}, t => [uniqueIndex("sales_construction_code_unique").on(t.projectId, t.code), uniqueIndex("sales_construction_project_id_unique").on(t.projectId, t.id)]);
export const salesReleaseStages = pgTable("sales_release_stages", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }), code: text("code").notNull(), name: text("name").notNull(), sequence: integer("sequence").default(0).notNull(), ...timestamps,
}, t => [uniqueIndex("sales_release_code_unique").on(t.projectId, t.code), uniqueIndex("sales_release_project_id_unique").on(t.projectId, t.id)]);

export const salesUnits = pgTable("sales_units", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  number: text("number").notNull(), lot: text("lot"), housingType: text("housing_type"), bedrooms: integer("bedrooms"), bathrooms: integer("bathrooms"), carSpaces: integer("car_spaces"), floorLevels: integer("floor_levels"),
  landAreaSqm: numeric("land_area_sqm", { precision: 12, scale: 2 }), buildingAreaSqm: numeric("building_area_sqm", { precision: 12, scale: 2 }), internalAreaSqm: numeric("internal_area_sqm", { precision: 12, scale: 2 }), outdoorAreaSqm: numeric("outdoor_area_sqm", { precision: 12, scale: 2 }), totalAreaSqm: numeric("total_area_sqm", { precision: 12, scale: 2 }),
  constructionStageId: uuid("construction_stage_id"), releaseStageId: uuid("release_stage_id"), status: salesStatus("status").default("not_released").notNull(), statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).defaultNow().notNull(),
  internalNotes: text("internal_notes"), features: jsonb("features").$type<string[]>().default([]).notNull(),
  floorPlans: jsonb("floor_plans").$type<string[]>().default([]).notNull(), media: jsonb("media").$type<string[]>().default([]).notNull(), specifications: jsonb("specifications").$type<string[]>().default([]).notNull(),
  sourceDocument: text("source_document").notNull(), validationWarnings: jsonb("validation_warnings").$type<string[]>().default([]).notNull(), provenance: jsonb("provenance").$type<Array<{ source: string; actor: string; recordedAt: string }>>().default([]).notNull(),
  publicVisible: boolean("public_visible").default(false).notNull(), publicPriceVisible: boolean("public_price_visible").default(false).notNull(), publicAskingPrice: numeric("public_asking_price", { precision: 14, scale: 2 }),
  revision: integer("revision").default(1).notNull(), updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), ...timestamps,
}, t => [uniqueIndex("sales_units_project_number_unique").on(t.projectId, t.number), uniqueIndex("sales_units_project_id_unique").on(t.projectId, t.id), index("sales_units_project_status_idx").on(t.projectId, t.status),
  foreignKey({ columns: [t.projectId, t.constructionStageId], foreignColumns: [salesConstructionStages.projectId, salesConstructionStages.id] }),
  foreignKey({ columns: [t.projectId, t.releaseStageId], foreignColumns: [salesReleaseStages.projectId, salesReleaseStages.id] }),
  check("sales_units_valid_number", sql`length(trim(${t.number})) > 0 AND ${t.number} !~* '^TEST-'`),
  check("sales_units_nonnegative", sql`coalesce(${t.bedrooms},0) >= 0 AND coalesce(${t.bathrooms},0) >= 0 AND coalesce(${t.carSpaces},0) >= 0 AND coalesce(${t.floorLevels},0) >= 0 AND coalesce(${t.landAreaSqm},0) >= 0 AND coalesce(${t.buildingAreaSqm},0) >= 0 AND coalesce(${t.internalAreaSqm},0) >= 0 AND coalesce(${t.outdoorAreaSqm},0) >= 0 AND coalesce(${t.totalAreaSqm},0) >= 0 AND coalesce(${t.publicAskingPrice},0) >= 0`),
]);
export const salesPrivatePrices = pgTable("sales_private_prices", {
  unitId: uuid("unit_id").primaryKey().references(() => salesUnits.id, { onDelete: "restrict" }),
  askingPrice: numeric("asking_price", { precision: 14, scale: 2 }), minimumPrice: numeric("minimum_price", { precision: 14, scale: 2 }), contractPrice: numeric("contract_price", { precision: 14, scale: 2 }), depositAmount: numeric("deposit_amount", { precision: 14, scale: 2 }), settlementAmount: numeric("settlement_amount", { precision: 14, scale: 2 }),
  currency: text("currency").default("AUD").notNull(), gstTreatment: text("gst_treatment").default("unconfirmed").notNull(), depositDueAt: timestamp("deposit_due_at", { withTimezone: true }), settlementDueAt: timestamp("settlement_due_at", { withTimezone: true }), ...timestamps,
}, t => [check("sales_prices_nonnegative", sql`coalesce(${t.askingPrice},0) >= 0 AND coalesce(${t.minimumPrice},0) >= 0 AND coalesce(${t.contractPrice},0) >= 0 AND coalesce(${t.depositAmount},0) >= 0 AND coalesce(${t.settlementAmount},0) >= 0`), check("sales_prices_aud", sql`${t.currency} = 'AUD'`), check("sales_prices_gst", sql`${t.gstTreatment} IN ('unconfirmed','inclusive','exclusive','margin_scheme','not_applicable')`)]);

export const salesPublications = pgTable("sales_publications", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }), revision: integer("revision").notNull(), status: publicationStatus("status").default("draft").notNull(), snapshot: jsonb("snapshot").$type<PublicSnapshot>().notNull(), digest: text("digest").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }), publishedByUserId: uuid("published_by_user_id").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), publishedAt: timestamp("published_at", { withTimezone: true }), restoredFromId: uuid("restored_from_id"), ...timestamps,
}, t => [uniqueIndex("sales_publications_project_revision_unique").on(t.projectId, t.revision), uniqueIndex("sales_publications_project_id_unique").on(t.projectId, t.id)]);
export const salesProjects = pgTable("sales_projects", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id, { onDelete: "restrict" }), publicKey: text("public_key").notNull().unique(), expectedUnits: integer("expected_units"), nextRevision: integer("next_revision").default(1).notNull(), publishedPublicationId: uuid("published_publication_id"), enquiriesEnabled: boolean("enquiries_enabled").default(false).notNull(), privacyVersion: text("privacy_version"), privacyNotice: text("privacy_notice"), ...timestamps,
}, t => [foreignKey({ columns: [t.projectId, t.publishedPublicationId], foreignColumns: [salesPublications.projectId, salesPublications.id] }), check("sales_project_capacity", sql`${t.expectedUnits} IS NULL OR ${t.expectedUnits} BETWEEN 1 AND 10000`)]);

export const salesLeads = pgTable("sales_leads", {
  scopeKey: text("scope_key").default("real").notNull(),
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }), name: text("name").notNull(), email: text("email").notNull(), phone: text("phone"), message: text("message").notNull(), source: text("source").notNull(), status: leadStatus("status").default("new").notNull(),
  unitIds: jsonb("unit_ids").$type<string[]>().default([]).notNull(), assignedAgentId: uuid("assigned_agent_id").references(() => users.id, { onDelete: "restrict" }), assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "restrict" }), followUpAt: timestamp("follow_up_at", { withTimezone: true }),
  privacyVersion: text("privacy_version").notNull(), consentAt: timestamp("consent_at", { withTimezone: true }).notNull(), marketingConsent: boolean("marketing_consent").default(false).notNull(), contactPreference: text("contact_preference").default("email").notNull(), revision: integer("revision").default(1).notNull(), ...timestamps,
}, t => [index("sales_leads_project_followup_idx").on(t.projectId, t.followUpAt), index("sales_leads_agent_idx").on(t.assignedAgentId), index("sales_leads_staff_idx").on(t.assignedStaffId)]);
export const salesEvents = pgTable("sales_events", {
  scopeKey: text("scope_key").default("real").notNull(),
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }), unitId: uuid("unit_id").references(() => salesUnits.id, { onDelete: "restrict" }), leadId: uuid("lead_id").references(() => salesLeads.id, { onDelete: "restrict" }), publicationId: uuid("publication_id").references(() => salesPublications.id, { onDelete: "restrict" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }), action: text("action").notNull(), details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("sales_events_project_created_idx").on(t.projectId, t.createdAt), index("sales_events_lead_idx").on(t.leadId)]);
export const salesRateLimits = pgTable("sales_rate_limits", {
  key: text("key").primaryKey(), bucket: integer("bucket").notNull(), count: integer("count").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [index("sales_rate_limits_expiry_idx").on(t.expiresAt)]);

// Internal lifecycle tables. Activation is project scoped; public publication is separate.
export const salesBuyerProfiles = pgTable("sales_buyer_profiles", {
  preferredTypes: jsonb("preferred_types").$type<string[]>().default([]).notNull(),
  scopeKey: text("scope_key").default("real").notNull(),
  leadId: uuid("lead_id")
    .primaryKey()
    .references(() => salesLeads.id, { onDelete: "restrict" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  preferredBedrooms: integer("preferred_bedrooms"),
  budgetMin: numeric("budget_min", { precision: 14, scale: 2 }),
  budgetMax: numeric("budget_max", { precision: 14, scale: 2 }),
  nextAction: text("next_action"),
  revision: integer("revision").default(1).notNull(),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});
export const salesOffers = pgTable("sales_offers", {
  scopeKey: text("scope_key").default("real").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => salesUnits.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => salesLeads.id),
  agentId: uuid("agent_id").references(() => users.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  offeredAt: timestamp("offered_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").default("draft").notNull(),
  conditions: text("conditions"),
  notes: text("notes"),
  documentReference: text("document_reference"),
  revision: integer("revision").default(1).notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});
export const salesReservations = pgTable("sales_reservations", {
  feeAmount: numeric("fee_amount",{precision:14,scale:2}),
  scopeKey: text("scope_key").default("real").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => salesUnits.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => salesLeads.id),
  offerId: uuid("offer_id").references(() => salesOffers.id),
  agentId: uuid("agent_id").references(() => users.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").default("draft").notNull(),
  notes: text("notes"),
  revision: integer("revision").default(1).notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});
export const salesContracts = pgTable("sales_contracts", {
  depositPercentage: numeric("deposit_percentage",{precision:7,scale:4}), depositDueAt: timestamp("deposit_due_at",{withTimezone:true}), financeCondition: text("finance_condition"), otherConditions: text("other_conditions"), unconditionalAt: timestamp("unconditional_at",{withTimezone:true}), solicitorName: text("solicitor_name"), solicitorEmail: text("solicitor_email"), solicitorPhone: text("solicitor_phone"),
  scopeKey: text("scope_key").default("real").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => salesUnits.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => salesLeads.id),
  offerId: uuid("offer_id").references(() => salesOffers.id),
  reservationId: uuid("reservation_id").references(() => salesReservations.id),
  agentId: uuid("agent_id").references(() => users.id),
  status: text("status").default("draft").notNull(),
  contractDate: timestamp("contract_date", { withTimezone: true }),
  contractPrice: numeric("contract_price", { precision: 14, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 14, scale: 2 }),
  depositReceivedAmount: numeric("deposit_received_amount", {
    precision: 14,
    scale: 2,
  }),
  depositReceivedAt: timestamp("deposit_received_at", { withTimezone: true }),
  expectedSettlementAt: timestamp("expected_settlement_at", {
    withTimezone: true,
  }),
  actualSettlementAt: timestamp("actual_settlement_at", { withTimezone: true }),
  settlementReceivedAmount: numeric("settlement_received_amount", {
    precision: 14,
    scale: 2,
  }),
  settlementReceivedAt: timestamp("settlement_received_at", {
    withTimezone: true,
  }),
  documentReference: text("document_reference"),
  receiptReference: text("receipt_reference"),
  notes: text("notes"),
  revision: integer("revision").default(1).notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});
export const salesLifecycleSettings = pgTable("sales_lifecycle_settings", {
  scopeKey: text("scope_key").default("real").notNull(),
  projectId: uuid("project_id").notNull()
    .references(() => projects.id),
  proposedDurationHours: integer("proposed_duration_hours"),
  proposedReservationFee: numeric("proposed_reservation_fee", {
    precision: 14,
    scale: 2,
  }),
  automationEnabled: boolean("automation_enabled").default(false).notNull(),
  notes: text("notes"),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
}, (t)=>[primaryKey({columns:[t.projectId,t.scopeKey]})]);

export const salesWorkspaces=pgTable("sales_workspaces",{id:uuid("id").defaultRandom().primaryKey(),projectId:uuid("project_id").notNull().references(()=>projects.id),scopeKey:text("scope_key").notNull(),kind:text("kind").notNull(),name:text("name").notNull(),createdByUserId:uuid("created_by_user_id").references(()=>users.id),...timestamps},t=>[uniqueIndex("sales_workspaces_project_scope_unique").on(t.projectId,t.scopeKey)]);
export const salesDemoUnitState=pgTable("sales_demo_unit_state",{projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").notNull(),unitId:uuid("unit_id").notNull(),status:salesStatus("status").notNull(),revision:integer("revision").notNull(),contractPrice:numeric("contract_price",{precision:14,scale:2}),depositAmount:numeric("deposit_amount",{precision:14,scale:2}),...timestamps},t=>[primaryKey({columns:[t.projectId,t.scopeKey,t.unitId]})]);
export const salesAgents=pgTable("sales_agents",{id:uuid("id").defaultRandom().primaryKey(),projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),userId:uuid("user_id").notNull().references(()=>users.id),displayName:text("display_name").notNull(),company:text("company"),email:text("email"),phone:text("phone"),notes:text("notes"),revision:integer("revision").default(1).notNull(),updatedByUserId:uuid("updated_by_user_id").notNull().references(()=>users.id),...timestamps},t=>[uniqueIndex("sales_agent_scope_user_unique").on(t.projectId,t.scopeKey,t.userId)]);
export const salesCommissionAgreements=pgTable("sales_commission_agreements",{id:uuid("id").defaultRandom().primaryKey(),projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),agentId:uuid("agent_id").notNull(),kind:text("kind").notNull(),rate:numeric("rate",{precision:7,scale:4}),fixedAmount:numeric("fixed_amount",{precision:14,scale:2}),gstTreatment:text("gst_treatment").notNull(),gstRate:numeric("gst_rate",{precision:7,scale:4}),payableMilestone:text("payable_milestone").default("manual").notNull(),documentReference:text("document_reference"),notes:text("notes"),revision:integer("revision").default(1).notNull(),updatedByUserId:uuid("updated_by_user_id").notNull().references(()=>users.id),...timestamps});
export const salesCommissions=pgTable("sales_commissions",{id:uuid("id").defaultRandom().primaryKey(),projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),agentId:uuid("agent_id").notNull(),agreementId:uuid("agreement_id").notNull(),contractId:uuid("contract_id").notNull(),estimatedAmount:numeric("estimated_amount",{precision:14,scale:2}).notNull(),gstAmount:numeric("gst_amount",{precision:14,scale:2}),approvedAmount:numeric("approved_amount",{precision:14,scale:2}),paidAmount:numeric("paid_amount",{precision:14,scale:2}),paidAt:timestamp("paid_at",{withTimezone:true}),paymentReference:text("payment_reference"),status:text("status").default("estimated").notNull(),basis:jsonb("basis").$type<Record<string,unknown>>().notNull(),revision:integer("revision").default(1).notNull(),updatedByUserId:uuid("updated_by_user_id").notNull().references(()=>users.id),...timestamps});
export const salesCashEntries=pgTable("sales_cash_entries",{id:uuid("id").defaultRandom().primaryKey(),projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),contractId:uuid("contract_id").notNull(),category:text("category").notNull(),amount:numeric("amount",{precision:14,scale:2}).notNull(),receivedAt:timestamp("received_at",{withTimezone:true}).notNull(),reference:text("reference").notNull(),reason:text("reason").notNull(),actorUserId:uuid("actor_user_id").notNull().references(()=>users.id),createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()});
export const salesReleasePlans=pgTable("sales_release_plans",{projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),stageId:uuid("stage_id").notNull(),plannedAt:timestamp("planned_at",{withTimezone:true}),targetUnits:integer("target_units"),targetValue:numeric("target_value",{precision:14,scale:2}),pricingNote:text("pricing_note"),revision:integer("revision").default(1).notNull(),updatedByUserId:uuid("updated_by_user_id").notNull().references(()=>users.id),...timestamps},t=>[primaryKey({columns:[t.projectId,t.scopeKey,t.stageId]})]);
export const salesTaskStates=pgTable("sales_task_states",{projectId:uuid("project_id").notNull(),scopeKey:text("scope_key").default("real").notNull(),userId:uuid("user_id").notNull().references(()=>users.id),taskKey:text("task_key").notNull(),snoozedUntil:timestamp("snoozed_until",{withTimezone:true}),completedAt:timestamp("completed_at",{withTimezone:true}),...timestamps},t=>[primaryKey({columns:[t.projectId,t.scopeKey,t.userId,t.taskKey]})]);

// Residence-specific media: one canonical unit FK, versioned per floor and slot.
export const salesResidenceMedia = pgTable('sales_residence_media', {
 id:uuid('id').defaultRandom().primaryKey(),projectId:uuid('project_id').notNull(),scopeKey:text('scope_key').default('real').notNull(),unitId:uuid('unit_id').notNull(),floorId:text('floor_id').notNull(),floorLabel:text('floor_label').notNull(),slot:text('slot').notNull(),kind:text('kind').notNull(),versionNumber:integer('version_number').notNull(),title:text('title').notNull(),url:text('url').notNull(),mime:text('mime').notNull(),sha256:text('sha256').notNull(),bytes:integer('bytes'),sourceRevision:text('source_revision').notNull(),sourceDocument:text('source_document').notNull(),sourceFloorId:text('source_floor_id'),previousId:uuid('previous_id'),changeStatus:text('change_status').notNull(),comparisonEvidence:text('comparison_evidence'),status:text('status').default('draft').notNull(),synthetic:boolean('synthetic').default(false).notNull(),revision:integer('revision').default(1).notNull(),reviewedByUserId:uuid('reviewed_by_user_id').references(()=>users.id),approvedByUserId:uuid('approved_by_user_id').references(()=>users.id),reviewedAt:timestamp('reviewed_at',{withTimezone:true}),approvedAt:timestamp('approved_at',{withTimezone:true}),approvalEvidence:text('approval_evidence'),createdByUserId:uuid('created_by_user_id').notNull().references(()=>users.id),...timestamps,
},t=>[uniqueIndex('sales_media_slot_version_unique').on(t.projectId,t.scopeKey,t.unitId,t.floorId,t.slot,t.versionNumber)]);
export const salesResidenceMediaCurrent=pgTable('sales_residence_media_current',{
 projectId:uuid('project_id').notNull(),scopeKey:text('scope_key').default('real').notNull(),unitId:uuid('unit_id').notNull(),floorId:text('floor_id').notNull(),slot:text('slot').notNull(),mediaId:uuid('media_id').notNull(),revision:integer('revision').default(1).notNull(),publishedByUserId:uuid('published_by_user_id').notNull().references(()=>users.id),...timestamps,
},t=>[primaryKey({columns:[t.projectId,t.scopeKey,t.unitId,t.floorId,t.slot]})]);
