# Demo Page & Invite System — Build Plan

> Status: Planned — not yet built.

---

## Vision

A public-facing demo at its own URL that lets anyone explore the app against realistic seed data, with a guided tour and a persistent "Request a code" button. The demo *is* the marketing page. No static mockups — real components, real navigation, read-only session.

---

## Demo deployment strategy

Two branches, two Vercel deployments:

| Branch | Deployment | Purpose |
|---|---|---|
| `main` | Production app (`app.yourdomain.com`) | Real users, active development |
| `demo` | Demo site (`demo.yourdomain.com`) | Public demo, stable, manually updated |

To update the demo: merge `main` → `demo`. Vercel auto-deploys.
This means cutting-edge features never reach the demo until you explicitly decide to promote them. No feature flags, no runtime checks.

Each deployment gets its own environment variables in Vercel:
- Separate `MONGODB_URI` (demo Atlas cluster, isolated from production data)
- Separate `NEXT_PUBLIC_APP_URL`
- `IS_DEMO_DEPLOYMENT=true` — tells the app to show the demo banner and enable demo auto-auth

---

## What the demo looks like

Every demo page has a persistent thin banner at the top:

```
┌──────────────────────────────────────────────────────────────┐
│  👋 You're exploring a demo workspace.   [Request a code →]  │  ← fixed, follows navigation
└──────────────────────────────────────────────────────────────┘
```

Below that: the actual app UI (dashboard, org view, team OKR pages) running against demo seed data, with a read-only session auto-authenticated on page load.

When a visitor tries to perform a write action (Edit, Add Objective, Admin, etc.):
```
┌────────────────────────────────────┐
│  Want to edit?                     │
│  Request access to create your own │
│  workspace.                        │
│                                    │
│  [Request a code]  [Keep exploring]│
└────────────────────────────────────┘
```

---

## Guided tour (Driver.js)

A spotlight-and-bubble tour that auto-starts on first demo visit (localStorage flag prevents repeat). Manual re-launch via "Take the tour ▶" in the demo banner.

**Proposed steps (draft copy — refine before building):**

1. **Company dashboard** — *"This is the company view. Every org and team's live OKR score, in one place."*
2. **Score rings** — *"These rings show 0–1 scores, rolled up automatically from Key Results. Red → amber → green."*
3. **Org structure** — *"Teams are organized under orgs. You can have as many orgs and sub-teams as you need."*
4. **Navigate to a team** — *"Click any team to see their OKRs for the current period."*
5. **Objectives** — *"Each Objective is qualitative and aspirational — where the team wants to end up."*
6. **Key Results** — *"Key Results are measurable. Start, current, and target values compute the score automatically."*
7. **Confidence & owners** — *"Each KR has an owner and a confidence level. Accountability is explicit."*
8. **Period navigation** — *"Navigate between quarters and annual views with the period controls."*

---

## Demo data

A dedicated demo tenant, seeded with:
- 2 organizations
- 5–6 teams across those orgs
- Annual OKRs for the current year
- Quarterly OKRs for the current quarter and previous quarter
- A realistic mix of scores (not all green — some red, some amber)
- Multiple owners, confidence levels, comments, metric types

**Period-awareness:** the seed script always generates data for the *current* year and quarter, so the demo never looks stale regardless of when someone visits.

**Quarterly refresh:** a "Refresh demo data" button in the admin panel re-seeds the demo tenant in one click. No automation needed — run it at the start of each quarter.

---

## Demo session / auth

- `GET /api/demo/session` — creates or returns a short-lived read-only JWT for the demo tenant's demo user
- JWT carries `isDemo: true` flag
- All write API routes reject `isDemo: true` requests server-side (belt and suspenders — even direct API calls can't write)
- Demo cookie expires after 2 hours; re-visiting `/demo` refreshes it silently
- Rate limit: max 60 demo session requests per IP per hour

---

## Invite code system

Registration is invite-code gated for the beta period.

**`InviteCode` model:**
```
code          String (8-char alphanumeric, e.g. "XK4T9WPQ")
createdBy     UserId (the admin who generated it)
createdAt     Date
expiresAt     Date (7 days from creation)
usedBy        UserId | null
usedAt        Date | null
```

- Single-use: consumed on successful registration completion, not on page load
- Expires 7 days after generation
- Generated in the admin panel — admin copies and pastes into their email
- `/register` validates code before allowing account creation

**Updated `/register` page:**
```
Have an invite code?
[ code field          ]
[ name field          ]
[ email field         ]
[ password field      ]
[ Create workspace    ]

Don't have a code? → Request access
```

---

## Request access form

Collected fields:
- Name
- Email
- What they want to use the app for (optional, textarea)

**`AccessRequest` model:**
```
name          String
email         String
useCase       String (optional)
requestedAt   Date
status        'pending' | 'approved' | 'declined'
```

**On submit:** sends an email notification to the configured admin Gmail address, then shows a confirmation: *"Thanks! We'll review your request and send you an access code."*

**In admin panel:** new "Access Requests" section listing all pending requests with name, email, use case, and date. One-click to generate a code for them (generates the code, copies to clipboard — admin still sends the email manually).

**Spam protection:** honeypot hidden field — bots fill it, humans don't. Requests with the honeypot filled are silently dropped. No CAPTCHA.

---

## Email (Resend)

**Request access notification email** → sent to admin Gmail on each new request.
**No automated code delivery** — admin manually emails the code. Keep it personal at this stage.

**Sending domain consideration:** emails from `@resend.dev` may land in spam. Options:
- Use a custom domain (even a cheap one) as the sender
- Or accept deliverability risk at low volume and revisit if it becomes a problem

---

## Analytics

Enable Vercel Analytics on the demo deployment (free, zero-config). Gives visibility into:
- How many people visit the demo
- Which pages they navigate to
- Drop-off points in the tour

---

## Build phases

### Phase 1 — Invite codes + modified registration
- `InviteCode` model + `POST /api/invite-codes` (admin only)
- Admin panel: "Invite Codes" section — generate, list, copy
- `/register` updated with code field + "Request access" link
- Validation: code exists, not expired, not used

### Phase 2 — Request access form + notifications
- `AccessRequest` model + `POST /api/demo/request-access`
- Request access page/modal (name, email, use case, honeypot)
- Email notification to admin on submission (Resend)
- Admin panel: "Access Requests" section

### Phase 3 — Demo tenant + auto-auth
- Period-aware demo seed script
- "Refresh demo data" button in admin panel
- `GET /api/demo/session` endpoint (rate-limited)
- Demo user JWT with `isDemo: true`; all write routes reject it

### Phase 4 — Demo shell + interception
- Persistent demo banner component (follows navigation)
- Edit interception nudges on all write-action entry points
- `IS_DEMO_DEPLOYMENT` env var gates the banner

### Phase 5 — Guided tour
- Install Driver.js
- Write and wire 8-step tour
- Auto-start on first visit (localStorage flag)
- "Take the tour ▶" button in banner

### Phase 6 — Analytics + deployment
- Enable Vercel Analytics on demo deployment
- Set up `demo` git branch
- Configure second Vercel project pointing to `demo` branch
- Set demo-specific env vars in Vercel dashboard

---

## What's parked for later

- **Automated code delivery** — admin manually emails codes for now; automate when volume warrants it
- **"Push to demo" tooling** — the merge `main` → `demo` git workflow is enough; a dedicated UI for promoting releases is a future-state problem
