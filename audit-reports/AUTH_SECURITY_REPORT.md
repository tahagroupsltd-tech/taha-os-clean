# 🔴 PHASE 3 — Auth & Data Security Report
_Audit Date: 2026-05-26 | Second Pass Production Review_

> **Plain English for founders:** This section tests whether one user can see another user's private data, whether staff can access finance information they shouldn't, and whether your app is locked down properly.

---

## Summary Scorecard

| Category | Score | Status |
|---|---|---|
| Authentication (login, sessions) | 8/10 | ✅ Good |
| Role-based page access | 9/10 | ✅ Good (after fixes) |
| API endpoint protection | 6/10 | ⚠️ Fixed 2 critical gaps |
| Client data isolation | 7/10 | ⚠️ Partially fixed |
| Hardcoded secrets | 3/10 | 🔴 Needs manual action |
| **Overall Security** | **6.5/10** | **Needs work** |

---

## 🔴 CRITICAL — Requires Immediate Manual Action (cannot be auto-fixed)

### CRIT-1: Supabase Anon Key Hardcoded in Source Code
**Severity: CRITICAL**
**Files:** `src/lib/supa.ts`, `src/app/api/auth/login/route.ts`, `src/lib/gcal.ts`, `src/lib/gdrive.ts`

**What this means in plain English:**
Your database "front door key" is written in your source code. Anyone who views your code on GitHub (or inspects your deployed JavaScript bundle) can access your entire database. Since Row Level Security (RLS) is disabled, they can read, edit, or delete ALL user data.

**Status:** 🔴 NOT FIXED — requires your action

**Steps to fix:**
1. Go to [Vercel Dashboard → taha-os-clean → Settings → Environment Variables](https://vercel.com/dashboard)
2. Add `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (the full key)
3. Add `SUPABASE_URL` = `https://zmhmxfndzrrdmvvqblkx.supabase.co`
4. Remove the hardcoded fallback from `supa.ts` and `auth/login/route.ts` after confirming the env var works
5. If the key is already public (e.g. in a public GitHub repo), rotate it in Supabase dashboard immediately

---

### CRIT-2: Google OAuth Client Secret Committed
**Severity: CRITICAL**
**File:** `.env.local`, `.env.production.local`

**What this means:**
Your Google OAuth secret (`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`) is in version-controlled files. Anyone with repo access can impersonate your app on Google's servers.

**Status:** 🔴 NOT FIXED — requires your action

**Steps to fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Find your OAuth client → Generate a new secret → Revoke the old one
3. Add the new secret to Vercel Environment Variables only (never in code files)
4. Add `.env*.local` to `.gitignore` if not already there

---

### CRIT-3: JWT Secret Weak & Committed
**Severity: CRITICAL**
**File:** `.env` (committed to repo)

**What this means:**
Your JWT secret (`taha-media-secret-key-2026-afzal`) is weak, predictable, and in your repository. Anyone who has this can forge valid login tokens for ANY user including the founder account.

**Status:** 🔴 NOT FIXED — requires your action

**Steps to fix:**
1. Generate a strong 64-char secret: run `openssl rand -hex 32` in terminal
2. Add it to Vercel Environment Variables as `JWT_SECRET`
3. Remove from `.env` file (never commit secrets)
4. All existing sessions will be invalidated (users need to log in again — acceptable)

---

## 🔴 CRITICAL — Auto-Fixed

### CRIT-4: `/api/ai` — Zero Authentication ✅ FIXED
**Severity: CRITICAL → FIXED**

**What this meant:** Anyone on the internet could call your AI endpoint with no login required. If this endpoint ever calls OpenAI, they could exhaust your API credits.

**Fix applied:** Added `getUserFromRequest` auth guard — returns 401 for unauthenticated requests.

---

### CRIT-5: All CRM Routes — No Role Restriction ✅ FIXED
**Severity: CRITICAL → FIXED**

**What this meant:** Any logged-in CLIENT user could call `/api/crm/leads`, `/api/crm/deals`, `/api/crm/contacts`, `/api/crm/activities` and read your entire sales pipeline — deal values, prospect names, contact phone numbers.

**Fix applied:** Added `canViewCRM` guard (ADMIN and MANAGER only) to all 4 CRM routes (8 handler functions total).

---

## 🟡 HIGH — Code-Level Issues

### HIGH-1: CLIENT Tasks Filter is In-Memory, Not DB-Level
**Severity: HIGH**
**File:** `src/app/api/tasks/route.ts` L38-40

**What this means:** When a client user loads tasks, the server fetches ALL tasks from the database, then throws away the ones not belonging to that client. At 1000 tasks, this wastes 10x the bandwidth and is a data leak risk.

**Fix applied:** Added `limit: 200` as immediate protection. Full DB-level fix requires PostgREST RPC.

---

### HIGH-2: CLIENT Events Filter is In-Memory
**Severity: HIGH**
**File:** `src/app/api/events/route.ts` L37-39

Same issue as tasks — all events are fetched, then filtered client-side for CLIENT role.

---

### HIGH-3: No Rate Limiting on Login Endpoint
**Severity: HIGH**
**File:** `src/app/api/auth/login/route.ts`

**What this means:** An attacker can attempt unlimited password guesses with no slowdown or lockout. This is called a brute-force attack.

**Status:** Not fixed (requires Redis/Upstash or Vercel Edge Config for stateful rate limiting)

**Recommended fix:** Add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — free tier available.

---

### HIGH-4: No Input Sanitization on String Fields
**Severity: HIGH (Low risk at current scale)**

Tasks, content, and notes accept any string input with no length limits. A malicious user could store 1MB strings in title fields.

**Recommended fix:** Add `title.slice(0, 500)` type truncation in API routes.

---

## 🟡 MEDIUM Issues

### MED-1: Cookie Not Set to `SameSite=Strict`
**Severity: MEDIUM**
**File:** `src/lib/auth.ts` L62

Currently `sameSite: 'lax'`. Should be `'strict'` for maximum CSRF protection since the app doesn't rely on cross-site navigation.

### MED-2: `/api/debug` Is Public Path (bypasses middleware)
**Severity: MEDIUM**
**File:** `src/middleware.ts` L7

`/api/debug` is in `PUBLIC_PATHS` — the route itself has auth protection (ADMIN only), but the middleware skips it entirely. Low risk since the route re-checks auth, but inconsistent.

### MED-3: Webhook Route Has No Secret Validation
**Severity: MEDIUM**
**File:** `src/app/api/webhook/route.ts`

No check for `WEBHOOK_SECRET` header — any service can send fake webhook payloads.

### MED-4: No Password Complexity Requirements
**Severity: MEDIUM**
**File:** `src/app/api/auth/register/route.ts`

Passwords of any length/complexity are accepted. A 1-character password would work.

---

## ✅ What's Working Well

- JWT implementation using `jose` library — industry standard ✅
- bcrypt password hashing with cost factor 10 ✅
- `httpOnly` cookies — JavaScript can't steal the session token ✅
- Finance APIs locked to ADMIN only ✅
- User creation locked to ADMIN/MANAGER ✅
- Debug endpoint locked to ADMIN ✅
- Client data isolation on Projects API ✅
- Notes API — each user can only see their own notes ✅
- Reports API — staff see only their own, admins see all ✅
- Middleware blocks unauthenticated page access ✅
- Role-based page routing in middleware ✅
