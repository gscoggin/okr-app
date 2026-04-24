# Demo Deployment Playbook

## Overview

Two separate Vercel projects, one shared GitHub repo:

| | Production | Demo |
|---|---|---|
| Branch | `main` | `demo` |
| Database | `okr-app` (Atlas) | `okr-demo` (same Atlas cluster) |
| URL | `<prod-url>` | `https://okr-app-demo-git-demo-gscoggins-projects.vercel.app` |
| `IS_DEMO_DEPLOYMENT` | not set | `true` |

---

## Deploying a new version

### Production
```
git push origin main
```
Vercel auto-deploys. Done.

### Demo
```
git checkout demo
git merge main
git push origin demo
git checkout main
```
Vercel auto-deploys the demo branch. **No manual seeding needed** — the first visitor to `/demo` triggers auto-seed if the demo database is empty.

---

## How the demo works

1. Visitor clicks "explore the demo" on the production login page
2. Browser navigates to `<demo-url>/demo`
3. `/demo` page calls `GET /api/demo/session`
4. If demo database is empty, seed runs automatically (first visit only, ~3s)
5. A short-lived JWT is issued and set as an httpOnly cookie
6. Visitor is redirected to the demo dashboard — no login required

The seed is idempotent — safe to run multiple times. Run "Refresh demo data" in `/admin` at the start of each quarter to update period-aware OKR data.

---

## Vercel environment variables

### Production project
| Variable | Value |
|---|---|
| `MONGODB_URI` | `...mongodb.net/okr-app?...` |
| `JWT_SECRET` | your secret |
| `NEXT_PUBLIC_APP_URL` | prod URL |
| `NEXT_PUBLIC_DEMO_URL` | `https://okr-app-demo-git-demo-gscoggins-projects.vercel.app` |
| `RESEND_API_KEY` | Resend key |
| `EMAIL_FROM` | sender address |
| `ADMIN_NOTIFICATION_EMAIL` | your email |

### Demo project
| Variable | Value | Scope |
|---|---|---|
| `MONGODB_URI` | `...mongodb.net/okr-demo?...` | Production + Preview |
| `JWT_SECRET` | any secret | Production + Preview |
| `IS_DEMO_DEPLOYMENT` | `true` | Production + Preview |
| `NEXT_PUBLIC_APP_URL` | demo URL | Production + Preview |

**Important:** Vercel Authentication must be **disabled** on the demo project (Settings → Deployment Protection) so public visitors can access it without a Vercel account.

---

## Troubleshooting

**"Demo isn't available right now"**
- Check `IS_DEMO_DEPLOYMENT=true` is set in demo Vercel project (Production scope)
- Redeploy after adding/changing env vars

**Demo link on login page not showing**
- Check `NEXT_PUBLIC_DEMO_URL` is set in production Vercel project
- `NEXT_PUBLIC_` vars are baked in at build time — redeploy after changing

**Demo link redirects to Vercel login**
- Vercel Authentication is still enabled on the demo project
- Go to demo project → Settings → Deployment Protection → disable

**Demo data looks stale**
- Log into demo as admin, go to `/admin`, click "Refresh demo data"
- Do this at the start of each quarter

---

## Quarterly maintenance

At the start of each quarter:
1. Merge `main` → `demo` and push (picks up any new features)
2. Log into demo as your admin account
3. Go to `/admin` → "Refresh demo data"
4. Verify `/demo` loads correctly in incognito
