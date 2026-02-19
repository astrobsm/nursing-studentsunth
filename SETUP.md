# 2nd Year Nursing Quiz — Setup & Deployment Guide

## Table of Contents
1. [Quick Start (Local Only)](#quick-start-local-only)
2. [Supabase Backend Setup](#supabase-backend-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Database Schema](#database-schema)
6. [Architecture Overview](#architecture-overview)

---

## Quick Start (Local Only)

The app works **immediately without Supabase** using browser `localStorage`. This is perfect for testing or a single-device setup.

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:3000
```

Admin page: Go to `/admin` and enter password **blackvelvet**

---

## Supabase Backend Setup

Supabase provides cloud-hosted PostgreSQL, enabling multi-device results collection and persistent storage.

### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up (free tier available)
2. Click **New Project**
3. Choose an organization, name your project (e.g., `nursing-quiz`), set a database password, and pick a region close to your users
4. Wait for the project to finish provisioning (~2 minutes)

### Step 2: Run Database Migrations

**Option A — Supabase Dashboard (recommended for beginners):**

1. In your Supabase project, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql` and paste it into the editor
4. Click **Run** — you should see "Success. No rows returned."
5. (Optional) Repeat with `supabase/migrations/002_seed_data.sql` to add test data

**Option B — Supabase CLI:**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project (find project ref in your Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### Step 3: Get API Keys

1. In Supabase dashboard, go to **Settings → API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ The `service_role` key has **full database access** — never expose it client-side.

### Step 4: Configure Environment

```bash
# Copy the example env file
copy .env.example .env.local

# Edit .env.local with your actual keys
notepad .env.local
```

Fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
ADMIN_PASSWORD=blackvelvet
```

### Step 5: Verify

```bash
npm run dev
```

- Take a quiz → results should appear in both localStorage AND your Supabase `attempts` table
- Admin page will show "☁️ (Supabase)" if fetching from the database

---

## Vercel Deployment

### Option A — PowerShell Deploy Script

```powershell
# First time (interactive, creates Vercel project)
.\deploy.ps1

# Production deployment
.\deploy.ps1 -Production
```

### Option B — Manual Vercel Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow prompts)
vercel

# Or deploy to production
vercel --prod
```

### Option C — Git Integration (Recommended for CI/CD)

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Vercel auto-detects Next.js — just click **Deploy**
5. Every push to `main` auto-deploys to production

### Set Environment Variables on Vercel

**This step is required for Supabase to work in production.**

1. Go to [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview, Development |
| `ADMIN_PASSWORD` | `blackvelvet` | Production, Preview, Development |

3. **Redeploy** after adding variables (Settings → Deployments → click ••• on latest → Redeploy)

---

## Environment Variables Reference

| Variable | Required | Where Used | Description |
|----------|----------|------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Client + Server | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | Server only | Supabase service role key (full access) |
| `ADMIN_PASSWORD` | No | Server only | Override admin password (defaults to `blackvelvet`) |

**\* If not set, the app works with localStorage only — no data persists across devices or after clearing browser data.**

---

## Database Schema

### Tables

**`candidates`**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| full_name | TEXT | Candidate's full name |
| student_id | TEXT (UNIQUE) | Student ID number |
| email | TEXT | Email address |
| created_at | TIMESTAMPTZ | Registration timestamp |

**`attempts`**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| candidate_id | UUID (FK) | References candidates |
| total_questions | INT | Number of questions (20) |
| correct_answers | INT | Number correct |
| percentage | INT | Score percentage |
| time_taken | INT | Seconds taken |
| tab_switches | INT | Number of tab switches |
| answers | JSONB | Question ID → answer map |
| submitted_at | TIMESTAMPTZ | Server timestamp |

**`cheating_events`**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| attempt_id | UUID (FK) | References attempts |
| candidate_id | UUID (FK) | References candidates |
| event_type | TEXT | e.g. tab_switch, copy_attempt |
| details | TEXT | Human-readable description |
| occurred_at | TIMESTAMPTZ | When the event happened |

### Views

- **`ranked_results`** — All attempts joined with candidates, ranked by percentage DESC
- **`cheating_summary`** — Per-candidate summary of cheating event counts by type

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  BROWSER (Next.js)                   │
│                                                      │
│  Home → Instructions → Quiz → Results                │
│                                                      │
│  localStorage (always)  ←→  quiz-store.ts            │
│  Supabase API (if configured) ←→ fetch("/api/...")   │
│                                                      │
│  Admin Page → password gate → results table + PDF    │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/submit
                       │ POST /api/candidates
                       │ POST /api/admin/results
                       ▼
┌─────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES (Server)             │
│                                                      │
│  /api/candidates   → upsert candidate                │
│  /api/submit       → save attempt + cheating events  │
│  /api/admin/results → fetch all results (authed)     │
│                                                      │
│  Uses SUPABASE_SERVICE_ROLE_KEY (server only)        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 SUPABASE (PostgreSQL)                 │
│                                                      │
│  candidates │ attempts │ cheating_events              │
│  RLS policies for row-level security                 │
│  Views: ranked_results, cheating_summary             │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **Candidate registers** → saved to localStorage; if Supabase configured, also POSTed to `/api/candidates`
2. **Quiz submitted** → graded locally, saved to localStorage + all-results collection; POSTed to `/api/submit` which creates an attempt + cheating events in Supabase
3. **Admin views results** → page tries `/api/admin/results` first (Supabase); falls back to localStorage. Shows data source indicator (☁️/💾)
4. **PDF export** → generated client-side with jsPDF from whatever data is displayed

### Offline-First Design

The app works **completely offline** after the initial page load:
- All questions are bundled in the JS bundle (`src/data/questions.json`)
- State and results are persisted to `localStorage`
- Supabase sync is fire-and-forget — if it fails, the local result is still saved
- Anti-cheat runs entirely client-side

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin page shows "💾 (Local)" even with Supabase | Check that env vars are set and restart the dev server |
| "Missing Supabase server environment variables" error | Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` |
| Quiz results not appearing in Supabase | Verify migrations were run; check Supabase `attempts` table |
| Port 3000 in use | Use `npm run dev -- -p 3001` |
| Build fails with SWC errors | Run `npm rebuild` then `npm run build` |
