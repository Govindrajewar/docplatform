# 01 — Executive Summary & Scope

## 1.1 Executive Summary

The platform is a multi-tenant SaaS system that lets administrators **visually design document templates** (invoices, statements, payslips, certificates, etc.) and lets end users **fill dynamic data into those templates** to generate pixel-perfect PDFs — without any code change per document type.

The system is built around one architectural law:

```
Template (JSON layout) → Data (user input / import) → Rendering Engine → PDF
```

No document type is hardcoded. An "Invoice" and a "Salary Slip" are the *same* rendering engine running two different JSON templates. Adding a new document type is a content operation (create a template), never a code change.

## 1.2 Goals

| Goal | Success Signal |
|---|---|
| Zero-code document onboarding | New document type shipped by creating a template, 0 backend deploys |
| Pixel-perfect, reproducible PDFs | Same template + same data → byte-identical layout every render |
| Designer usable by non-developers | Admin can build a usable invoice template in < 15 minutes |
| Horizontal scale to millions of PDFs | Render throughput scales linearly by adding worker nodes |
| Strict tenant isolation | An organization can never read another organization's data via any API |
| Full auditability | Every state-changing action (create/update/delete/generate/download/permission change) is logged with actor, timestamp, diff |

## 1.3 Non-Goals (Explicitly Out of Scope for v1)

- Real-time multi-user collaborative editing of the same template (single-editor-at-a-time with optimistic locking is in scope; OT/CRDT collab is not)
- A public template marketplace storefront with payments (architecture must *support* it later; no billing/marketplace UI in v1)
- AI template generation / AI OCR / AI field detection (roadmap only, see [11](11-roadmap-and-phased-plan.md))
- Native mobile apps (responsive web only)
- E-signature legal workflows (signature *element* rendering is in scope; signing ceremonies/legal binding are not)

## 1.4 Personas

| Persona | Role | Primary Needs |
|---|---|---|
| Platform Owner | Admin | Full control: users, orgs, templates, settings, logs |
| Ops/Finance Manager | Manager | Manage templates + documents + users within their org, cannot touch platform settings |
| Document Operator | Editor | Generate, save, download documents from existing templates; cannot edit templates |
| Auditor / Read-only Stakeholder | Viewer | Read-only access to documents, templates, dashboards, logs |
| End Customer (indirect) | N/A (data subject) | Appears as data inside generated documents (Customer entity); has no login by default |

## 1.5 In Scope (v1 Feature Set)

- JWT auth (login/register/forgot/reset/refresh) + RBAC (4 roles)
- Dashboard with KPI cards, charts, recent activity
- Template CRUD + visual Template Designer + live preview
- Template versioning (duplicate, restore, compare, rollback, publish/archive)
- Dynamic Field Engine (system fields + unlimited custom fields)
- Table Engine (dynamic columns, pagination, running/grand totals, repeat header)
- PDF Rendering Engine (PDF-lib based, JSON-driven, no per-document-type code)
- Document generation (manual entry, CSV/Excel/JSON import with column mapping)
- Customers & Organizations CRUD, multi-org branding
- Asset management (logos, fonts, icons, signatures)
- Global search + filters
- Audit logs
- Settings (theme, language, timezone, currency, paper size)
- Notifications (toast, email, in-app)
- Swagger API docs, health checks, structured logging
- Docker Compose for local/prod, GitHub Actions CI/CD

## 1.6 Glossary

| Term | Meaning |
|---|---|
| Template | A versioned JSON document describing layout (header/footer/sections/elements) for one document type |
| Template Version | An immutable snapshot of a template at a point in time; templates always reference a "current" version |
| Element | A single positioned, styled node in a template (text, image, table, QR code, etc.) |
| Dynamic Field | A named placeholder (`{{customer.name}}`) resolved against a data context at render time |
| Data Context | The merged object (organization + customer + document fields + table rows) used to resolve a template at render time |
| Rendering Engine | The stateless service that takes (Template Version JSON, Data Context) → PDF bytes |
| Document | A generated instance: a (template version, data, resulting PDF file) tuple, persisted and downloadable |
| Organization (Org) | A tenant-scoped branding/ownership boundary: logo, colors, fonts, footer/header defaults |
| Asset | Any uploaded binary used by templates: logo, icon, font, image, signature |
| Watermark | A semi-transparent text/image layer rendered behind page content |
| Running Total | A table column value accumulated row-by-row within the current page or section |
| Grand Total | A table column value accumulated across all rows in the document |
