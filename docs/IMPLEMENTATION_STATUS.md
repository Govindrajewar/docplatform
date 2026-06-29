# Implementation Status

> Source of truth for "where is this project right now." Read this before starting any new work — see `docs/PRD/` for the full spec and `docs/PRD/11-roadmap-and-phased-plan.md` for the phase plan this tracks against.

---

# Overall Progress

**~70% complete** (5 of 7 roadmap phases fully shipped). Phase 5 (Document Generation) is now fully done, server and client. Phase 6 (Dashboard, Notifications, Polish) has not been started.

---

# Current Phase

**Between Phase 5 and Phase 6.** Phase 5 (Document Generation) is complete end-to-end: single-document generation (sync fast-path + async BullMQ worker, regenerate, soft-delete, PDF retrieval), data import/bulk-generate (CSV/Excel/JSON parsing, column-mapping suggestion, per-row validation, batch tracking), and now the client UI for all of it (an auto-generated data-entry form, an import/mapping wizard, live batch-progress polling, and a Documents list page) — verified live in a browser with a real BullMQ worker actually consuming the queue, not just mocked. Phase 6 has not been started.

---

# Completed Phases

### Phase 1 — Foundation ✅

Commit `9e7d5ae` (2026-06-26). Repo scaffolding, ESLint/Prettier/Husky/commitlint, JWT auth (register/login/refresh/forgot/reset), RBAC middleware, 4 system roles seeded, Organizations + Users CRUD, health checks, Winston logging, Swagger skeleton.

### Phase 2 — Core Data Entities ✅

Commit `dc6aaec` (2026-06-27). Customers CRUD, Assets upload pipeline (Sharp image normalization + fontkit font validation + SVG sanitization + checksum dedup), Settings (theme/locale/currency/paper size), global search, audit-log middleware wired into every Phase 1–2 mutation.

### Phase 3 — Rendering Engine ✅

Commit `4eec34e` (2026-06-27). Headless `render(template, data, assets)` as Resolver → Layout → Draw pipeline:

- `server/src/engine/resolver/` — token resolution, safe (non-`eval`) `visibleIf` expression evaluator, table data resolution
- `server/src/engine/layout/` — text measurement, section flow, table pagination across pages, page geometry
- `server/src/engine/draw/` — pdf-lib draw pass covering all 15 element types + table engine (header repeat, running/grand totals, alternating rows, empty state)
- `server/src/engine/fonts/` — font registry/embedding
- CLI script (`server/src/scripts/render-template.ts`) renders template+data to PDF with no API involved
- Exit criteria from the PRD (render works for every element type and every Section 10 edge case, fully covered by tests, callable headlessly) is met — verified by running the suite: **116/116 tests passing across 12 files** (5 integration, 7 unit).

**Note on phase boundary:** Phase 2's "Exit Criteria" (full CRUD + audit trail for customers/assets/settings, visible in UI with RBAC) is functionally met server-side and in the client pages.

### Phase 4 — Templates API + Designer UI ✅

Server-side (`server/src/modules/templates/`, `field-definitions/`): Template + TemplateVersion models, full CRUD, duplicate, export/import bundle, versions (save with optimistic-concurrency `STALE_VERSION` conflict detection, publish with broken-literal-asset-reference validation, restore/rollback, structural compare), and a fast-path preview wired directly to the Phase 3 engine. Field Definitions merges hardcoded system fields with org-scoped custom fields, with a delete-guard against fields referenced by published templates. 12 integration tests; full server suite 128/128 passing.

Client-side (`client/src/features/templates/`, `client/src/pages/TemplatesPage.tsx`, `TemplateDesignerPage.tsx`): a `TemplatesPage` (list/create/duplicate/archive/export/import), and a `TemplateDesignerPage` with three tabs — **Design** (canvas rendering header/footer/sections at 1pt=1px, pointer-event-based drag-to-move and corner-handle resize, a 14-type element palette, and a property panel with common fields plus type-specific controls for text/dynamicField/image/qrcode/barcode/rectangle/circle/table/checkbox/divider), **Preview** (sample-data JSON input → calls the real preview endpoint → renders the returned PDF via `pdfjs-dist` onto a `<canvas>`, with page navigation), and **History** (version list, publish, restore, a simple two-version compare). State lives in a zustand `designer.store.ts` (the draft `TemplateDocument`, selection, dirty flag) edited via small, targeted mutation actions rather than a generic deep-merge.

**Verified live in a browser** (no project skill existed for this, so one was improvised — see Technical Debt): an ephemeral `mongodb-memory-server` + the real Express app + the real Vite dev server, driven with Playwright (installed to a scratch temp dir, not added to the repo). Confirmed: register → create template → add/drag/edit elements → save draft (v1→v2) → live preview renders actual PDF content → publish → version history shows both versions correctly.

**Bug found and fixed during that verification:** `usePublishTemplateVersion`/`useRestoreTemplateVersion` (`client/src/features/templates/api.ts`) only invalidated the `['templates', templateId]` TanStack Query cache branch, not the sibling `['templates', page, limit, filters]` list-query branch — so the Templates list page kept showing "draft" for up to `staleTime` (30s) after a publish. Fixed by invalidating the broader `['templates']` key, matching the convention already used by create/update/archive/duplicate.

**Deliberate deviations from the PRD's literal schema, made while implementing:**

- `templates.status` enum (`draft/published/archived`) subsumes the PRD's separate `isArchived` boolean (PRD 03 §3.2.5) — kept one field instead of two redundant ones.
- `template_versions.organizationId` was added even though the PRD's field table for that collection omits it — added so every version query can be tenant-scoped directly, consistent with the multi-tenancy rule the PRD states elsewhere (03 §3.3).
- `documentType` is validated as a free-form string, not a fixed enum, to preserve the "zero-code document onboarding" goal (PRD 01 §1.2) — a hard enum would mean a new document type needs a code change.
- Field Definitions reuses the `templates:read`/`templates:write` permissions rather than a new RBAC resource, since PRD 07 §7.1's permission table has no dedicated `field-definitions` resource and the API sits right under Templates in PRD 05.
- The Designer's property panel gives full type-specific controls to the most common ~10 element types; `table` columns are edited as raw JSON (no visual column builder yet) — a scoped, documented simplification rather than building a bespoke column editor in this pass.

### Phase 5a — Single-Document Generation ✅ (Phase 5 partial — see Remaining Tasks for Phase 5b)

Server-side (`server/src/modules/documents/`, `server/src/queues/`, `server/src/workers/`): `Document` + `GeneratedPdf` models, a single `renderDocument(documentId)` function shared by both the synchronous fast-path (awaited inline on create/regenerate) and the BullMQ worker, with the split decided by a row-counting complexity heuristic (`complexity.ts`, >200 rows routes to the async queue). Full CRUD-ish surface: create (validates the template is published, pins `templateVersionId`), get, list (with templateId/customerId/status filters), regenerate (re-renders against the pinned version), soft-delete, and PDF retrieval (`409 NOT_READY` while generating, `409 CONFLICT` with the failure reason if rendering failed). The BullMQ queue (`render.queue.ts`) is a lazily-constructed singleton, only ever touched once a document crosses the async threshold, so the existing small-payload test suite never instantiates Redis/BullMQ at all; the worker (`workers/index.ts`, `npm run worker`) is a separate process entrypoint never imported by `app.ts`. 8 new integration tests; full server suite 136/136 passing.

**Two real bugs found and fixed while writing tests (not by inspection):**

- **`GeneratedPdfModel.documentId` unique-index conflict on regenerate** — `renderDocument` always called `GeneratedPdfModel.create(...)`, so a second render of the same document (via `/regenerate`) hit a duplicate-key error, silently caught by the render try/catch and surfaced as a generic `status: 'failed'`. Fixed by upserting (`findOneAndUpdate` with `upsert: true`) instead of always creating.
- **Mongoose `minimize: true` (the default) strips an empty `dataPayload: {}` to `undefined` before the `required` validator runs** — a fully static template with no dynamic fields legitimately has an empty data payload, but document creation failed with `INTERNAL_ERROR` every time. Fixed by setting `minimize: false` on the `Document` schema.
- (Build-time, not test-time) **`bullmq`'s bundled `ioredis` is a structurally distinct nominal type from the root-level `ioredis` install** (duplicate versions resolved by npm), so passing a constructed `IORedis` instance as BullMQ's `connection` option failed to typecheck. Fixed by passing a plain `RedisOptions` object (parsed from `REDIS_URL` in `queues/redis-connection.ts`) instead of an instantiated client — BullMQ constructs its own client internally from its own bundled copy.

### Phase 5b — Data Import + Bulk Generate ✅ (server-side; client UI remains)

Server-side (`server/src/modules/documents/`): `import-parsing.ts` (CSV via `csv-parse`, XLSX via `exceljs` with a fill-left header-merge heuristic, JSON with single-object-to-array wrapping) and `suggestColumnMapping` (normalized header/label/key match + a small synonym table) power `POST /documents/import` — a stateless multipart-upload preview against a template's _current published version_ `fields[]` (not the global field-definitions list, matching PRD 06 §6.2's "form auto-built from `template.fields[]`"). `row-validation.ts` type-coerces and validates an already-mapped row (number/currency/date/boolean coercion, required-field and regex-pattern checks) and nests it into the dot-path `dataPayload` shape the rendering engine expects (`path.ts`'s `setByPath`, mirroring `engine/resolver/tokens.ts`'s `getByPath`). `POST /documents/bulk-generate` validates every row independently — bad rows are reported, not fatal to the batch (PRD 10 §10.6) — optionally links each row to an existing `customerId`, creates a `GenerationBatch` tracking row, creates one `Document` per accepted row (tagged with `batchId`/`batchRowIndex`), and always enqueues via BullMQ (bulk never uses the sync fast-path, so a large batch can't block the request). `render-document.ts` now reports each document's outcome back to its batch (`$inc` completed/failed counters, `$push` a `{row, reason}` failure entry) so `GET /documents/batches/:batchId` reflects live progress without polling every document. 5 new integration tests; full server suite **141/141 passing**.

**Deliberate scoping decision:** "Customer referenced in import data doesn't exist yet" (PRD 10 §10.6) only implements the _reject_ branch (a row with an unknown `customerId` fails with a clear per-row reason) — the _auto-create-customer-from-inline-data_ branch is not implemented. The PRD itself frames this as "an explicit checkbox in the mapping UI," which doesn't exist yet in this backend-only pass; building real fuzzy name/email matching for auto-create is its own scoped piece of work, tracked in Technical Debt rather than guessed at here.

### Phase 5c — Generation UI ✅ (completes Phase 5)

Client-side (`client/src/features/documents/`, `client/src/pages/TemplateGeneratePage.tsx`, `DocumentsPage.tsx`): a `TemplateGeneratePage` (linked from each published template's row on `TemplatesPage` via a new "Generate" action) with two flows — **Generate one document** (a form auto-built from the template's _published_ version `fields[]`, fetched via a new `useTemplateVersion` hook rather than `useTemplate`'s `latestVersion`, since generation validates against `currentVersionId` specifically, which can differ from the newest draft) with per-type inputs and client-side required-field checking before submit, and **Bulk import** (file picker → `POST /documents/import` preview → an editable column-mapping table pre-filled from the server's suggested mapping → confirm → `POST /documents/bulk-generate` → a live batch-progress panel polling `GET /documents/batches/:batchId` until every row resolves, surfacing per-row failure reasons). A new `DocumentsPage` lists every document org-wide (template name resolved client-side from `useTemplates`, status, failure reason inline, download/regenerate/delete), auto-polling while anything is `generating`.

**Verified live in a browser**, including the previously test-only async path actually working end-to-end: an ephemeral `mongodb-memory-server` + a local `redis-server.exe` on a scratch port (not the project's real Redis) + the real Express app + a real BullMQ worker process (`createRenderWorker()`, the same code `npm run worker` runs) + the real Vite dev server, driven with Playwright. Confirmed: register → create+publish a template with two fields via direct API calls (the Designer has no fields[] editor yet — a pre-existing, already-documented simplification) → generate page renders the right inputs → single-document generate succeeds synchronously → CSV upload previews and auto-maps both columns correctly → confirming bulk-generate enqueues 3 jobs → the real worker drains the queue → batch progress reaches 3/3 generated, 0 failed → Documents page lists all 4 documents as generated → download opens a real PDF blob, regenerate re-renders, delete empties the list.

**Bug found during verification (test-script-side, not app-side):** the verification script's own Playwright selector strategy was ambiguous (matched 3 elements instead of 1) — not a product bug, just a reminder that `<option>` text content inside a `<select>` counts toward Playwright's `hasText` filter even when unselected.

**Real, separate bug found and fixed during this same cleanup pass:** the root `.gitignore`'s `storage/uploads/*` pattern doesn't match the actual storage location `server/storage/uploads/` (a path-with-slash gitignore pattern is anchored to the `.gitignore`'s own directory, not matched at any depth) — meaning real generated PDFs and uploaded assets under `server/storage/uploads/` were never actually excluded from git. Fixed by anchoring the pattern to `server/storage/uploads/*`.

---

# Current Work

Nothing is currently mid-implementation. Phase 5 is fully done (server and client, verified live with a real worker processing real queued jobs) with no partial files or failing tests. The codebase is at a clean phase boundary between Phase 5 and Phase 6.

---

# Remaining Tasks

## Phase 6 — Dashboard, Notifications, Polish (not started)

- [ ] Real KPI cards/charts/recent-activity/storage-usage (current `DashboardPage.tsx` is a 2-card stub)
- [ ] Install `nodemailer` (not present) + email worker
- [ ] In-app/toast notifications, dark mode, skeleton loaders, Framer Motion
- [ ] Full Swagger examples per endpoint

## Phase 7 — Production Hardening (not started)

- [ ] Docker Compose + per-service Dockerfiles (none exist anywhere in the repo)
- [ ] GitHub Actions CI/CD (`.github/workflows/` does not exist)
- [ ] S3 storage driver (`server/src/storage/index.ts` currently throws "not implemented yet — Phase 7" for the `s3` driver; local driver is the only working one)
- [ ] Load testing, observability/metrics, security-checklist pass

---

# Known Issues

1. **Field Definitions has no dedicated RBAC resource** — it reuses `templates:read`/`templates:write` (see Current Work above). Revisit if a role ever needs field-definition access independent of template access.
2. **Redis is now load-bearing only for the render queue, not for rate limiting** — the BullMQ queue (`server/src/queues/render.queue.ts`) is the first real consumer of Redis, but [PRD 09](PRD/09-nfr-deployment-cicd.md)'s Redis-backed sliding-window rate limiting still isn't implemented (`server/src/middleware/rate-limit.ts` predates this and should be revisited — see Technical Debt).
3. **S3 storage driver throws on use** (`server/src/storage/index.ts:11`) — intentional Phase 7 placeholder, not a bug, but worth flagging so nobody sets `STORAGE_DRIVER=s3` in any deployed env before Phase 7.
4. **Root and BullMQ-bundled `ioredis` are two different installed versions** (npm couldn't dedupe them because BullMQ pins an exact version) — harmless at runtime, but means any future code that needs an `IORedis` instance typed against BullMQ's `Queue`/`Worker` connection option must build a plain `RedisOptions` object (see `queues/redis-connection.ts`) rather than constructing its own client, or it won't typecheck.
5. **`POST /documents` (single-document create) does no server-side field coercion/validation** — only `bulk-generate`'s rows go through `validateAndCoerceRow`. The new Generate page does its own required-field check and type coercion client-side before submitting, but a non-UI API caller can still create a document with missing required fields or wrong-typed values; the engine just renders blanks/raw strings rather than rejecting. Pre-existing scope from Phase 5a, just now more visible with a UI in front of it.

---

# Technical Debt

- No Docker Compose / Dockerfiles at all yet — local dev currently depends on cloud-hosted MongoDB Atlas + Upstash Redis per `README.md`, which works for solo dev but diverges from the PRD's documented Docker-first NFR story ([PRD 09](PRD/09-nfr-deployment-cicd.md)). Likely fine to defer to Phase 7 as planned, but flagging so it isn't forgotten.
- No CI pipeline — lint/typecheck/test only run locally (via Husky pre-commit/pre-push hooks), nothing enforced on push/PR yet.
- Rate limiting middleware (`server/src/middleware/rate-limit.ts`) exists from Phase 1 but should be revisited now that Redis is actually load-bearing (the render queue) to confirm it's using a sliding-window Redis store rather than in-memory, per [PRD 05 §5.14](PRD/05-api-design.md).
- No project-level "run/verify this app" skill exists yet — verifying the Designer UI required improvising an ephemeral-Mongo + Playwright setup from scratch in a scratch temp directory. Worth capturing as a real project skill (e.g. via `/run-skill-generator`) before the next UI-heavy phase, so it doesn't need re-deriving.
- The Designer's table-element column editor is raw JSON, not a visual column builder — fine for an admin comfortable with the schema, but worth a real UI before Phase 4 is considered "polished" (tracked here, not blocking Phase 5).
- Regenerating a document leaves its previous PDF blob orphaned in storage (only the `GeneratedPdf` DB row is replaced via upsert, not the old file on disk/S3) — fine for the local driver during development, but worth a cleanup pass (delete-on-replace, or a GC sweep) before Phase 7's storage hardening.
- Bulk-import customer linking only supports an existing `customerId` per row; it rejects rows that reference a customer that doesn't exist yet rather than auto-creating one from inline name/email/phone data — the PRD's other documented branch (10 §10.6), deliberately deferred (see Phase 5b above) since it needs real fuzzy matching and an explicit UI checkbox, not a backend guess.
- `exceljs`'s bundled types resolve `Buffer` against a much older nested `@types/node` (pulled in transitively via its `@fast-csv` dependency), causing a structural-type mismatch at the one call site that loads a workbook (`import-parsing.ts`) — worked around with a narrow cast to whatever `load()` actually declares. Harmless (Buffer is Buffer at runtime), but a reminder that any other exceljs API touching `Buffer` may need the same treatment.
- The Designer UI still has no editor for a template's `fields[]` array (verifying Phase 5c required setting fields via direct API calls, bypassing the Designer entirely, same as the live-verification workaround noted under Phase 4) — anyone using only the UI today has no way to declare a template's fields, which the new Generate page and import mapping both depend on. Worth a real fields-editor pass before Phase 5 is considered "polished" end-to-end, though it doesn't block Phase 6.
- No project-level "run/verify this app" skill exists yet (still true after a second from-scratch improvisation this session, now additionally needing a local Redis instance alongside ephemeral Mongo + Playwright) — increasingly worth capturing via `/run-skill-generator` rather than re-deriving a third time.

---

# Blockers

None. The codebase is in a clean, fully-tested state with no partial work in progress.

---

# Next Recommended Task

**Start Phase 6: Dashboard, Notifications, Polish.** Phase 5 is now fully done end-to-end (server + client, live-verified with a real worker). Phase 6 covers real KPI cards/charts/recent-activity/storage-usage on the Dashboard (currently a 2-card stub), installing `nodemailer` for an email worker, in-app/toast notifications, dark mode, skeleton loaders, and full Swagger examples per endpoint. Consider starting with the Dashboard's real data (it has the most existing data to surface — templates/documents/customers counts, recent activity from audit logs) before the lower-priority polish items (dark mode, animations).

---

# Last Updated

2026-06-29 — completed Phase 5 in full (Phase 5a single-document generation, Phase 5b data import/bulk-generate, Phase 5c the client generation UI), the last verified live in a browser with a real BullMQ worker; see `docs/SESSION_LOG.md` for this session's entry. Phase 6 has not been started.
