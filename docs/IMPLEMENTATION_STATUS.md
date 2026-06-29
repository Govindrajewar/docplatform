# Implementation Status

> Source of truth for "where is this project right now." Read this before starting any new work — see `docs/PRD/` for the full spec and `docs/PRD/11-roadmap-and-phased-plan.md` for the phase plan this tracks against.

---

# Overall Progress

**~48% complete** (3 of 7 roadmap phases fully shipped; Phase 4 about half done — its API half is complete, its Designer UI half has not been started). Phase weighting is uneven — Phase 5 (Document Generation + queue) is still one of the larger remaining phases, so phase-count percentage slightly overstates remaining effort.

---

# Current Phase

**Phase 4 — Templates API + Designer UI, in progress.** The Templates + Field Definitions API (server-side) is complete and tested. The Designer UI (client-side canvas/drag-drop/property panels) has not been started — this is what's left before Phase 4's exit criteria ("an admin can build, preview, and publish a real Invoice template through the UI with zero backend code changes") is met.

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

---

# Current Work

**Phase 4 server-side is done; client-side has not been started.** Landed this session (commit pending):

- `server/src/modules/templates/` — Template + TemplateVersion Mongoose models, repository, service, controller, routes: CRUD, duplicate, export/import bundle, versions (list/save/get/publish/restore/compare), preview.
- `server/src/modules/field-definitions/` — merges hardcoded `SYSTEM_FIELDS` (shared/constants) with org-scoped custom fields; create/update/delete, delete-guard when a field is referenced by any published template.
- `POST /templates/:id/preview` calls the Phase 3 `engine/render.ts` directly (in-process, not queued, nothing persisted) — `server/src/modules/templates/asset-references.ts` resolves literal and token-based asset references into the engine's `AssetMap`.
- Optimistic-concurrency version save (`baseVersionNumber` → 409 `STALE_VERSION` on a stale save) and publish-time broken-asset-reference validation (422 listing missing asset ids), both per PRD 10 §10.3.
- Duplicate-element-id validation added to `templateDocumentSchema` itself (`shared/src/schemas/template/document.schema.ts`) via `superRefine`, so every caller (save, import, restore) gets the PRD 10 §10.3 check for free.
- 12 new integration tests (`server/tests/integration/templates.test.ts`, `field-definitions.test.ts`) — full suite is 128/128 passing.

**Deliberate deviations from the PRD's literal schema, made while implementing (see also Technical Debt below):**

- `templates.status` enum (`draft/published/archived`) subsumes the PRD's separate `isArchived` boolean (PRD 03 §3.2.5) — kept one field instead of two redundant ones.
- `template_versions.organizationId` was added even though the PRD's field table for that collection omits it — added so every version query can be tenant-scoped directly, consistent with the multi-tenancy rule the PRD states elsewhere (03 §3.3).
- `documentType` is validated as a free-form string, not a fixed enum, to preserve the "zero-code document onboarding" goal (PRD 01 §1.2) — a hard enum would mean a new document type needs a code change.
- Field Definitions reuses the `templates:read`/`templates:write` permissions rather than a new RBAC resource, since PRD 07 §7.1's permission table has no dedicated `field-definitions` resource and the API sits right under Templates in PRD 05.

**Not yet done in Phase 4:**

- [ ] `client/src/features/templates/designer/` — canvas, drag/position/resize, element palette, property panel per element type
- [ ] Live preview pane (pdf.js) wired to the preview endpoint, debounced per [PRD 06 §6.5](PRD/06-flows.md)
- [ ] `client/src/pages/TemplatesPage.tsx` (list/CRUD chrome) + designer route

---

# Remaining Tasks

## Phase 4 — Designer UI (server-side API is done — see Current Work above)

- [ ] `client/src/features/templates/designer/` — canvas, drag/position/resize, element palette, property panel per element type
- [ ] Live preview pane (pdf.js) wired to the preview endpoint, debounced per [PRD 06 §6.5](PRD/06-flows.md)
- [ ] `client/src/pages/TemplatesPage.tsx` (list/CRUD chrome) + designer route

## Phase 5 — Document Generation (not started)

- [ ] Install `bullmq` (not in `server/package.json` yet) + `server/src/workers/` render worker
- [ ] `server/src/modules/documents/` — create (sync/async split by complexity estimate), regenerate, delete, signed-URL PDF retrieval
- [ ] Install `csv-parse`/`exceljs` (or `xlsx`) — none currently installed — for CSV/Excel/JSON import
- [ ] Auto-generated data-entry form driven by `template.fields[]` (client)
- [ ] Import mapping UI + bulk-generate + batch status polling

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
2. **Redis is connected but unused** — `ioredis` is wired in `server/src/config/redis.ts` but nothing consumes it yet (no queue, no rate-limit store, no session cache), despite [PRD 09](PRD/09-nfr-deployment-cicd.md) specifying Redis-backed sliding-window rate limiting. This becomes a real gap starting Phase 5 (queue) but is also relevant to the rate-limiting NFR which Phase 1–3 haven't implemented either.
3. **S3 storage driver throws on use** (`server/src/storage/index.ts:11`) — intentional Phase 7 placeholder, not a bug, but worth flagging so nobody sets `STORAGE_DRIVER=s3` in any deployed env before Phase 7.

---

# Technical Debt

- No Docker Compose / Dockerfiles at all yet — local dev currently depends on cloud-hosted MongoDB Atlas + Upstash Redis per `README.md`, which works for solo dev but diverges from the PRD's documented Docker-first NFR story ([PRD 09](PRD/09-nfr-deployment-cicd.md)). Likely fine to defer to Phase 7 as planned, but flagging so it isn't forgotten.
- No CI pipeline — lint/typecheck/test only run locally (via Husky pre-commit/pre-push hooks), nothing enforced on push/PR yet.
- Rate limiting middleware (`server/src/middleware/rate-limit.ts`) exists from Phase 1 but should be revisited once Redis is actually load-bearing (Phase 5) to confirm it's using a sliding-window Redis store rather than in-memory, per [PRD 05 §5.14](PRD/05-api-design.md).

---

# Blockers

None. The codebase is in a clean, fully-tested state with no partial work in progress. Phase 4 can start immediately.

---

# Next Recommended Task

**Build the Designer UI client-side** (`client/src/features/templates/designer/`) against the now-complete Templates API: canvas + element palette + drag/position/resize + property panel per element type, wired to `POST /templates/:id/preview` (debounced, per PRD 06 §6.5) for live pdf.js preview, plus the surrounding `TemplatesPage.tsx` list/CRUD chrome and version-history/compare/restore UI. This is the only piece left before Phase 4's exit criteria is met.

---

# Last Updated

2026-06-29 — added the Phase 4 Templates + Field Definitions API (server-side); see `docs/SESSION_LOG.md` for this session's entry.
