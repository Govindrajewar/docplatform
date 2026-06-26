# 06 — Core Flows

## 6.1 Authentication Flow

### 6.1.1 Login + Token Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API (Auth Service)
    participant R as Redis
    participant DB as MongoDB

    C->>A: POST /auth/login {email, password}
    A->>DB: findUser(email) [+passwordHash]
    A->>A: bcrypt.compare(password, hash)
    alt invalid credentials
        A->>DB: increment failedLoginAttempts
        A-->>C: 401 UNAUTHORIZED
    else valid, account not locked
        A->>A: sign accessToken (15m, JWT, claims: sub, orgId, roleId, permissions)
        A->>A: generate refreshToken (random 256-bit), hash it
        A->>DB: store refreshTokenHash + expiresAt (30d) on user
        A->>R: SET session:{userId} (for instant revocation lookups)
        A-->>C: 200 {accessToken}, Set-Cookie refreshToken (httpOnly, secure, sameSite=strict)
    end
```

### 6.1.2 Refresh & Rotation

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant DB as MongoDB

    C->>A: POST /auth/refresh (cookie: refreshToken)
    A->>DB: lookup user by hash(refreshToken)
    alt token not found / expired / hash mismatch
        A-->>C: 401, clear cookie, force re-login
    else valid
        A->>A: issue new accessToken + new refreshToken
        A->>DB: replace refreshTokenHash (rotation — old token now dead)
        A-->>C: 200 {accessToken}, Set-Cookie new refreshToken
    end
```

Rotation means a stolen refresh token is single-use from the legitimate client's perspective: if an attacker replays an old token after the legitimate client has already rotated, the hash won't match and **both** sessions are invalidated, surfacing the theft immediately rather than silently.

### 6.1.3 Forgot / Reset Password

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant DB as MongoDB
    participant E as Email Worker

    C->>A: POST /auth/forgot-password {email}
    A->>DB: find user (no-op silently if not found)
    A->>DB: store passwordResetTokenHash (1h expiry)
    A->>E: enqueue reset email job
    A-->>C: 200 {message: "If that email exists, a reset link was sent"}
    Note over C,A: Response is identical whether or not the email exists (anti-enumeration)

    C->>A: POST /auth/reset-password {token, newPassword}
    A->>DB: find user by hash(token), check expiry
    alt invalid/expired
        A-->>C: 400 INVALID_TOKEN
    else valid
        A->>DB: set new passwordHash, clear resetToken, revoke all refresh tokens
        A-->>C: 200 OK
    end
```

All existing refresh tokens are revoked on password reset, forcing re-login everywhere — standard session-invalidation hygiene after a credential change.

## 6.2 Document Generation Flow

Two paths exist depending on document size, decided server-side, transparently to the client API contract:

- **Sync fast-path**: estimated render time < ~800ms (small templates, few/no large tables) → render inline, return the document already `generated`.
- **Async path**: large tables / multi-page / bulk → enqueue, return `generating`, client polls or subscribes.

```mermaid
sequenceDiagram
    participant U as User (Editor)
    participant FE as Frontend
    participant API as API
    participant Q as Redis Queue
    participant W as Render Worker
    participant ENG as Rendering Engine
    participant OS as Object Storage
    participant DB as MongoDB

    U->>FE: Select template, fill form (auto-built from template.fields[])
    FE->>FE: Zod-validate against shared schema (instant feedback)
    U->>FE: Click "Preview"
    FE->>API: POST /templates/:id/preview {sampleData}
    API->>ENG: render(currentVersion.layoutJson, sampleData, assets) [in-process, not queued]
    ENG-->>API: PDF buffer (not persisted)
    API-->>FE: PDF stream
    FE->>U: Render in pdf.js viewer

    U->>FE: Click "Generate"
    FE->>API: POST /documents {templateId, customerId, dataPayload}
    API->>DB: insert documents{status: "generating"}
    API->>API: estimate complexity (row counts, page estimate)
    alt small/simple
        API->>ENG: render() inline
        ENG-->>API: PDF buffer
        API->>OS: upload PDF
        API->>DB: insert generated_pdfs, update documents{status:"generated"}
        API-->>FE: 201 {documentId, status:"generated"}
    else large/complex
        API->>Q: enqueue render job {documentId}
        API-->>FE: 202 {documentId, status:"generating"}
        Q->>W: deliver job
        W->>DB: load templateVersion + data + assets
        W->>ENG: render()
        ENG-->>W: PDF buffer
        W->>OS: upload PDF
        W->>DB: insert generated_pdfs, update documents{status:"generated"}
        W->>FE: (SSE/WebSocket event) documentReady
    end
    FE->>API: GET /documents/:id/pdf
    API->>OS: generate short-lived signed URL
    API-->>FE: redirect to signed URL
    FE->>U: Download / Print
```

**Failure path:** if `ENG.render()` throws (e.g. unresolvable required field, corrupt asset), the worker sets `documents.status = "failed"` with `failureReason`, and the job is **not** retried automatically more than 2x (render failures are almost always deterministic data/template problems, not transient infra blips — endless retry just burns the queue). The UI surfaces the failure reason and lets the user fix data and resubmit as a *new* generation rather than mutating the failed record.

## 6.3 Data Import Flow (CSV / Excel / JSON)

```mermaid
flowchart TD
    A[User uploads file] --> B{Detect format}
    B -->|CSV| C[Parse with csv-parse, sniff delimiter]
    B -->|XLSX| D[Parse with exceljs, first sheet by default, sheet picker if multiple]
    B -->|JSON| E[Parse, expect array-of-objects or single object]
    C --> F[Extract header row -> candidate columns]
    D --> F
    E --> F
    F --> G[Auto-map columns to template fields by fuzzy name match]
    G --> H[Present mapping UI: source column -> target field, with type coercion preview]
    H --> I{User confirms mapping}
    I -->|edits mapping| H
    I -->|confirms| J[Validate every row against field validation rules]
    J --> K{Any row invalid?}
    K -->|yes| L[Show per-row errors, allow exclude-and-continue or fix-and-reupload]
    K -->|no| M[POST /documents/bulk-generate]
    M --> N[Enqueue N render jobs, return batchId]
    N --> O[Poll /documents/batches/:batchId for progress]
```

**Mapping rules:**
- Auto-mapping matches by normalized header text (case/space/underscore-insensitive) against `field.label` and `field.key`, plus a small synonym table (`"acct no" → accountNumber`, `"amt" → amount`).
- Numbers/dates are coerced using the field's declared `format`; coercion failures are per-row errors, not whole-import aborts.
- Rows exceeding a configurable max (default 50,000 rows/import) are rejected up front with a clear error rather than silently truncated — see [10](10-edge-cases.md) for the full import edge-case table.

## 6.4 Template Versioning & Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: create template
    Draft --> Draft: save new draft version
    Draft --> Published: publish version
    Published --> Draft: save new draft version (current stays published until next publish)
    Published --> Archived: archive
    Archived --> Draft: unarchive (creates new draft version from last published)
    Published --> Published: rollback (creates+publishes new version copying an older one)

    note right of Published
        templates.currentVersionId always
        points at the latest PUBLISHED version.
        Documents already generated keep their
        own pinned templateVersionId regardless
        of later changes.
    end note
```

- **Duplicate**: copies a Template + its current version into a brand-new Template (new id, status `draft`) — used as a starting point for a similar document type.
- **Compare**: structural diff between any two versions of the *same* template (element added/removed/moved/restyled), rendered as a side-by-side or unified list in the UI; computed by a deep diff of `layoutJson` keyed by element `id`.
- **Rollback**: never edits history — creates version N+1 with `layoutJson` copied from the selected old version, then publishes it. This means the audit trail always shows a forward-only sequence of versions, and "what was published when" is always answerable.

## 6.5 Live Preview Flow

```mermaid
sequenceDiagram
    participant D as Designer Canvas
    participant Store as Local Draft State
    participant API as API (preview endpoint)
    participant PV as Preview Pane (pdf.js)

    D->>Store: element moved/resized/styled (debounced 400ms)
    Store->>API: POST /templates/:id/preview {layoutJson: draftLayout, sampleData}
    API->>API: validate against shared Zod schema
    alt invalid
        API-->>D: 422 with field-level errors -> inline canvas warning, preview not refreshed
    else valid
        API-->>PV: PDF buffer
        PV->>PV: re-render in viewer, preserve current scroll/zoom
    end
```

Debouncing + sending the *draft* (unsaved) layout directly to the same `render()` used for real documents guarantees the preview is never a simulated approximation — it is pixel-identical to what generation will produce, because it's the same code path.
