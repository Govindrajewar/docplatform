# 04 — Template JSON Schema & Rendering Engine Contract

## 4.1 Top-Level Template Version Document

```json
{
  "page": {
    "size": "A4",
    "orientation": "portrait",
    "marginTop": 36,
    "marginBottom": 36,
    "marginLeft": 40,
    "marginRight": 40,
    "background": null
  },
  "theme": {
    "primaryColor": "#002970",
    "secondaryColor": "#6B7280",
    "fontFamily": "Inter",
    "baseFontSize": 10
  },
  "header": { "height": 90, "elements": [ /* Element[] */ ], "repeatOnEveryPage": true },
  "footer": { "height": 50, "elements": [ /* Element[] */ ], "repeatOnEveryPage": true },
  "watermark": { "enabled": false, "text": "DRAFT", "opacity": 0.08, "rotation": -35, "fontSize": 80 },
  "sections": [ /* Section[] */ ],
  "fields": [ /* FieldDefinition[] — declares every {{token}} this template expects */ ]
}
```

| Field | Type | Notes |
|---|---|---|
| `page.size` | `A4 \| LETTER \| LEGAL \| { width, height }` | Custom size as point dimensions |
| `page.orientation` | `portrait \| landscape` | |
| `header`/`footer` | Object | Independent element trees, laid out once, drawn on every page when `repeatOnEveryPage: true` |
| `watermark` | Object | Drawn behind body content on every page |
| `sections` | Array | Body content, flows and paginates; this is the only part of the document that triggers page breaks |
| `fields` | Array | Self-documents which data-context paths this template requires — used by the Document Generation form to auto-build the input form and by validation to fail fast if required data is missing |

## 4.2 Section

```json
{
  "id": "transactions-section",
  "type": "static" | "repeatable" | "conditional",
  "visibleIf": "{{document.type}} === 'detailed'",
  "elements": [ /* Element[] */ ],
  "pageBreakBefore": false,
  "keepTogether": false
}
```

- `static`: always rendered once.
- `repeatable`: rendered once per item in a bound array (used for things like multiple "account" blocks in a combined statement) — distinct from the Table Engine, which handles tabular row data; `repeatable` sections handle repeating *block* content.
- `conditional`: rendered only if `visibleIf` (a restricted boolean expression over the data context, evaluated by a safe expression evaluator — **never `eval`**) is true.
- `keepTogether`: hint to the Layout Engine to avoid splitting this section across a page boundary unless it alone exceeds one full page.

## 4.3 Common Element Properties

Every element, regardless of `type`, supports this base shape:

| Property | Type | Default | Notes |
|---|---|---|---|
| `id` | string | required, unique within template | |
| `type` | enum | required | `text, image, table, divider, rectangle, circle, line, qrcode, barcode, signature, dynamicField, staticText, date, currency, checkbox` |
| `x`, `y` | number (pt) | required | Relative to containing section/header/footer origin |
| `width`, `height` | number (pt) | `auto` allowed for text | `auto` height triggers text-measurement-driven flow |
| `padding` | number or `{top,right,bottom,left}` | 0 | |
| `margin` | number or `{top,right,bottom,left}` | 0 | |
| `border` | `{ width, color, style: "solid"\|"dashed"\|"dotted" }` | none | |
| `borderRadius` | number | 0 | |
| `font` | string | inherits `theme.fontFamily` | Must resolve to an embedded font asset or bundled system font |
| `fontSize` | number | inherits `theme.baseFontSize` | |
| `fontWeight` | `normal \| bold \| 100-900` | normal | |
| `color` | hex string | `#000000` | |
| `align` | `left \| center \| right \| justify` | left | |
| `verticalAlign` | `top \| middle \| bottom` | top | |
| `background` | hex string or null | null | |
| `rotation` | number (degrees) | 0 | |
| `visibility` | `visible \| hidden` | visible | Hidden elements are skipped entirely (not just invisible-but-occupying-space) |
| `visibleIf` | string expression, nullable | null | Element-level conditional, same evaluator as section-level |
| `layer`/`zIndex` | number | 0 | Draw order within the same container |

## 4.4 Element Type Reference

| Type | Extra Properties | Rendering Notes |
|---|---|---|
| `text` | `value` (may contain `{{tokens}}` and literal text mixed), `lineHeight`, `maxLines`, `overflow: clip\|ellipsis\|wrap` | Supports inline rich text via a minimal markup subset: `**bold**`, `*italic*`, line breaks |
| `staticText` | `value` (no token interpolation, used for fixed legal text/labels) | Skips the resolver token pass entirely for a small perf win |
| `dynamicField` | `fieldKey` (references `fields[]`), `format` (`text\|number\|currency\|date\|percentage`), `formatOptions` | Thin wrapper around `text` that pulls value + format from the field definition, so the same field's formatting can be changed in one place |
| `date` | `fieldKey`, `format` (e.g. `DD/MM/YYYY`), `timezone` | Falls back to org default timezone |
| `currency` | `fieldKey`, `currencyCode` (ISO 4217, defaults to org), `decimalPlaces`, `locale` | Uses `Intl.NumberFormat` semantics server-side |
| `checkbox` | `checked` (boolean or `{{token}}`), `checkedGlyph`, `uncheckedGlyph` | |
| `image` | `src` (asset reference or `{{token}}` resolving to an asset id/URL), `fit: contain\|cover\|stretch`, `format: png\|jpg\|svg` | SVGs are rasterized server-side at render time at 2x target DPI before embedding (pdf-lib has no native SVG support) |
| `table` | See [4.5](#45-table-engine-schema) | |
| `divider` / `line` | `thickness`, `color`, `dashed` | |
| `rectangle` | `fill`, `border`, `borderRadius` | |
| `circle` | `radius`, `fill`, `border` | |
| `qrcode` | `value` (token-resolvable), `size`, `errorCorrectionLevel` (`L\|M\|Q\|H`), `foregroundColor`, `backgroundColor` | Rendered to PNG buffer via `qrcode` lib, embedded as image |
| `barcode` | `value`, `symbology` (`code128\|ean13\|qr\|upc`), `size`, `showText` | Rendered via `bwip-js`, embedded as image |
| `signature` | `src` (asset reference, pre-captured image) or `placeholder` (a labeled box for manual/physical signing) | v1 does not support live e-signature capture in the renderer |

## 4.5 Table Engine Schema

```json
{
  "type": "table",
  "id": "transactions-table",
  "dataSource": "{{document.transactions}}",
  "columns": [
    {
      "key": "date",
      "label": "Date",
      "width": 70,
      "align": "left",
      "format": "date",
      "formatOptions": { "pattern": "DD/MM/YYYY" }
    },
    {
      "key": "narration",
      "label": "Description",
      "width": 220,
      "align": "left"
    },
    {
      "key": "debit",
      "label": "Debit",
      "width": 80,
      "align": "right",
      "format": "currency",
      "runningTotal": false
    },
    {
      "key": "credit",
      "label": "Credit",
      "width": 80,
      "align": "right",
      "format": "currency"
    },
    {
      "key": "balance",
      "label": "Balance",
      "width": 90,
      "align": "right",
      "format": "currency",
      "runningTotal": true
    }
  ],
  "headerStyle": { "background": "#002970", "color": "#FFFFFF", "fontWeight": "bold" },
  "rowHeight": 22,
  "alternatingRowColors": ["#FFFFFF", "#F4F6F8"],
  "borders": { "horizontal": true, "vertical": false, "color": "#E5E7EB" },
  "repeatHeaderOnEveryPage": true,
  "grandTotals": [
    { "columnKey": "debit", "label": "Total Debit" },
    { "columnKey": "credit", "label": "Total Credit" }
  ],
  "emptyState": { "text": "No transactions in this period.", "fontStyle": "italic" },
  "maxRowsPerPage": null
}
```

| Property | Notes |
|---|---|
| `dataSource` | A token path resolving to an array in the data context; each array item is one row |
| `columns[].format` | `text\|number\|currency\|date\|percentage` — same formatter pipeline as `dynamicField` |
| `columns[].runningTotal` | If true, that column's footer-of-page value is the cumulative sum up to the last row rendered on that page (classic bank-statement "running balance") |
| `grandTotals` | Computed once across the **entire** row set (all pages), rendered as a final summary row after the last data row |
| `repeatHeaderOnEveryPage` | When a table spans pages, the Layout Engine redraws `headerStyle` + column labels at the top of each continuation page |
| `maxRowsPerPage` | Optional hard cap; if null, the Layout Engine computes how many rows fit based on available page height, `rowHeight`, and remaining space after header/footer |
| `emptyState` | Rendered in place of the table body when `dataSource` resolves to an empty array — prevents an empty/broken-looking table |

**Pagination algorithm (Layout Engine):**
1. Compute usable body height per page = `page.height - margins - header.height - footer.height`.
2. Render rows greedily until the next row would exceed remaining height.
3. Emit a page break, repeat the table header (if configured) and the document header/footer, continue from the next unrendered row.
4. After the last row, if `grandTotals` is set, render the totals row; if it doesn't fit on the current page, push it to a new page rather than splitting it.
5. Never split a single row's text vertically across pages — a row that genuinely cannot fit due to multi-line cell overflow is pushed whole to the next page.

## 4.6 Field Definition (Dynamic Field Engine)

```json
{
  "key": "customer.accountNumber",
  "label": "Account Number",
  "type": "text",
  "system": true,
  "required": true,
  "defaultValue": null,
  "validation": { "pattern": "^[0-9]{6,18}$" }
}
```

| `type` | System Fields (always available) |
|---|---|
| `text` | `customer.name`, `customer.address`, `customer.email`, `customer.phone`, `customer.accountNumber`, `organization.name`, `organization.branch`, `document.referenceNumber`, `document.narration`, `document.status` |
| `date` | `document.statementDate`, `document.transactionDate` |
| `currency` | `document.openingBalance`, `document.closingBalance`, `document.amount` |

Admins extend this list with **unlimited custom fields**, each given a unique `key` under a `custom.` namespace (e.g. `custom.policyNumber`) to avoid collisions with system fields. Custom fields are stored at the organization level (`field_definitions` collection, org-scoped) and become selectable in the Designer's field picker and in the Document Generation form, which is **auto-generated** from the active template's `fields[]` array — this is what lets "enter data" work identically for every document type without a per-type form being hand-built.

## 4.7 Token Resolution Rules

- Token syntax: `{{path.to.value}}`, dot-notation only, no function calls inside tokens (formatting is declared on the element/column, not embedded in the string) — keeps the resolver a pure lookup, not a template language, which keeps it safe to evaluate with no `eval`/sandboxing risk.
- Missing token → renders as empty string by default; an element can set `requiredFieldBehavior: "blank" | "placeholder" | "fail"` to instead show a configurable placeholder (e.g. `—`) or abort generation with a validation error.
- `visibleIf` expressions are parsed with a constrained grammar (comparisons, `&&`/`||`, literals, token references) executed by a small custom evaluator — explicitly **not** `eval()`/`new Function()`, to eliminate template-authored code execution as an attack surface (admins are trusted to design layouts, not to execute server-side JS).

## 4.8 Sample Templates (Abbreviated)

### 4.8.1 Tax Invoice (excerpt)

```json
{
  "page": { "size": "A4", "orientation": "portrait", "marginTop": 36, "marginBottom": 36, "marginLeft": 40, "marginRight": 40 },
  "header": {
    "height": 100,
    "elements": [
      { "id": "logo", "type": "image", "x": 0, "y": 0, "width": 120, "height": 50, "src": "{{organization.logoAssetId}}", "fit": "contain" },
      { "id": "title", "type": "staticText", "x": 300, "y": 10, "width": 200, "fontSize": 18, "fontWeight": "bold", "align": "right", "value": "TAX INVOICE" },
      { "id": "invoiceNo", "type": "dynamicField", "x": 300, "y": 35, "width": 200, "align": "right", "fieldKey": "document.referenceNumber", "format": "text" }
    ]
  },
  "sections": [
    {
      "id": "parties",
      "type": "static",
      "elements": [
        { "id": "billTo", "type": "text", "x": 0, "y": 0, "width": 250, "value": "Bill To:\n{{customer.name}}\n{{customer.address}}" },
        { "id": "gstin", "type": "dynamicField", "x": 0, "y": 60, "fieldKey": "custom.gstin", "format": "text" }
      ]
    },
    {
      "id": "lineItems",
      "type": "static",
      "elements": [
        {
          "type": "table",
          "id": "items",
          "dataSource": "{{document.lineItems}}",
          "columns": [
            { "key": "description", "label": "Item", "width": 220 },
            { "key": "qty", "label": "Qty", "width": 50, "align": "right", "format": "number" },
            { "key": "rate", "label": "Rate", "width": 70, "align": "right", "format": "currency" },
            { "key": "taxPercent", "label": "GST %", "width": 60, "align": "right", "format": "percentage" },
            { "key": "amount", "label": "Amount", "width": 90, "align": "right", "format": "currency" }
          ],
          "grandTotals": [{ "columnKey": "amount", "label": "Grand Total" }],
          "repeatHeaderOnEveryPage": true
        }
      ]
    }
  ],
  "footer": {
    "height": 40,
    "elements": [
      { "id": "pageNum", "type": "text", "x": 460, "y": 10, "value": "Page {{system.pageNumber}} of {{system.pageCount}}" }
    ]
  }
}
```

`{{system.pageNumber}}` / `{{system.pageCount}}` are **engine-injected** tokens, not part of the data context — resolved by the Layout Engine only after pagination is known, in the final draw pass.

### 4.8.2 Account Statement (excerpt) — demonstrates running totals

Identical header/footer pattern; body section uses the Table Engine example from [4.5](#45-table-engine-schema) verbatim with `dataSource: "{{document.transactions}}"` and an opening-balance text element above it: `"Opening Balance: {{document.openingBalance}}"` formatted via `currency`.

**The point of including both examples side by side:** the *only* difference between an Invoice template and an Account Statement template is JSON content. Both are executed by the exact same `engine/index.ts#render()` function described in [02 §2.5](02-architecture.md).
