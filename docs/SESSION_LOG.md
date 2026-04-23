# Session Log

---

### 2026-04-22 — Invite code system (Phase 1) + test coverage

**Status:** Phase 1 shipped, 98 tests passing, pushed to main.

**Completed:**
- `InviteCode` model (single-use, expiring, revocable 8-char codes)
- `GET/POST /api/invite-codes` and `DELETE /api/invite-codes/[code]` (admin-only)
- Register API migrated from env-var gate to DB-backed invite codes
- Admin panel: generate, list, copy, revoke codes
- Register page: invite code field with "Don't have one?" → `/request-access`
- `register.test.ts` fully rewritten; `user.test.ts` updated to seed invite codes
- UI: presentation view redesign, font upgrade to Plus Jakarta Sans, dark mode fixes

**Next:**
- Add coverage for `GET/POST /api/invite-codes` and `DELETE /api/invite-codes/[code]`
- Demo Phase 2: request access form + email notification
- Demo Phase 3–6: demo tenant, guided tour, analytics, demo branch

**Backlog (testing infra):**
- Move jest to `pre-push` hook, `tsc --noEmit` on `pre-commit` (currently jest runs on every commit ~16s)
- GitHub Actions CI workflow (jest + tsc on every push)

---

### 2026-04-20 — Security hardening, shared OKR alignment, password reset

**Status:** All features working, 55 tests passing, pushed to GitHub. Ready to host.

**Completed:**
- Fixed 6 critical tenant isolation security gaps across API routes:
  - `GET /api/objectives/[objectiveId]` — any authenticated user could read any tenant's objective
  - `POST /api/objectives` and `POST /api/key-results` — missing tenantId check on page lookup allowed cross-tenant writes
  - `POST recompute-score` — bypassed `authorizeObjective`, now routes through it
  - `GET /api/archives` — `Archive.find({})` leaked all tenants' archives to any admin
  - `POST /api/archives` (team/org/year) — no tenant ownership verification before archiving; year archive also scoped to tenant
  - `GET /api/admin/years` — aggregate had no tenantId filter, returned years across all tenants
- Added `tenantId` field to Archive model with compound index
- Added performance indexes: `Objective/KeyResult owners`, `User.tenantId`
- Shared OKR alignment feature: teams can be added as owners of objectives and KRs
  - `GET /api/objectives/shared` endpoint — deduplicates objectives where team owns objective or a KR
  - `SharedObjectivesSection` component — groups by source team, "Our commitments" vs "Other key results"
  - `GET /api/teams` now supports `?q=` search for the OwnerPicker
- Dark mode: PresentationView, KeyResultRow, ObjectiveCard, OwnerPicker
- Theme toggle cycles light → dark → system with a SystemIcon
- DRY serialization via `src/lib/serializeOKR.ts` — 4 pages now use `serializeOKRPageWithNested`
- 9 new tests: 7 shared objectives journey tests + 2 additional tenant isolation tests (55 total)
- Password reset flow:
  - `POST /api/auth/forgot-password` — secure random token, 1-hour expiry, always returns success (no email enumeration)
  - `POST /api/auth/reset-password` — validates token, bcrypt 12, clears token fields
  - `/forgot-password` and `/reset-password` pages matching existing auth UI style
  - "Forgot password?" link added to login page
  - Installed `resend`; added `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` to `.env.local.example`

**Next:**
- **Host on Vercel + MongoDB Atlas** (free tier, steps in `docs/HOSTING.md`)
  - Create Atlas M0 cluster, database user, allow all IPs
  - Import repo to Vercel, set `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`
  - Register first tenant at `/register`
- **Batch import/export** — CSV upload to bulk-create OKRs; export to CSV/PDF
- **AI features** — objective suggestions, KR quality critique (stubs exist, need `ANTHROPIC_API_KEY`)

**Decisions:**
- Password reset token stored as plaintext in DB (acceptable for short-lived 1-hour tokens; hashing adds complexity with minimal gain at this scale)
- `forgot-password` always returns `{ sent: true }` regardless of whether email exists — prevents user enumeration
- Archive `tenantId` is a new required field — existing archives in any running instance will need a migration or manual backfill
- Shared objectives endpoint returns `null` / empty from `SharedObjectivesSection` while loading — no skeleton/spinner intentionally to avoid layout shift

---

## Roadmap

### P0 — Must ship before real users
- [x] Tenant isolation (security)
- [x] Password reset
- [ ] Host on Vercel + Atlas

### P1 — Core product completeness
- [ ] Batch import/export (CSV upload to create OKRs; export to CSV/PDF)
- [ ] OKR alignment view (company-level tree showing how team OKRs roll up)

### P2 — AI features (stubs in place, need ANTHROPIC_API_KEY)
- [ ] AI objective suggestions (`OKRPageEditor`)
- [ ] AI objective quality feedback (`ObjectiveCard`)
- [ ] AI KR quality critique (`KeyResultRow`)

### P3 — Growth / polish
- [ ] Email notifications (weekly digest, score updates)
- [ ] Public read-only share links for OKR pages
- [ ] Comments / reactions on objectives and KRs
- [ ] Mobile-responsive polish

---

### 2026-04-22 — UI polish pass + AI OKR helper design

**Status:** All changes shipped to production. AI feature designed but not built.

**Completed:**
- Dark mode fixes across 7 components (IconUpload, KeyResultRow, search page, PeriodNav, ObjectiveCard, OKRPageEditor, guide page)
- Presentation view redesign: Plus Jakarta Sans font, Objective/KR numbered labels, owners under score ring, progress bar, confidence accent borders, inline PeriodNav, 80px overall score ring
- ImportExportPanel hidden from presentation view (edit mode only)
- Period nav: tighter ‹ › carets, tighter spacing
- Progress bar: simplified inline layout (less visual weight)
- Objective title 24px, KR title 19px
- Removed duplicate "Key Results" section headers from all cards
- README comprehensive update covering all features
- AI OKR Helper plan documented in docs/AI_OKR_HELPER.md

**Next:**
- Build AI OKR Helper (see docs/AI_OKR_HELPER.md for full plan — start with Phase 1 + 2)
- OKR alignment tree (company-level visual rollup)
- Share the app with beta testers

**Decisions:**
- AI feature is explicitly triggered (click), never automatic — cost control + UX
- AI feedback is ephemeral (component state), not persisted to DB
- Stubs already exist in OKRPageEditor, ObjectiveCard, KeyResultRow (search TODO Phase 2)

---

### 2026-04-22 — Demo page + invite system design

**Status:** Plan documented, nothing built yet.

**Completed:**
- Full demo plan written to docs/DEMO_PLAN.md
- AI OKR Helper plan already in docs/AI_OKR_HELPER.md

**Next:**
- Build demo in 6 phases (see DEMO_PLAN.md)
- Phase 1 first: invite codes + modified /register page

**Decisions:**
- Demo runs on a separate `demo` git branch → separate Vercel deployment; no feature flags needed
- main → demo merge is the "push to demo" mechanism; dedicated tooling parked for later
- Registration will be invite-code gated (8-char, single-use, 7-day expiry)
- Request access form: name + email + use case → email notification to admin Gmail → admin manually sends code
- Demo JWT carries isDemo:true; all write API routes reject it server-side
- Honeypot field on request access form (no CAPTCHA)
- Demo data: current year + current quarter + previous quarter only; quarterly refresh via admin button
- Vercel Analytics enabled on demo deployment (free)
