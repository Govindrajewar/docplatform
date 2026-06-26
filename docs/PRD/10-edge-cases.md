# 10 — Edge Cases & Corner Cases

Exhaustive, module-by-module. Each row is a real failure mode the implementation must explicitly handle, not an afterthought.

## 10.1 Authentication & Sessions

| Case | Expected Behavior |
|---|---|
| Login with correct password but account `status: suspended` | 403, distinct error code `ACCOUNT_SUSPENDED`, not generic 401 |
| Login while org `isActive: false` | 403 `ORGANIZATION_INACTIVE` |
| 5 failed logins within 15 min | Lock account 15 min, return same generic message as wrong-password (don't reveal lockout state to avoid enumeration assistance). The IP+email rate limiter on `/auth/login` is intentionally set higher (20/15min, see [05 §5.14](05-api-design.md)) so this account-level lockout — not the rate limiter — is what the user actually hits first |
| Refresh token reused after rotation (theft replay) | Revoke all sessions for that user, force full re-login, log `auth.token.reuse_detected` |
| Access token expired mid-request | 401 with code `TOKEN_EXPIRED`; frontend Axios interceptor auto-refreshes once and retries the original request transparently |
| Refresh token expired (30 days idle) | Force login, no silent failure |
| Password reset link used twice | Second use: 400 `INVALID_TOKEN` (token cleared after first successful use) |
| Password reset requested repeatedly in quick succession | Rate-limited; only the most recent token is valid, older ones invalidated |
| User changes email to one already used in another org | Rejected — email is globally unique (see [03 §3.2.1](03-database-design.md)) |
| JWT signing key rotated | Old tokens still issued before rotation must fail gracefully (kid-based key lookup with a short overlap window, not an instant hard cutover) |
| Concurrent login from 2 devices | Both succeed (multiple refresh tokens not currently supported per the single-hash-field schema — **documented limitation**, roadmap: move to a `sessions` collection keyed by device for true multi-device support) |

## 10.2 RBAC & Multi-Tenancy

| Case | Expected Behavior |
|---|---|
| Manager attempts to set another user's role to Admin | 403, service-layer block even though `users:write` is granted |
| Viewer attempts `POST /documents` | 403 before any DB write |
| User requests `/templates/:id` for a template belonging to another org | 404 (not 403 — don't confirm existence) |
| Last remaining Admin in an org attempts to demote themselves | Blocked with 409 `LAST_ADMIN` — an org must always retain ≥1 Admin |
| Org deactivated while users have active sessions | Next request from any of that org's users is rejected (`middleware` checks org `isActive` on every authenticated request, not just at login) |
| Custom role's permissions edited while users are mid-session | New permission set takes effect on next token refresh (≤15 min), not retroactively to the current access token — documented as acceptable staleness window |

## 10.3 Template Designer & Versioning

| Case | Expected Behavior |
|---|---|
| Two admins edit the same template draft simultaneously | Optimistic concurrency: each version save includes the `versionNumber` it was based on; a save against a stale base is rejected with 409 `STALE_VERSION`, client prompts to reload |
| Publish a version that references a deleted asset (logo removed after being added to template) | Validation at publish time resolves every asset reference; publish blocked with a list of broken references until fixed or replaced |
| Element positioned fully outside page bounds (negative `x`/`y`, or `x+width > page width`) | Designer shows a visual out-of-bounds warning; render proceeds (clipped) but a non-blocking lint warning is surfaced — not a hard block, since intentional bleed/cropping is sometimes valid |
| Two elements with the same `id` in one template | Rejected at save time — `id` uniqueness validated by the shared Zod schema before it ever reaches the DB |
| Template with zero elements published | Allowed but flagged with a confirmation dialog ("this will generate a blank page") |
| Restore a version whose referenced custom field has since been deleted | Restore creates the new version with the field reference intact; the field-deletion guard ([05 §5.7](05-api-design.md)) is what actually prevents this — deleting a field referenced by *any* template (published or draft) is blocked with 409, so this state is unreachable rather than handled reactively |
| Compare two versions where an element was both moved AND restyled | Diff reports both changes against that `id`, not as a delete+add pair |
| Template duplicated, then original archived | Duplicate is fully independent (deep copy, no shared reference) — archiving the original has zero effect on the duplicate |
| Import a template bundle exported from a different organization | Allowed (cross-org template sharing is intentional for marketplace-style reuse), but asset references in the bundle are NOT resolvable (different org's asset ids) — import flow requires re-uploading/relinking each referenced asset before the template can be published |
| Rollback to a version, then rollback again to an even older version | Each rollback is just another forward version — no special "undo of an undo" logic needed, history stays linear |

## 10.4 Dynamic Fields & Table Engine

| Case | Expected Behavior |
|---|---|
| `dataSource` token resolves to `undefined` (path doesn't exist in context) | Treated as empty array → table renders its `emptyState`, not an error |
| `dataSource` resolves to a non-array (e.g. a string) | Render-time validation error, document generation fails with a clear `INVALID_TABLE_DATA` reason rather than silently coercing |
| Table column `format: currency` applied to a non-numeric value | Cell renders the raw value with a small warning glyph in dev/preview mode; in production generation this is caught earlier by field-definition validation before render is even attempted |
| Single row's cell content is long enough to require more vertical space than `rowHeight` | Row height auto-expands to fit wrapped content (declared `rowHeight` is a minimum, not a hard clip) — prevents truncated/overlapping text |
| Table has 0 rows but `grandTotals` configured | Totals row suppressed entirely when there are no data rows (showing "Total: 0.00" with an empty table reads as broken, not correct) |
| Table spans exactly to the last byte of usable page height | Grand totals row, if it doesn't fit, pushes to a new page rather than being clipped (see [04 §4.5](04-template-json-schema.md) pagination algorithm step 4) |
| 100,000-row table requested | Hard-capped at the configured max (default 50,000); request rejected up front with `TABLE_ROW_LIMIT_EXCEEDED` and the actual count, rather than starting a render that will time out |
| Nested currency/locale mismatch (org default = INR, field override = USD on the same document) | Field-level `currencyCode` always wins over org default — explicit beats implicit, documented in [04 §4.4](04-template-json-schema.md) |
| Required field missing at generation time | `requiredFieldBehavior: "fail"` (the default for system required fields like `customer.name`) aborts generation with a 422 listing every missing field at once, not just the first one found |
| Circular reference in a custom field's `defaultValue` expression | Not possible by construction — `defaultValue` is a static literal, not an expression; only `visibleIf` is expression-evaluated and that grammar has no field-to-field reference recursion (see [04 §4.7](04-template-json-schema.md)) |

## 10.5 PDF Rendering Engine

| Case | Expected Behavior |
|---|---|
| Embedded custom font file is corrupt/unparseable | Asset upload validation (fontkit parse check, [08 §8.3](08-security.md)) rejects it before it ever reaches a template, so this is unreachable at render time |
| Text content contains characters not covered by the selected font's glyph set (e.g. CJK text in a Latin-only font) | Falls back to a bundled Unicode-coverage fallback font for the unsupported glyph runs only, rest of the line stays in the requested font — never renders a blank box silently without at least attempting fallback |
| Image asset has 0 width or height (corrupt upload) | Caught at upload time by Sharp metadata validation; cannot become a template reference |
| SVG with embedded raster data exceeding a sane size | Rejected at upload (max decoded pixel dimension cap, same as raster images) |
| Watermark text longer than the page diagonal at the configured font size | Auto-scales watermark font size down to fit within page bounds rather than clipping |
| QR code value exceeds the byte capacity of the chosen error-correction level | Render-time validation error with the actual vs max byte count — fails fast rather than producing an unscannable QR |
| Document requires more pages than a sane cap (e.g. 1 row per page bug produces 50,000 pages) | Hard page-count ceiling (configurable, default 500); exceeding it aborts with `PAGE_LIMIT_EXCEEDED` — almost always indicates a template/data mismatch, not a legitimate document |
| Two elements at the same `x,y` with same `zIndex` | Draw order falls back to array order in the JSON (stable, deterministic) — no rendering engine ever produces non-deterministic z-fighting |
| Render worker process crashes mid-job (OOM, segfault) | BullMQ job remains in-flight in Redis with a stalled-job detector; requeued once automatically, `documents.status` stays `generating` until either success or the 2-retry cap is hit, then `failed` |
| Same `documentId` render job delivered twice (at-least-once queue delivery) | Worker is idempotent: it checks `documents.status` before rendering; if already `generated`, it acks and no-ops instead of re-rendering and double-uploading |
| Page size set to a custom dimension smaller than the sum of margins | Validation rejects the template at save time — margins must leave positive usable area |

## 10.6 Document Generation & Data Import

| Case | Expected Behavior |
|---|---|
| CSV file with inconsistent column counts across rows | Per-row parse error collected and surfaced in the mapping-preview UI; well-formed rows can still proceed if the user chooses "skip invalid rows" |
| Excel file with multiple sheets | Sheet picker shown; default to first sheet, never silently merge sheets |
| Excel file with merged cells in the header row | Header extraction flattens merged cells to the top-left cell's value repeated — documented behavior, surfaced as a mapping warning so the user can fix manually if wrong |
| JSON import is a single object instead of an array | Wrapped into a single-element array automatically (treated as "generate one document") |
| Imported date column in an ambiguous format (`03/04/2026`) | Uses the org's configured date format setting as the parsing assumption, surfaced in the mapping preview so the user can visually confirm before committing — never silently guessed without showing the parsed result |
| Duplicate rows in an import (identical data) | Allowed — duplicates may be intentional (e.g. two transactions with identical amount/date); no implicit dedup |
| Bulk-generate batch where some rows succeed and some fail validation | Partial success: succeeded rows generate documents normally, failed rows are reported individually in the batch status (`{ total, completed, failed, failures: [{row, reason}] }`) — one bad row never blocks the whole batch |
| User navigates away / closes tab during an async bulk-generate | Batch continues server-side regardless of client connection; status is queryable on return via `GET /documents/batches/:batchId` |
| Customer referenced in import data doesn't exist yet | Configurable per-import: auto-create customer records from import data, or reject rows referencing unknown customers — exposed as an explicit checkbox in the mapping UI, not an implicit default |
| Generated PDF requested for a `documentId` still in `generating` status | `GET /documents/:id/pdf` returns 409 `NOT_READY` with the current status, not a broken/empty file |
| User deletes a customer that has existing generated documents | Customer soft-deleted (`status` flag, not removed) — existing documents keep their `dataPayload` snapshot regardless (denormalized at generation time, see [03 §3.2.7](03-database-design.md)), so historical PDFs are unaffected even though the live customer record is gone |
| Re-generate (`/documents/:id/regenerate`) after the template was edited and republished since original generation | Regenerate always uses the **pinned** `templateVersionId` from the original document, not the template's current version — guarantees byte-reproducibility; generating against the *new* template version requires creating a new document, not regenerating |

## 10.7 Assets & Organizations

| Case | Expected Behavior |
|---|---|
| Logo deleted while referenced by a published template | Blocked 409, listing every template that references it (see [05 §5.9](05-api-design.md)) |
| Two assets uploaded with identical byte content | Deduped by checksum within the same org — second upload returns the existing asset record instead of creating a duplicate |
| Organization's `defaultFontFamily` set to a font asset that's later deleted | Same reference-guard as logos — deletion blocked while referenced anywhere (org defaults included) |
| Org branding color set to an invalid hex string | Rejected at the API validation layer (Zod hex-color pattern), never persisted |
| White-label sub-org created under a parent org (future multi-level org roadmap item) | v1 schema is flat (one-level orgs); explicitly **not supported** yet — documented limitation, not silently mishandled |

## 10.8 Search, Filters & Pagination

| Case | Expected Behavior |
|---|---|
| Search query is empty string | Returns empty result set immediately, no full-collection scan |
| Search query matches across multiple resource types | Results grouped by type with per-type counts, not an unsorted flat blend |
| `?page=` requested beyond the last page | Returns an empty `data` array with accurate `meta` (not a 404 — pagination overflow is not an error condition) |
| `?limit=` requested above a sane max (e.g. 10,000) | Clamped server-side to a max page size (default 100) regardless of what the client requests |
| Filter combination yields zero results | 200 with empty array + `meta.total: 0`, never a 404 |

## 10.9 Notifications

| Case | Expected Behavior |
|---|---|
| Email provider (SMTP/API) temporarily down | Email jobs requeued with backoff (up to N retries); in-app/toast notifications for the same event are not blocked by email delivery failure — channels are independent |
| User has no email configured (edge case for invited-but-incomplete accounts) | Email-channel notifications for that user are skipped silently (logged at debug level), in-app notifications still delivered |
| Notification references an entity that's since been deleted (e.g. "Document X generated" after Document X was deleted) | Notification still displays with the entity name snapshotted at creation time; any deep-link simply 404s gracefully if clicked |

## 10.10 Settings & Localization

| Case | Expected Behavior |
|---|---|
| Org timezone changed after documents already generated with the old timezone's date formatting | Historical documents are unaffected (dates were resolved and baked into the PDF at generation time); only future generations use the new timezone |
| Currency changed mid-template-design | Designer always uses the *template's* currency override if set, else the *org's current* default at preview time — never a stale cached currency |
| Unsupported language requested in `Accept-Language` | Falls back to platform default (English), never a blank UI |

## 10.11 Audit Logs

| Case | Expected Behavior |
|---|---|
| Action performed by a since-deleted user | Audit entry retains the `actorId` and a denormalized `actorName` snapshot, so historical logs remain readable even after the user record is gone |
| Audit log write fails (DB hiccup) | Logged as an internal warning; the underlying business action is **not** rolled back — audit is best-effort observability, not a two-phase-commit participant (explicit design decision, see [07 §7.4](07-rbac-permissions.md)) |
| Audit log volume grows unbounded | Optional TTL index per org retention policy setting; defaults to indefinite retention unless explicitly configured otherwise |
