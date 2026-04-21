# OKR Manager

Getting teams to align on plans and goals is one of the hardest problems in any organization. Priorities shift, commitments go undocumented, and by the time a quarter ends it's often unclear what was actually agreed to — or why.

OKRs (Objectives & Key Results) are an industry-tested framework for solving exactly this. They give teams a shared language for defining what they'll work on, what they'll trade off, and how they'll measure success. When done well, OKRs make strategy visible and accountability mutual.

This tool brings that discipline to any sized organization — from a two-team startup to a multi-org enterprise — without the overhead of spreadsheets or expensive SaaS subscriptions.

---

## Features

### For Organizations
- **Multi-org, multi-team support** — manage multiple organizations, each with their own teams and OKR hierarchies
- **Org & team branding** — upload custom icons for organizations and teams
- **Company dashboard** — a single view across all orgs and teams for the current year, with live scores and status badges
- **Multi-tenant isolation** — complete data separation between workspaces; no cross-tenant data leakage

### For Teams
- **Annual & quarterly OKR pages** — quarterly pages are automatically linked to their annual parent
- **Objectives & Key Results** — define measurable key results with start, target, and current values; assign owners
- **Scoring** — KR scores (0–1) roll up to objectives, which roll up to the page; color-coded at every level
- **Draft → Publish workflow** — pages stay in draft until the team is ready; published pages are read-only
- **Auto-save** — changes are saved automatically every few seconds with a local draft backup

### For Reviews
- **Presentation view** — a clean, full-screen view designed for team review meetings; default mode for non-owners
- **Edit mode** — owners enter edit mode explicitly via `?edit` in the URL; presentation is the default
- **Score sparklines** — per-objective trend charts show score progression over the period
- **Tracking projection** — a ghost arc on the score ring shows where the team is projected to land at period-end based on current pace
- **Score coloring** — five-tier visual scale from red (0–0.29) through amber to deep green (0.8–1.0)

### For Admins
- **User management** — create users, assign team memberships and roles
- **Role-based access** — admins have full access; team owners can edit; members get read-only presentation view
- **Archive & restore** — archive orgs, teams, or entire years without losing data; restore anything within four years
- **Data reset** — full OKR data reset with credential confirmation, preserving archive history

### Quality of Life
- **Dark mode** — full dark mode support, follows system preference with manual toggle

---

## Roles

| Role | What they can do |
|---|---|
| **Admin** | Full access — manage orgs, teams, users, and all OKR data |
| **Team Owner** | Create, edit, and publish OKRs for their team |
| **Member** | Read-only access; sees the presentation view by default |

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

Open [http://localhost:3000](http://localhost:3000) and register — the first user automatically becomes the workspace owner.

### Seed Data (Development Only)

To populate the app with realistic data across two organizations, seven teams, and three years of OKRs:

```
GET http://localhost:3000/api/dev/seed
```

Default credentials after seeding:
- **Admin:** `admin@seed.dev` / `admin123`
- **Team owners & members:** see the seed response for all accounts (password: `password123`)

> The seed endpoint is blocked in production (`NODE_ENV === 'production'`).

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** MongoDB via Mongoose
- **Auth:** JWT via httpOnly cookie
- **Testing:** Jest + mongodb-memory-server (API/unit), Playwright (e2e)

---

## Testing

```bash
# API + unit tests
npm test

# Type check
npx tsc --noEmit

# End-to-end tests (requires dev server running)
npm run dev
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive
```

---

## URL Structure

| URL | Description |
|---|---|
| `/` | Company dashboard — all orgs, current year |
| `/orgs/[orgId]` | Org overview |
| `/teams/[teamId]/[year]` | Annual OKR page (presentation view) |
| `/teams/[teamId]/[year]?edit` | Annual OKR page (edit mode) |
| `/teams/[teamId]/[year]/[quarter]` | Quarterly OKR page (presentation view) |
| `/teams/[teamId]/[year]/[quarter]?edit` | Quarterly OKR page (edit mode) |
| `/admin` | Admin panel — users, orgs, teams |
| `/settings` | Workspace settings — branding, mission |

---

## Deployment

See [`docs/HOSTING.md`](docs/HOSTING.md) for a step-by-step guide to deploying on **Vercel + MongoDB Atlas** — both have free tiers that cover a demo or early-stage product at zero cost.

---

## Roadmap

- **Search** — full-text search across objectives and key results, filterable by org, team, period, and score
- **Batch import / export** — upload OKRs via CSV; export any team or org's data to PDF or CSV
- **AI writing assistance** — suggestions for objectives and key results, plus quality critique on KR measurability
- **OKR alignment** — link objectives across teams to surface dependencies and shared commitments
- **Notifications** — reminders for unpublished pages, stale scores, and approaching period deadlines
- **Password reset** — self-service password recovery flow
