# Sales Management V2 — 31 October 2026

Focused enhancement to the existing `/portal/sales` inventory workflow. No schema migration, production data mutation, reimport, publishing action or Golfview website/Explorer change is part of this release.

## Inventory table

Columns: Residence, Status, Release Stage, Type, Beds, Baths, Cars, Building Area, Land Area, Advertising Price, Internal Price, Contract Price, Tags, Publication, Open, Actions. The two confidential price columns exist only with `prices.view`; the server also excludes their records for users without that permission.

Building area is visually emphasised and independent of land area. Missing values are `—`; a genuine recorded zero remains zero. All recorded areas display m². Advertising price shows the proposed draft amount and its inclusion flag, with the current live price separately when a listing is actually published. Internal asking price and agreed contract price use their existing separate confidential fields. No contract value is inferred from asking price.

Every meaningful data header is a keyboard-operable sort button with `aria-sort` and an active direction indicator. Residence/type use natural ordering; status uses the existing business lifecycle; releases use stage sequence; room counts use integers; areas/prices use exact decimal comparison. Missing values remain last in both directions. Equal values use ascending residence number then ID as stable tie-breakers. Sorting copies the filtered list and never mutates or persists inventory records. Publication/media/action columns are not advertised as sortable. Search, filters and canonical map selection continue to use the same records.

## Functional Open and Actions

Open immediately shows a modal residence detail view and highlights the same unit on the linked map. It includes permitted fields/prices, approved media/plan links or explicit empty states, source warnings, features, internal notes, publication status, CRM links and activity access. The modal supports Escape, focus containment, explicit close, trigger-focus restoration and mobile sizing. Existing edit forms were extracted without changing mutation services; their status/pricing sections can be opened directly. Operation feedback is visible inside the modal.

Actions uses a native top-layer popover so it is not clipped by the horizontally scrolling table. Menu entries follow permissions and valid status transitions. Keyboard arrows, Home/End, Escape, outside dismissal and focus restoration are supported. Edit Residence, Change Sales Status, Manage Pricing, View Activity and View CRM Leads open the corresponding working section. Linked leads open the actual record in the existing CRM workspace. No direct publishing operation was added.

Activity now uses the existing authenticated server-action channel with a dedicated project/record-scoped read. It requires `audit.view`, checks that the unit belongs to the project, excludes CRM events, and returns the latest 200 residence events. The UI cancels stale reads when switching residence/view. This read never revalidates or writes inventory. Server-side mutation RBAC, revision protection, audit logs and the Unit 1 DESIGN CONFLICT publication restriction remain intact.

## Verification

Results and screenshots in `sales-v2-verification/` are from isolated synthetic component fixtures, clearly labelled on the screenshots; they do not show genuine contract transactions. Service tests use PGlite, not Production. Tests cover all sorts, separate prices, nulls, filters, functional modal/menu actions, CRM navigation, permissions, map/save synchronisation, mobile scrolling/touch and existing import/project workflows. Confidential contract values are tested absent from ordinary exports and public snapshots. Production preservation is verified separately by read-only counts and a before/after hash of all 47 unit records plus their private price rows and publication records.

Authenticated live browser acceptance remains pending under the existing access constraints; no share links, credentials or bypass were created. Activity is limited to the latest 200 events per residence. No new source assets were supplied, so existing approved media references and intentional empty states remain in use.
