# 🔐 Security Audit Report
**Project:** Taha Media OS  
**Audited:** 2026-05-24  
**Auditor:** Automated Engineering Audit  

---

## Summary

The app has **solid authentication logic** (JWT via httpOnly cookies, bcrypt password hashing, role-based permissions) but several serious issues were found relating to **secrets management** and **missing server-side route protection**. Most issues are fixable in under an hour.

---

## 🔴 CRITICAL Issues (Fix Immediately)

### 1. Supabase Anon Key Hardcoded in Source Code
**Files:** `src/lib/supa.ts`, `src/lib/gcal.ts`, `src/lib/gdrive.ts`  
**What it means:** The Supabase API key is written directly in your code. Anyone who can view the compiled JavaScript in the browser (or access your GitHub repo) can extract this key and use it to directly query your entire database — bypassing your login system entirely.  
**Why it's worse here:** Row Level Security (RLS) is disabled on all tables. Normally Supabase RLS limits what the anon key can access. With RLS off, the anon key has **full read/write access to all data**.  
**Fix applied:** Key now reads from `process.env.SUPABASE_ANON_KEY` with the hardcoded value as a temporary fallback.  
**Your action required:**
```
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add: SUPABASE_ANON_KEY = <your anon key>
3. Add: SUPABASE_URL = https://zmhmxfndzrrdmvvqblkx.supabase.co
4. Redeploy
```

### 2. No Server-Side Route Protection (No Middleware)
**What it means:** Previously, there was no `middleware.ts` file. This means dashboard pages were only protected by client-side JavaScript. A technical user could request `/dashboard` directly and bypass the login check.  
**Fix applied:** Created `middleware.ts` — all routes are now verified server-side at the network edge before any page loads. Unauthenticated requests are redirected to `/login`.

### 3. Debug Route Was Publicly Accessible
**File:** `src/app/api/debug/route.ts`  
**What it means:** Anyone on the internet could visit `https://taha-os-clean.vercel.app/api/debug` and see your server configuration (whether JWT secret is set, Node environment, user count, database connection status). This is information attackers use to plan further attacks.  
**Fix applied:** Route now requires ADMIN login.

---

## 🟠 HIGH Severity

### 4. Weak JWT Secret
**File:** `.env`, `.env.local`  
**Current value:** `taha-media-secret-key-2026-afzal`  
**What it means:** Your JWT secret is the "master key" to your login system. If someone knows it, they can forge login tokens for any user including admin. This secret is guessable (contains your name and year).  
**Your action required:**
```bash
# Generate a strong secret (run in your terminal):
openssl rand -base64 32
# Then set JWT_SECRET=<result> in Vercel environment variables
```

### 5. No Rate Limiting on API Routes
**What it means:** Someone could try thousands of passwords on your `/api/auth/login` endpoint in minutes (brute force attack). There is currently no protection against this.  
**Recommended fix:** Add rate limiting to the login route. Easiest option on Vercel is to use the `@upstash/ratelimit` package with a free Upstash Redis account (free tier is enough).
```typescript
// Install: npm install @upstash/ratelimit @upstash/redis
// Add to /api/auth/login — 5 attempts per IP per minute
```

### 6. Scratch Debug Scripts Committed to Git
**Files:** `scratch/*.js` (21 files committed)  
**What it means:** Debug scripts containing your Supabase API key and test data are permanently saved in your git history. Even if you delete them, they remain visible in old commits.  
**Fix applied:** Updated `.gitignore` to exclude `scratch/` going forward.  
**Your action required:** Remove from git history:
```bash
git rm -r --cached scratch/
git commit -m "chore: remove scratch debug files from version control"
```

---

## 🟡 MEDIUM Severity

### 7. 30 API Routes Without Error Handling (no try/catch)
**What it means:** If anything unexpected happens in these routes (database down, bad data), the server crashes with a raw error message that may expose internal file paths and logic to the user.  
**Affected routes:** `tasks`, `projects`, `transactions`, `invoices`, `loans`, `notes`, `notifications`, `users`, `time-logs`, and more.  
**Recommended fix:** Wrap all route handlers in try/catch. Example pattern:
```typescript
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // ... your logic ...
  } catch (err: any) {
    console.error('[route-name] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 8. Missing Content-Security-Policy and HSTS Headers
**What it means:** Without these headers, browsers allow your site to be embedded in iframes (phishing risk) and don't enforce HTTPS strictly.  
**Fix applied:** Both headers added to `next.config.mjs`.

### 9. Error Boundary Exposes Stack Traces to Users
**File:** `src/app/error.tsx`  
**What it means:** When an error occurs, the full stack trace (internal file paths, line numbers) is displayed to the user. This helps attackers understand your app's internals.  
**Recommended fix:** Show a friendly error message in production; only show details in development:
```typescript
{process.env.NODE_ENV === 'development' && error?.stack && (
  <pre>{error.stack}</pre>
)}
```

---

## 🟢 LOW Severity / Informational

### 10. `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` Must Never Be Set in Production
**Status:** Correctly gated by env var. Confirm it is NOT set in Vercel production environment variables.

### 11. 80 Uses of TypeScript `any` Type in API Routes
**What it means:** Using `any` bypasses TypeScript's safety checks, increasing the chance of bugs slipping through.  
**Recommended fix:** Gradually replace with proper types. Not urgent.

### 12. Google OAuth Secret in .env.local
**Status:** `.env.local` is in `.gitignore` so it is NOT committed to git. The current credentials are safe. However, rotate the Google OAuth secret periodically as good practice.

---

## ✅ What's Already Done Well

- ✅ Passwords hashed with bcrypt (cost factor 10)
- ✅ JWT stored in httpOnly cookies (XSS-resistant)
- ✅ Cookie set to `secure: true` in production
- ✅ `SameSite: lax` on session cookie (CSRF protection)
- ✅ Role-based access control (RBAC) is well-designed and centralised in `permissions.ts`
- ✅ Webhook uses timing-safe bearer token comparison
- ✅ No raw SQL (no SQL injection risk)
- ✅ X-Frame-Options, X-Content-Type-Options headers were already present
- ✅ `server-only` import guard on gcal.ts and gdrive.ts

---

## Action Priority Order

| Priority | Action | Time |
|----------|--------|------|
| 🔴 Do today | Set `SUPABASE_ANON_KEY` in Vercel env vars | 5 min |
| 🔴 Do today | Set a strong `JWT_SECRET` in Vercel | 2 min |
| 🟠 This week | Add rate limiting to login route | 30 min |
| 🟠 This week | Remove scratch/ from git history | 10 min |
| 🟡 Next sprint | Wrap all routes in try/catch | 2 hours |
| 🟡 Next sprint | Replace error.tsx stack trace in production | 15 min |
| 🟢 Eventually | Replace `any` types with proper TypeScript | ongoing |
