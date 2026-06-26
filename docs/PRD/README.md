# Enterprise Document Generation Platform — PRD

Split into focused documents to keep each section reviewable on its own. Read in order for full context, or jump to the section you need.

| # | Document | Covers |
|---|----------|--------|
| 01 | [Executive Summary & Scope](01-executive-summary-and-scope.md) | Vision, goals, personas, in/out of scope, glossary |
| 02 | [System Architecture](02-architecture.md) | High-level architecture, tech stack, folder structure, Template→Data→Render pipeline |
| 03 | [Database Design](03-database-design.md) | ER diagram, all collection schemas, indexes |
| 04 | [Template JSON Schema](04-template-json-schema.md) | Full element spec, table engine, dynamic fields, sample templates |
| 05 | [API Design](05-api-design.md) | Full REST endpoint catalog per module |
| 06 | [Core Flows](06-flows.md) | Auth, document generation, data import, versioning, sequence diagrams |
| 07 | [RBAC & Permissions](07-rbac-permissions.md) | Role matrix, permission enforcement points |
| 08 | [Security Architecture](08-security.md) | Threats × mitigations, file/upload security, CSRF/XSS/rate limiting |
| 09 | [NFR, Deployment & CI/CD](09-nfr-deployment-cicd.md) | Performance targets, scalability, Docker, pipeline, caching |
| 10 | [Edge Cases & Corner Cases](10-edge-cases.md) | Exhaustive failure-mode catalog across every module |
| 11 | [Roadmap & Phased Plan](11-roadmap-and-phased-plan.md) | Future features, phase-by-phase delivery plan |

**Status:** Draft v1.0 — 2026-06-26
**Owner:** Platform Architecture
