# 05 — API Design

All endpoints are prefixed `/api/v1`. All require `Authorization: Bearer <accessToken>` except where marked **Public**. All list endpoints support `?page=&limit=&sort=&q=` and return the [standard envelope](#54-standard-response-envelope). All mutating endpoints are recorded to `audit_logs` (see [07](07-rbac-permissions.md)).

## 5.1 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create org + first admin user (self-serve signup) or invited user completes registration |
| POST | `/auth/login` | Public | Returns access token (body) + refresh token (httpOnly secure cookie) |
| POST | `/auth/refresh` | Refresh cookie | Rotates refresh token, issues new access token |
| POST | `/auth/logout` | Bearer | Revokes current refresh token |
| POST | `/auth/forgot-password` | Public | Always returns 200 regardless of whether email exists (prevents account enumeration) |
| POST | `/auth/reset-password` | Public (token in body) | Consumes one-time reset token |
| GET | `/auth/me` | Bearer | Current user + role + permissions |

## 5.2 Users / Roles

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List users (org-scoped, admin/manager only) |
| POST | `/users` | Invite/create user |
| GET | `/users/:id` | Get user |
| PATCH | `/users/:id` | Update profile, role, status |
| DELETE | `/users/:id` | Soft-delete (status=deleted) |
| GET | `/roles` | List roles + permission sets |
| PATCH | `/roles/:id/permissions` | Admin-only; modifies a custom role's permission list (system roles immutable) |

## 5.3 Organizations

| Method | Path | Description |
|---|---|---|
| GET | `/organizations` | List (super-admin sees all; org users see only their own) |
| POST | `/organizations` | Create (super-admin / self-serve signup flow) |
| GET | `/organizations/:id` | Get details + branding |
| PATCH | `/organizations/:id` | Update branding, defaults |
| DELETE | `/organizations/:id` | Deactivate (soft) |

## 5.4 Standard Response Envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 },
  "error": null
}
```

Error shape:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Human-readable summary", "details": [ { "field": "email", "message": "Invalid email" } ] }
}
```

Error `code` is a stable machine-readable enum (`VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR`) — the frontend branches on `code`, never on `message` text.

## 5.5 Customers

| Method | Path | Description |
|---|---|---|
| GET | `/customers` | List, filterable by `?q=&organizationId=` |
| POST | `/customers` | Create |
| GET | `/customers/:id` | Get |
| PATCH | `/customers/:id` | Update |
| DELETE | `/customers/:id` | Delete (blocked with 409 if referenced by existing documents — soft-delete instead, see [10](10-edge-cases.md)) |

## 5.6 Templates & Versions

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List, filter by `documentType`, `status`, `tags` |
| POST | `/templates` | Create (creates Template + initial draft Version) |
| GET | `/templates/:id` | Get with current version layout |
| PATCH | `/templates/:id` | Update metadata (name, tags, documentType) — **not** layout |
| DELETE | `/templates/:id` | Archive (never hard-deletes a template with existing documents) |
| POST | `/templates/:id/duplicate` | Clone template + its current version into a new draft template |
| POST | `/templates/:id/export` | Returns portable JSON bundle (layout + field defs + asset references) |
| POST | `/templates/import` | Creates a new template from an exported bundle; re-uploads/relinks referenced assets |
| GET | `/templates/:id/versions` | List versions (paginated, newest first) |
| POST | `/templates/:id/versions` | Save new draft version (full `layoutJson`, validated against shared Zod schema) |
| GET | `/templates/:id/versions/:versionId` | Get one version |
| POST | `/templates/:id/versions/:versionId/publish` | Marks published, updates `template.currentVersionId` |
| POST | `/templates/:id/versions/:versionId/restore` | Creates a **new** version copying this one's layout (append-only rule, see [03 §3.2.6](03-database-design.md)) |
| GET | `/templates/:id/versions/compare?from=&to=` | Structural diff (added/removed/modified elements) for the Compare UI |
| POST | `/templates/:id/preview` | Body: `{ versionId?, sampleData }` → returns a rendered preview PDF (sync, fast-path, see [06 §6.2](06-flows.md)) without persisting a `documents` record |

## 5.7 Field Definitions

| Method | Path | Description |
|---|---|---|
| GET | `/field-definitions` | List system + org custom fields |
| POST | `/field-definitions` | Create custom field |
| PATCH | `/field-definitions/:id` | Update label/validation (system fields read-only) |
| DELETE | `/field-definitions/:id` | Delete custom field (blocked with 409 if referenced by any published template) |

## 5.8 Documents

| Method | Path | Description |
|---|---|---|
| GET | `/documents` | List, filter by `templateId`, `customerId`, `status`, date range |
| POST | `/documents` | Create document: `{ templateId, customerId?, dataPayload }` → enqueues render job, returns `{ documentId, status: "generating" }` |
| GET | `/documents/:id` | Get document + status |
| GET | `/documents/:id/pdf` | Streams the generated PDF via a short-lived signed URL redirect (never a raw storage path) |
| POST | `/documents/:id/regenerate` | Re-renders against the same pinned `templateVersionId` and `dataPayload` (e.g. after a rendering-engine bugfix) |
| DELETE | `/documents/:id` | Soft-delete; underlying PDF retained per org retention setting, access revoked |
| POST | `/documents/import` | Multipart upload (CSV/XLSX/JSON) → returns a parsed preview + suggested column mapping (see [06 §6.3](06-flows.md)) |
| POST | `/documents/bulk-generate` | Body: `{ templateId, rows: [...] }` from a confirmed import mapping → enqueues N render jobs, returns a batch id |
| GET | `/documents/batches/:batchId` | Poll bulk-generate progress: `{ total, completed, failed }` |

## 5.9 Assets

| Method | Path | Description |
|---|---|---|
| GET | `/assets` | List, filter by `type` |
| POST | `/assets` | Multipart upload; server validates MIME + magic bytes + size, runs Sharp normalization for images |
| GET | `/assets/:id` | Metadata |
| DELETE | `/assets/:id` | Blocked with 409 if referenced by any template (logo/font) — see [10](10-edge-cases.md) |

## 5.10 Settings

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Org-scoped settings: theme, language, timezone, currency, paper size |
| PATCH | `/settings` | Update (admin/manager only) |

## 5.11 Audit Logs

| Method | Path | Description |
|---|---|---|
| GET | `/audit-logs` | Filter by `actorId`, `entityType`, `entityId`, `action`, date range; admin/manager only |
| GET | `/audit-logs/:id` | Full before/after diff for one entry |

## 5.12 Search

| Method | Path | Description |
|---|---|---|
| GET | `/search?q=&types=templates,customers,documents,organizations` | Federated search across collections, org-scoped, returns grouped results |

## 5.13 System

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness: process up |
| GET | `/health/ready` | Readiness: DB + Redis + object storage reachable |
| GET | `/docs` | Swagger UI |
| GET | `/metrics` | Prometheus-format metrics (request counts, render durations, queue depth) — internal network only |

## 5.14 Rate Limits (per route class, sliding window via Redis)

| Route class | Limit |
|---|---|
| `/auth/login` | 20 / 15 min / IP+email combo — a backstop above the 5-attempt per-account lockout in [06 §6.1.1](06-flows.md), not a duplicate of it |
| `/auth/forgot-password` | 5 / 15 min / IP+email combo |
| `/documents` (create) | 60 / min / user |
| `/documents/bulk-generate` | 5 / min / user (job size capped separately, see [10](10-edge-cases.md)) |
| `/assets` (upload) | 20 / min / user |
| All other authenticated routes | 300 / min / user |
