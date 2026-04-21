# Hosting Plan — Vercel + MongoDB Atlas

## Overview

The app deploys to **Vercel** (serverless Next.js) backed by **MongoDB Atlas** (managed cloud Mongo).
Both have generous free tiers that cover a demo or early-stage product at zero cost.

---

## Step 1 — MongoDB Atlas

### Create a cluster
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign in / create an account.
2. Create a new **Project** (e.g. `okr-app`).
3. Build a **Free (M0) cluster** — pick the region closest to your Vercel deployment (e.g. `us-east-1`).
4. Name the cluster (e.g. `okr-prod`).

### Create a database user
1. In **Database Access**, click **Add New Database User**.
2. Choose **Password** auth. Save the username and a strong generated password — you'll use these in the connection string.
3. Grant role: **Atlas admin** (or `readWriteAnyDatabase` for least privilege).

### Allow network access
1. In **Network Access**, click **Add IP Address**.
2. Choose **Allow access from anywhere** (`0.0.0.0/0`) — required for Vercel's dynamic IPs.

### Get the connection string
1. In **Database → Connect**, choose **Drivers** → Node.js.
2. Copy the URI — it looks like:
   ```
   mongodb+srv://<user>:<password>@okr-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<password>` with your database user's password.
4. Append the database name: `…mongodb.net/okr-app?retryWrites=true&w=majority`

---

## Step 2 — Vercel

### Create the project
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project**.
3. Import your GitHub repository (`okr-app`).
4. Vercel auto-detects Next.js — leave all build settings as defaults.

### Set environment variables
In **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `MONGODB_URI` | Your Atlas connection string from Step 1 |
| `JWT_SECRET` | A random 32+ character secret (e.g. from `openssl rand -base64 32`) |

Set both variables for **Production**, **Preview**, and **Development** environments.

### Deploy
1. Click **Deploy**. Vercel builds and deploys automatically.
2. You'll get a URL like `https://okr-app-xyz.vercel.app`.

---

## Step 3 — First-run setup

1. Navigate to `https://your-vercel-url.vercel.app/register`.
2. Create your company workspace — this creates the first `tenant_owner` account.
3. Log in and go to **Admin** to create orgs, teams, and users.
4. Go to **Settings** to add your company logo, mission, and brand color.

> The dev seed endpoint (`/api/dev/seed`) is blocked in production — it only runs when `NODE_ENV !== 'production'`.

---

## Step 4 — Custom domain (optional)

1. In Vercel → **Settings → Domains**, add your domain (e.g. `okrs.yourcompany.com`).
2. Add the DNS records Vercel shows you (CNAME or A record) at your DNS provider.
3. Vercel provisions a TLS certificate automatically via Let's Encrypt.

---

## Ongoing

| Task | Where |
|---|---|
| Monitor errors | Vercel → Functions tab (real-time logs) |
| Scale database | Atlas → upgrade M0 → M10 when you need more storage/IOPS |
| Preview deploys | Every PR gets a preview URL automatically from Vercel |
| Rollback | Vercel → Deployments → click any past deploy → Promote |

---

## Cost at scale

| Tier | Vercel | Atlas | When |
|---|---|---|---|
| Demo / early | Free | Free (M0, 512 MB) | Up to ~50 users |
| Growing | Pro ($20/mo) | M10 ($57/mo) | 100–1000 users |
| Scale | Pro + more bandwidth | M30+ | 1000+ users |
