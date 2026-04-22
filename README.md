# OKR Manager

Getting teams to align on plans and goals is one of the hardest problems in any organization. Priorities shift, commitments go undocumented, and by the time a quarter ends it's often unclear what was actually agreed to — or why.

OKRs (Objectives & Key Results) are an industry-tested framework for solving exactly this. They give teams a shared language for defining what they'll work on, what they'll trade off, and how they'll measure success. When done well, OKRs make strategy visible and accountability mutual.

This tool brings that discipline to any sized organization — from a two-team startup to a multi-org enterprise — without the overhead of spreadsheets or expensive SaaS subscriptions.

---

## What it does

OKR Manager is a **company-wide goal tracking tool**. You set up your organization hierarchy — companies, divisions, teams — and each team manages their own OKRs within it. Leadership gets a live roll-up view of progress across every org and team. Teams get a clean, focused editor for writing and tracking their goals.

---

## Feature overview

### Company & org hierarchy
- **Multi-org support** — create multiple organizations within a workspace, each with their own teams
- **Sub-teams** — teams can nest under parent teams for division-level rollups
- **Company dashboard** — one view across every org and team showing live scores for the current year
- **Org overview pages** — drill into any org to see all its teams and their current scores
- **Custom icons** — upload icons for orgs and teams; they appear throughout the app

### OKR authoring
- **Annual and quarterly pages** — each team manages separate annual and quarterly OKR pages; quarterly pages link back to their annual parent
- **Objectives & Key Results** — each objective holds multiple key results with start, target, and current values; owners can be assigned at both levels
- **Metric types** — choose how values are displayed per key result: absolute number, percentage (%), currency ($), average, ratio (×), or milestone (done/not done)
- **Free-text metric label** — add a plain-English description of what's being measured (e.g. "Monthly active users")
- **Confidence levels** — mark each KR as high / medium / low confidence; color-coded throughout
- **Priority ranking** — optionally rank objectives by priority within a page
- **Comments** — attach notes to objectives and key results

### Scoring & progress
- **Automatic scoring** — KR scores (0–1) are computed from start/target/current values; scores roll up from KRs → objectives → page
- **Score ring** — animated ring gauge at every level, color-coded from red (≤0.29) through amber to deep green (≥0.8)
- **Progress bar** — each KR shows a start → current / target bar at a glance
- **Tracking projection** — a ghost arc on the ring shows where the team is projected to land by period-end based on current pace
- **Score history sparklines** — per-objective mini trend charts show how scores have moved over the period

### Review & presentation
- **Presentation view** — clean, card-based layout designed for team review meetings; the default view for all visitors
- **Numbered Objectives and Key Results** — Objective 1 / Key Result 2 labels make it easy to refer to specific items in a meeting
- **Confidence accent borders** — green / amber / red left border on each KR row for instant status scanning
- **Edit mode** — team owners enter edit mode via the Edit button; presentation is the default for everyone else
- **Period navigation** — navigate between quarters and years from within any OKR page; jump to the annual view from any quarterly page

### Batch import & export
- **CSV import** — upload a structured CSV to bulk-create or overwrite a team's OKRs for any period; owners are resolved by email
- **CSV export** — download any team's OKRs as a spreadsheet for offline review or reporting
- **Markdown export** — export OKRs as a clean `.md` file for sharing in Slack, Notion, or documentation
- **Import template** — download a pre-formatted CSV template with column definitions and example rows

### Cross-team alignment
- **Shared objectives** — any team can be listed as an owner of an objective or key result, surfacing cross-team dependencies automatically
- **"Our commitments" section** — each team's OKR page shows which of their key results are committed to by other teams, and which team-level objectives they're contributing to

### Admin tools
- **User management** — create users, set roles, assign team memberships and owner/member roles per team
- **Role-based access** — admins have full access; team owners can edit their team's OKRs; members get read-only presentation view
- **Archive & restore** — archive orgs, teams, or entire years; restore anything within four years
- **Auto-archive** — years older than four years are automatically archived when the admin page loads
- **Data reset** — wipe all OKR data with credential confirmation, preserving archive history
- **OKR Guide page** — publish a company-wide OKR best practices and norms page, editable by admins in Settings

### Workspace settings
- **Branding** — upload a workspace logo, set a primary color, customize the workspace name
- **Mission statement** — add a company mission to anchor OKRs at the org level
- **Guide page** — write and publish OKR guidance, resources, and company-specific norms for all users

### Quality of life
- **Dark mode** — full dark mode across every screen; follows system preference with a manual light/dark/system toggle
- **Search** — live search across orgs, teams, OKR pages, and objectives from the top bar
- **Auto-save** — edits are saved to the server every 3 seconds; a local draft is kept in localStorage as a fallback
- **Password reset** — self-service email-based password recovery
- **Modern typography** — uses Plus Jakarta Sans for a clean, high-density SaaS aesthetic

---

## Roles

| Role | What they can do |
|---|---|
| **Admin / Tenant Owner** | Full access — manage orgs, teams, users, settings, and all OKR data |
| **Team Owner** | Create, edit, and publish OKRs for their team; import and export |
| **Member** | Read-only access; sees the presentation view by default |

---

## Getting started

### Prerequisites
- Node.js 18+
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/atlas))

### Local setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.local.example .env.local
# → Fill in MONGODB_URI and JWT_SECRET at minimum

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register — the first user automatically becomes the workspace admin.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret for signing auth tokens (any long random string) |
| `RESEND_API_KEY` | Optional | Enables transactional email (password reset). Omit for dev — reset links log to the terminal instead |
| `EMAIL_FROM` | Optional | Sender address for transactional email (e.g. `noreply@yourdomain.com`) |
| `NEXT_PUBLIC_APP_URL` | Optional | Your deployment URL, used in reset email links |

### Seed data (development only)

Populate the app with two organizations, seven teams, and three years of realistic OKR data:

```
GET http://localhost:3000/api/dev/seed
```

Default credentials after seeding:
- **Admin:** `admin@seed.dev` / `admin123`
- **Team owners & members:** see the seed response for the full list (password: `password123`)

> The seed endpoint is disabled in production (`NODE_ENV === 'production'`).

---

## URL structure

| URL | Description |
|---|---|
| `/` | Company dashboard — all orgs, current year |
| `/orgs/[orgId]` | Org overview with all team scores |
| `/teams/[teamId]/[year]` | Annual OKR page (presentation view) |
| `/teams/[teamId]/[year]?edit` | Annual OKR page (edit mode) |
| `/teams/[teamId]/[year]/[quarter]` | Quarterly OKR page (presentation view) |
| `/teams/[teamId]/[year]/[quarter]?edit` | Quarterly OKR page (edit mode) |
| `/guide` | Company OKR guide and best practices |
| `/admin` | Admin panel — users, orgs, teams, archive |
| `/settings` | Workspace settings — branding, mission, guide |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | MongoDB via Mongoose |
| Auth | JWT via httpOnly cookie |
| Email | Resend (optional) |
| Testing | Jest + mongodb-memory-server · Playwright (e2e) |
| Font | Plus Jakarta Sans |

---

## Testing

```bash
# Unit + API tests (96 tests, ~16s)
npm test

# Type check
npx tsc --noEmit

# End-to-end tests (requires dev server on :3000)
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive Playwright UI
```

---

## Deployment

See [`docs/HOSTING.md`](docs/HOSTING.md) for a step-by-step guide to deploying on **Vercel + MongoDB Atlas** — both have free tiers that cover a demo or early-stage product at zero cost.

---

## Roadmap

### In progress / next
- **OKR alignment tree** — company-level visual showing how team OKRs roll up to org goals
- **AI writing assistance** — per-KR and per-objective critique, rewrite suggestions, and full-page OKR health check; see [`docs/AI_OKR_HELPER.md`](docs/AI_OKR_HELPER.md) for the full design plan (stubs in place, needs `ANTHROPIC_API_KEY`)

### Planned
- **Public share links** — read-only shareable URLs for OKR pages, no login required
- **Email notifications** — weekly digest, reminders for unpublished pages and stale scores
- **Comments & reactions** — inline discussion on objectives and key results
- **User batch import** — bulk-create users from CSV with onboarding email
- **Mobile polish** — improved layout for phone-sized screens
