# 11 — Future Roadmap & Phased Implementation Plan

## 11.1 Future Roadmap (Architected For, Not Built in v1)

| Feature | Why the v1 architecture already supports it |
|---|---|
| AI Template Generator / AI Document Builder | Template is just validated JSON — an AI step can propose `layoutJson` and run it through the exact same Zod validation + preview pipeline a human designer uses |
| AI OCR / AI Field Detection / AI Auto Mapping | Slots into the Data Import flow ([06 §6.3](06-flows.md)) as an alternative column-mapping suggester, same downstream validation and bulk-generate path |
| AI PDF Comparison | Built on the existing version-compare diff engine ([06 §6.4](06-flows.md)), extended to compare rendered output, not just layout JSON |
| Electronic Signature Integration | `signature` element already exists as a placeholder/image type ([04 §4.4](04-template-json-schema.md)); a signing-ceremony provider plugs in as a new async step before document generation, writing the resulting signature image into the `dataPayload` |
| Cloud Storage (customer-provided buckets) | Object storage layer is already provider-abstracted (S3-compatible interface); adding per-org bucket credentials is a config addition, not a rearchitecture |
| Workflow Automation / Approval System | `documents.status` enum is already extensible (`draft → generating → generated/failed`); inserting `pending_approval` states and an approvals collection is additive |
| Public Document APIs / Webhooks / Zapier | The REST API is already the platform's only interface (no server-rendered pages) — exposing scoped API keys + outbound webhook events on `document.generate`/`template.publish` is additive, not a redesign |
| Template Marketplace | Export/import bundle format ([05 §5.6](05-api-design.md)) is the marketplace transport format already; adding a public listing + install flow is additive UI/API on top of existing import |
| White-label SaaS / Multi-Tenant theming | Org-level branding (logo, colors, fonts, footer/header defaults) is already first-class in the schema ([03 §3.2.3](03-database-design.md)); subdomain-per-org routing via the existing `slug` field is additive |
| True multi-device session management | Documented v1 limitation ([10 §10.1](10-edge-cases.md)) — migrating single refresh-token-hash-per-user to a `sessions` collection is a additive schema change, not a breaking one |
| Multi-level/nested organizations | Documented v1 limitation ([10 §10.7](10-edge-cases.md)) — would require a `parentOrganizationId` field and recursive scoping rules; deferred because no current requirement justifies the complexity |

## 11.2 Phased Implementation Plan

Each phase ships fully functional, integrated, demoable software — no phase produces dead code waiting on a later phase.

### Phase 1 — Foundation
- Repo scaffolding (`client/`, `server/`, `shared/`, `docs/`), ESLint/Prettier/Husky, Docker Compose skeleton (Mongo, Redis, MinIO)
- Auth module end-to-end: register, login, refresh, forgot/reset password, JWT + RBAC middleware, 4 system roles seeded
- Organizations + Users CRUD (Admin-only initially)
- Health checks, Winston logging, Swagger skeleton
- **Exit criteria:** can register an org, log in, see an empty authenticated dashboard shell, RBAC denies non-admins correctly

### Phase 2 — Core Data Entities
- Customers CRUD, Assets upload pipeline (Sharp/fontkit validation), Settings (theme/locale/currency/paper size)
- Global search + filters across implemented entities
- Audit log infrastructure wired into every mutation from Phase 1 & 2
- **Exit criteria:** full CRUD + audit trail for customers/assets/settings, visible in UI with proper RBAC

### Phase 3 — Rendering Engine (headless, no UI yet)
- `engine/` package: Resolver, Layout/pagination engine, PDF-lib draw pass, font/asset embedding
- Element renderers: text, staticText, dynamicField, date, currency, image, divider/line/rectangle/circle, qrcode, barcode, signature
- Table Engine: pagination, header repeat, running/grand totals, empty state
- Unit test suite (deterministic snapshot tests per [09 §9.7](09-nfr-deployment-cicd.md))
- **Exit criteria:** `render(layoutJson, dataContext, assets) -> PDF buffer` works correctly for every element type and table edge case in [10](10-edge-cases.md), fully covered by tests, callable from a CLI script with no API yet

### Phase 4 — Templates API + Designer UI
- Templates + Template Versions API (CRUD, publish, duplicate, export/import, compare, restore)
- Field Definitions API (system + custom fields)
- Visual Template Designer: canvas, drag/position/resize, property panel per element type, element palette
- Live Preview wired to the Phase 3 engine via the `/templates/:id/preview` fast-path
- **Exit criteria:** an admin can build, preview, and publish a real Invoice template through the UI with zero backend code changes

### Phase 5 — Document Generation
- Documents API: create (sync/async split), regenerate, delete, pdf retrieval via signed URLs
- BullMQ render worker, queue wiring, idempotent job handling
- Auto-generated data-entry form driven by `template.fields[]`
- Data Import (CSV/Excel/JSON) with mapping UI + bulk-generate + batch status polling
- **Exit criteria:** end-to-end flow — pick template, enter or import data, generate, download — works for both single and bulk paths, all import edge cases from [10 §10.6](10-edge-cases.md) handled

### Phase 6 — Dashboard, Notifications, Polish
- Dashboard KPI cards, charts, recent activity, storage usage
- Notifications (toast, in-app, email worker)
- Dark mode, skeleton loaders, empty states, animations (Framer Motion)
- Full Swagger documentation, OpenAPI examples for every endpoint
- **Exit criteria:** platform feels complete end-to-end for a real admin/editor user, not just functionally correct

### Phase 7 — Production Hardening
- Full security middleware stack ([08](08-security.md)), rate limiting tuned per route class
- CI/CD pipeline (lint/typecheck/test/build/deploy stages), staging + prod Docker images
- Load testing against scalability targets ([09 §9.1–9.2](09-nfr-deployment-cicd.md)), worker autoscaling validated
- Observability: metrics, health probes, alert thresholds wired to a real dashboard
- **Exit criteria:** platform passes load test targets, security checklist, and a full E2E Playwright suite in CI; ready for real production traffic

Each phase's summary-and-remaining-tasks checkpoint (as required by the original brief) happens at the **Exit criteria** line — implementation should not proceed to the next phase until that line is demonstrably true.
