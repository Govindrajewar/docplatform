# Deployment Checklist

> Everything in this file requires an account, credential, or interactive browser step I (the assistant) can't complete on your behalf — that's why it's a checklist for you rather than something already done in code. Code-side work (render.yaml, the Pages workflow, the cookie fix, etc.) is tracked in `docs/IMPLEMENTATION_STATUS.md` as usual; this file is just the manual setup steps, in order.

---

## Quick reference — local verification command

Run this any time you want to validate the full codebase (lint + typecheck + tests + build) before pushing to GitHub:

```
npm run verify
```

This runs: `lint → build:shared → typecheck → build` in the correct dependency order. Fast (~1 min). To also run the full test suite (153 tests, ~4–5 min), run `npm test` separately.

---

## 1. GitHub

- [x] Create the repo: `https://github.com/Govindrajewar/docplatform`
- [x] First push (`git push -u origin main`) — done from your own terminal, since Git Credential Manager needs an interactive browser popup that can't run from here.
- [ ] **Push the latest commit** — there's at least one commit (`render.yaml` + the cross-origin cookie fix) sitting locally that hasn't been pushed yet. Run, in your own terminal:
  ```
  cd c:\personal-projects\statements
  git push origin main
  ```
  You'll need to repeat this `git push origin main` step every time I commit new work going forward — I'll tell you when there's something to push.
- [ ] **Enable GitHub Pages** — Settings → Pages → Source: "GitHub Actions". (Don't pick a branch source; the deploy workflow handles publishing.) **Wait for me to provide the Pages workflow file first** — there's no point enabling this yet since nothing builds/publishes to Pages until that workflow exists.

---

## 2. MongoDB Atlas

- [ ] **Decide**: reuse your existing dev cluster/database, or create a separate one for production. Either works; a separate one keeps dev and prod data from mixing.
- [ ] **Network access allow-list** — this is the step most likely to silently break the deploy. Render's free/starter plans don't have a static outbound IP, so Atlas's IP allow-list needs to either:
  - Allow access from anywhere (`0.0.0.0/0`) — simplest, fine for a project at this stage, or
  - Add Render's specific outbound IP ranges, if you're on a Render plan that provides static outbound IPs (paid plans only).

  In Atlas: **Network Access → Add IP Address → Allow Access from Anywhere**.

- [ ] Have the full `mongodb+srv://...` connection string ready to paste into Render.

---

## 3. Upstash Redis

- [ ] **Decide**: reuse your existing dev database, or create a separate one for production.
- [ ] Upstash's TLS REST/Redis endpoint is reachable from anywhere by default (auth is via the password in the connection string, not IP allow-listing), so there's usually nothing extra to configure here — just have the `rediss://default:<password>@<endpoint>.upstash.io:6379` connection string ready.

---

## 4. Render — API web service

You're already most of the way through this one.

- [ ] Build Command:
  ```
  npm ci && npm run build:shared && npm run build --workspace=server
  ```
- [ ] Start Command:
  ```
  node server/dist/server.js
  ```
- [ ] Root Directory: leave **blank** (must build from the repo root — this is an npm-workspaces monorepo, not a single-package repo).
- [ ] Health Check Path: `/health` (not the `/healthz` placeholder Render suggests).
- [ ] Environment variables:

  | Key                           | Value                               |
  | ----------------------------- | ----------------------------------- |
  | `NODE_ENV`                    | `production`                        |
  | `PORT`                        | `4000`                              |
  | `MONGODB_URI`                 | your Atlas connection string (§2)   |
  | `REDIS_URL`                   | your Upstash connection string (§3) |
  | `JWT_ACCESS_SECRET`           | random secret — see below           |
  | `JWT_REFRESH_SECRET`          | a **different** random secret       |
  | `JWT_ACCESS_EXPIRES_IN`       | `15m`                               |
  | `JWT_REFRESH_EXPIRES_IN_DAYS` | `30`                                |
  | `CORS_ORIGIN`                 | `https://Govindrajewar.github.io`   |
  | `STORAGE_DRIVER`              | `local`                             |
  | `STORAGE_LOCAL_PATH`          | `./storage/uploads`                 |
  | `LOG_LEVEL`                   | `info`                              |

  Generate each JWT secret by running this twice in your own terminal (run it twice — don't reuse one value for both):

  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

- [ ] Instance Type: Free is fine to start.
- [ ] Click **Deploy web service**.
- [ ] Once live, visit `https://<your-service-name>.onrender.com/health` and confirm it returns `{"success":true,"data":{"status":"ok"},"error":null}`.
- [ ] **Note the live URL down** — you'll need it for the GitHub Pages client deploy later.

---

## 5. Render — worker background service

A second, separate service. Without it, bulk document generation (over the row threshold) and all outgoing email (invites, password resets, notifications) get queued and never processed — they'll just sit there with no error shown anywhere.

- [ ] **New → Background Worker** (not Web Service) → same repo, same branch (`main`).
- [ ] Build Command: identical to the API's —
  ```
  npm ci && npm run build:shared && npm run build --workspace=server
  ```
- [ ] Start Command:
  ```
  node server/dist/workers/index.js
  ```
- [ ] Root Directory: leave blank.
- [ ] Environment variables: same table as §4, **except** no Health Check Path field (background workers have no HTTP server, so there's nothing to health-check).
- [ ] Instance Type: Free is fine to start.
- [ ] Click **Deploy**.
- [ ] No URL to visit for this one — verify it's working later via the end-to-end smoke test in §7 (e.g. a bulk-generate batch actually completing, or an invite email actually logging/sending).

---

## 6. GitHub Pages — client (blocked on me, not you, for now)

I haven't built this part yet — it needs a GitHub Actions workflow that builds the client with the Render API's URL baked in, plus a `vite.config.ts` change for the `/docplatform/` base path. Once I've pushed that:

- [ ] Push the commit I give you (same `git push origin main` step as always).
- [ ] Go back to **§1 — Enable GitHub Pages** (Settings → Pages → Source: GitHub Actions) now that the workflow exists.
- [ ] The workflow will run automatically on the next push to `main` and publish to `https://Govindrajewar.github.io/docplatform/`.

---

## 7. End-to-end smoke test (once everything above is live)

- [ ] Visit `https://Govindrajewar.github.io/docplatform/` → register a new organization.
- [ ] Log out and log back in.
- [ ] **Refresh the page while logged in** — this is the specific case the cross-origin cookie fix targets; confirm you stay logged in rather than getting bounced to `/login`.
- [ ] Create a template, publish it, generate a single document — confirms the API + sync-path rendering works.
- [ ] Try a bulk-generate (a handful of rows is enough) — confirms the worker is actually draining the queue, not just deployed.
- [ ] Invite a teammate (or trigger forgot-password) — check the worker's Render logs for the email being sent/logged, confirming the email queue works too.

---

## Known limitations to accept for now (not blocking, just disclosed)

- **Uploaded files don't persist.** `STORAGE_DRIVER=local` writes to Render's ephemeral disk — logos, signatures, fonts, and generated PDFs vanish on every deploy/restart. Fixing this for real needs either a paid Render Disk or the not-yet-built S3 storage driver.
- **Free plan services sleep when idle** and take ~30–60s to wake up on the next request.
- **Reduced CSRF protection on `/auth/refresh` and `/auth/logout` in production** — a documented trade-off of making cross-origin login work at all; see `docs/IMPLEMENTATION_STATUS.md`'s Deployment section for the full explanation.
