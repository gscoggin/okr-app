# Critical User Journeys (CUJs)

Reference for what to test per user role. Each journey should be covered by a browser-level
(Playwright) test and/or an API-level (Jest + supertest) test.

Seed the database before any test run: `GET /api/dev/seed`
Default passwords: admin → `admin123`, all others → `password123`

---

## Admin

1. Log in as admin → company dashboard shows all orgs and teams
2. Create a new org
3. Create a new team inside an org
4. Add a user to a team; change their role (member → owner)
5. Remove a user from a team
6. View any team's OKR page regardless of membership
7. Publish an OKR page on behalf of a team
8. Archive an OKR page

---

## Team Owner

1. Log in → land on their team's current OKR page
2. Add a new Objective to a draft page
3. Add Key Results to an Objective (set owner, metric, start/target values)
4. Edit an existing KR's current value, score, and confidence
5. Reorder objectives (drag-and-drop)
6. Attempt to publish with a KR missing an owner → blocked with error
7. Assign all KR owners → publish successfully
8. Confirm published page is locked (no edit controls)

---

## Member / Viewer

1. Log in → see their team's current OKR page in read-only mode
2. Confirm no edit controls are visible on any KR or Objective
3. Browse another team's published OKR page (read-only)
4. Attempt to directly call an edit API endpoint → 403
5. Navigate between periods (annual ↔ quarterly) via PeriodNav
6. Score badges and confidence indicators render correctly

---

## Cross-cutting / E2E

1. Full OKR lifecycle: create draft → add objectives & KRs → publish → scores appear on org dashboard
2. Score rollup: update a KR value → objective score and page score both update
3. Period navigation: switch year and quarter, confirm correct page and data load
4. Unpublished pages are not visible to members of other teams
5. Published pages from prior years are visible but not editable by anyone

---

## Testing tools

| Layer | Tool | Notes |
|---|---|---|
| Browser / FE | Playwright | Logs in as real user, drives UI |
| API / E2E | Jest + supertest | Hits Next.js API routes, asserts DB state |
| Seed | `GET /api/dev/seed` | Resets DB to known state before runs |
