# Implementation Status

> Source of truth for "where is this project right now." Read this before starting any new work — see `docs/PRD/` for the full spec and `docs/PRD/11-roadmap-and-phased-plan.md` for the phase plan this tracks against.

---

# Overall Progress

**~55% complete** (4 of 7 roadmap phases fully shipped). Phase weighting is uneven — Phase 5 (Document Generation + queue) is one of the two largest remaining phases, so phase-count percentage slightly overstates remaining effort.

---

# Current Phase

**Between Phase 4 and Phase 5.** Phase 4 (Templates API + Designer UI) is complete, demoed end-to-end in a real browser, and its exit criteria is met: an admin can create a template, design it visually (drag/resize elements, edit properties), save drafts, render a live preview via the real PDF engine, and publish it — with zero backend code changes. Phase 5 (Document Generation) has not been started.

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

---

# Current Work

Nothing is currently mid-implementation. Phase 4 closed out cleanly (server-side + client-side, fully verified live) with no partial files or failing tests. The codebase is at a clean phase boundary.

---

# Remaining Tasks

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
- No project-level "run/verify this app" skill exists yet — verifying the Designer UI required improvising an ephemeral-Mongo + Playwright setup from scratch in a scratch temp directory. Worth capturing as a real project skill (e.g. via `/run-skill-generator`) before the next UI-heavy phase, so it doesn't need re-deriving.
- The Designer's table-element column editor is raw JSON, not a visual column builder — fine for an admin comfortable with the schema, but worth a real UI before Phase 4 is considered "polished" (tracked here, not blocking Phase 5).

---

# Blockers

None. The codebase is in a clean, fully-tested state with no partial work in progress. Phase 4 can start immediately.

---

# Next Recommended Task

**Start Phase 5: Document Generation.** Install `bullmq` and stand up `server/src/workers/` with a render worker consuming Redis-backed jobs; add the `server/src/modules/documents/` module (create with the sync-fast-path/async-queue split per [PRD 06 §6.2](PRD/06-flows.md), regenerate against the pinned `templateVersionId`, signed-URL PDF retrieval); then the data-import path (`csv-parse`/`exceljs`, none installed yet) with column mapping + bulk-generate + batch polling. Land the API + worker + tests first, same sequencing rationale as Phase 4: a queue and a documents API are prerequisites for any generation UI to be demoable against something real.

---

# Last Updated

2026-06-29 — completed Phase 4 (Templates + Field Definitions API, and the Designer UI client-side), verified live in a browser; see `docs/SESSION_LOG.md` for this session's entry.
