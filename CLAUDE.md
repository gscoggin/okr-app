# okr-app

OKR (Objectives & Key Results) management web app — Next.js 15, TypeScript strict, Tailwind CSS v4, MongoDB/Mongoose.

## Stack

- **Framework:** Next.js 15 App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (httpOnly cookie) — extensible to Okta/OIDC by swapping `src/lib/auth.ts`

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npx tsc --noEmit   # Type check
```

## Setup

1. Copy `.env.local.example` → `.env.local` and fill in `MONGODB_URI` and `JWT_SECRET`
2. Run `npm install`
3. Run `npm run dev`
4. Register the first user at `/register` — automatically becomes admin

## Key directories

```
src/
  app/
    (auth)/          — Login, register pages (no sidebar layout)
    (dashboard)/     — Main app: company dashboard, org views, team OKR pages
    api/             — All API routes (auth, orgs, teams, okr-pages, objectives, key-results, users)
  components/
    AuthProvider.tsx — Client-side auth context
    nav/             — Topbar, Sidebar, PeriodNav
    okr/             — OKRPageEditor, ObjectiveCard, KeyResultRow
    ui/              — ScoreBadge, ConfidenceBadge, OwnerPicker
  lib/               — mongodb.ts, auth.ts, apiUtils.ts
  models/            — Mongoose models: User, Org, Team, OKRPage, Objective, KeyResult
  types/             — Shared TypeScript types + scoring helpers
```

## URL structure

- `/` — Company dashboard (all orgs, current year)
- `/orgs/[orgId]` — Org overview
- `/teams/[teamId]` — Redirects to current period
- `/teams/[teamId]/2025` — Annual OKR page
- `/teams/[teamId]/2025-q1` — Quarterly OKR page

## Scoring

- KR scores (0–1) → averaged to Objective score → averaged to Page score
- Score colors: ≥0.7 = green, ≥0.4 = yellow, <0.4 = red
- Confidence: high/medium/low with matching colours

## Permissions

- `admin` — full access to everything
- `member` + `team_owner` in `teamMemberships` — edit rights for that team
- Published OKRs cannot be edited
- Cannot publish if any KR has no owner

## Phase 2 TODOs (AI features)

Search for `TODO Phase 2` in the codebase to find all AI integration stubs:
- `src/components/okr/OKRPageEditor.tsx` — AI objective suggestions
- `src/components/okr/ObjectiveCard.tsx` — AI objective feedback
- `src/components/okr/KeyResultRow.tsx` — AI KR quality critique
- Requires `ANTHROPIC_API_KEY` in `.env.local`
