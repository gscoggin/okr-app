# OKR Manager

Getting teams to align on plans and goals is one of the hardest problems in any organization. Priorities shift, commitments go undocumented, and by the time a quarter ends it's often unclear what was actually agreed to — or why.

OKRs (Objectives & Key Results) are an industry-tested framework for solving exactly this. They give teams a shared language for defining what they'll work on, what they'll trade off, and how they'll measure success. When done well, OKRs make strategy visible and accountability mutual.

This tool was built to bring that discipline to any sized organization — from a two-team startup to a multi-org enterprise — without the overhead of spreadsheets or expensive SaaS subscriptions.

---

## Features

### For Organizations
- **Multi-org support** — manage multiple organizations, each with their own teams and OKR hierarchies
- **Org & team branding** — upload custom icons for organizations and team badges
- **Company dashboard** — a single view across all orgs and teams for the current year, with live scores

### For Teams
- **Annual & quarterly OKR pages** — quarterly pages are linked to their annual parent automatically
- **Objectives & Key Results** — add objectives with owners, then define measurable key results with start, target, and current values
- **Scoring** — KR scores (0–1) roll up to objectives, which roll up to the page. Color-coded at every level
- **Draft → Publish workflow** — pages stay in draft until the team is ready. Published pages are locked from editing
- **Auto-save** — changes are saved automatically every few seconds, with a local draft backup

### For Reviews
- **Presentation view** — a clean, distraction-free view of any team's OKR page designed for team review meetings. Objectives and KRs are displayed with scores, owners, and comments. KRs are collapsible per objective
- **Score coloring** — five-tier visual scale from blood red (0–0.29) through amber (0.5–0.69) to deep green (0.8–1.0), so health is readable at a glance

### For Admins
- **User management** — create users, assign team memberships and roles
- **Role-based access** — admins have full access; team owners can edit their team's OKRs; members get a read-only presentation view
- **Archive & restore** — archive orgs, teams, or entire years without losing data. Restore anything within four years
- **Data reset** — full OKR data reset with credential confirmation, preserving archive history

---

## Roles

| Role | What they can do |
|---|---|
| **Admin** | Full access — manage orgs, teams, users, and all OKR data |
| **Team Owner** | Create, edit, and publish OKRs for their team |
| **Member** | Read-only access; automatically routed to the presentation view |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.local.example .env.local
# → Set MONGODB_URI and JWT_SECRET in .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register — the first user automatically becomes an admin.

### Seed Data (Development)

To populate the app with realistic data across two organizations, seven teams, and three years of OKRs:

```
GET http://localhost:3000/api/dev/seed
```

Default credentials after seeding:
- **Admin:** `admin@seed.dev` / `admin123`
- **Team owners & members:** see seed summary response for all accounts (password: `password123`)

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** MongoDB via Mongoose
- **Auth:** JWT via httpOnly cookie

---

## Testing

```bash
# API / unit tests (Jest)
npm test

# Browser / end-to-end tests (Playwright)
npm run dev          # must be running
npm run test:e2e     # headless
npm run test:e2e:ui  # interactive UI mode
```

---

## URL Structure

| URL | Description |
|---|---|
| `/` | Company dashboard — all orgs, current year |
| `/orgs/[orgId]` | Org overview |
| `/teams/[teamId]/[year]` | Annual OKR page |
| `/teams/[teamId]/[year]/[quarter]` | Quarterly OKR page |
| `/teams/[teamId]/[year]/present` | Annual presentation view |
| `/teams/[teamId]/[year]/[quarter]/present` | Quarterly presentation view |
| `/admin` | Admin panel |

---

## Roadmap

- **Search** — full-text search across objectives and key results, filterable by org, team, period, and score range
- **Batch import / export** — upload OKRs via CSV or spreadsheet; export any team or org's OKRs to PDF or CSV for offline sharing
- **AI writing assistance** — AI-powered suggestions for objectives and key results, plus quality critique on KR measurability and clarity
- **OKR alignment** — link objectives across teams to surface dependencies and shared commitments
- **Historical trend views** — score progression charts across quarters and years
- **Notifications** — reminders for unpublished pages, stale scores, and approaching period deadlines
