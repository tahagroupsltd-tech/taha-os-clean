# 🐛 Bug Report
**Project:** Taha Media OS  
**Audited:** 2026-05-24  

---

## Summary

Most critical bugs (React hooks violations causing "Unexpected error" on pages) were fixed in the previous session. This report covers **remaining bugs** found during the full system audit.

---

## 🔴 Critical Bugs

### BUG-001: Unhandled Promise Rejections in Frontend Fetch Calls
**Severity:** High  
**Files affected:** `ai-tools/page.tsx`, `content/page.tsx`, `tasks/page.tsx`, `finance/page.tsx`, `reports/page.tsx`, `sop/page.tsx`

**What happens:** Multiple `fetch().then()` chains have no `.catch()` handler. If the network is slow, the API is down, or returns an error, these calls fail silently — the page shows stale or empty data with no error message to the user.

**Example of the problem:**
```typescript
// ❌ BAD — silent failure
fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
```

**How to fix:**
```typescript
// ✅ GOOD — user sees an error or retry option
fetch('/api/projects')
  .then(r => r.json())
  .then(j => setProjects(j.data ?? []))
  .catch(err => {
    console.error('Failed to load projects:', err)
    toast.error('Could not load projects — please refresh')
  })
```

---

### BUG-002: 30 API Routes Will Crash on Database Errors
**Severity:** High  
**Files:** `tasks/route.ts`, `projects/route.ts`, `transactions/route.ts`, `invoices/route.ts`, `loans/route.ts`, `notes/route.ts`, `notifications/route.ts`, `users/[id]/route.ts`, `time-logs/route.ts`, and 21 more.

**What happens:** If Supabase is temporarily unreachable (it happens), these routes throw an unhandled exception. Next.js catches it and returns a generic 500 error, but the raw error message (including internal stack traces) may be included in the response.

**How to fix:** Wrap all route handlers in a `try/catch` block. Pattern:
```typescript
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // ... logic ...
    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error('[tasks GET]', err)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
```

---

## 🟠 High Bugs

### BUG-003: No ESLint Configuration
**Severity:** High  
**What happens:** The project has no `.eslintrc` file. Running `npm run lint` prompts an interactive setup wizard instead of running. This means lint errors go undetected — import mistakes, unused variables, and hook rule violations won't be caught.  
**Fix applied:** Created `.eslintrc.json` with Next.js recommended rules.

### BUG-004: `ai` Route Has No Authentication
**File:** `src/app/api/ai/route.ts`  
**What happens:** The `/api/ai` endpoint accepts POST requests without verifying the caller is logged in. Anyone can call this endpoint.  
**Note:** The route currently returns hardcoded mock data (not a real AI call), so the immediate impact is low, but it should be protected.

### BUG-005: Register Route Fetches All Users for Uniqueness Check
**File:** `src/app/api/auth/register/route.ts`  
**What happens:** When creating a new team member, the route fetches the **entire users table** into memory to check for duplicate usernames/emails. With 1,000 users this is very inefficient.  
**How to fix:** Use a targeted filter:
```typescript
// ✅ Instead of fetching all users, query for the specific conflict:
const conflictByUsername = await sbFindOne('users', { filters: { username: `eq.${cleanUsername}` } })
```

---

## 🟡 Medium Bugs

### BUG-006: Finance Page Shows `NaN` When Amount Is Empty
**What likely happens:** The finance transaction form allows submitting with an invalid amount string, which `parseFloat()` converts to `NaN`. This corrupts the transaction record in the database.  
**Validation exists** on the API side but the frontend form allows submission without full validation.

### BUG-007: Missing `WHATSAPP_WEBHOOK_URL` Environment Variable
**Found in:** Source code references `process.env.WHATSAPP_WEBHOOK_URL` but it's not in `.env.example` and not documented.  
**Impact:** Any feature using WhatsApp notifications will silently fail.  
**Fix:** Add `WHATSAPP_WEBHOOK_URL` to `.env.example`.

### BUG-008: Logout Route Doesn't Clear Cookie Properly in All Browsers
**File:** `src/app/api/auth/logout/route.ts`  
**Issue:** The logout route sets `httpOnly: true` but doesn't set `secure` or `sameSite`. Some browsers may not properly delete the cookie.  
**How to fix:**
```typescript
response.cookies.set(COOKIE_NAME, '', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  expires: new Date(0),
  path: '/',
})
```

### BUG-009: Error Boundary Shows Raw Stack Traces in Production
**File:** `src/app/error.tsx`  
**Issue:** When any page crashes, the full technical error stack trace is displayed to the user. This is helpful in development but should be hidden in production.

---

## 🟢 Minor / Informational

### BUG-010: Dead Code — Unused Exports
These functions are exported but never imported anywhere:
- `SkeletonPage` in `src/components/ui/Skeleton.tsx`
- `extractFolderId` in `src/lib/gdrive.ts`
- `canFullyEditTasks` and `canFullyEditContent` in `src/lib/permissions.ts`

These can be safely removed to keep the codebase clean.

### BUG-011: Scratch Files Committed to Git
**Files:** 21 debug/test scripts in `scratch/` directory  
**Issue:** These are one-off debugging scripts that should never have been committed. They contain database credentials and are not part of the application.  
**Fix applied:** Updated `.gitignore` to exclude `scratch/`.

---

## Previously Fixed Bugs (This Session)

These were the bugs causing the "Unexpected error" error boundaries on multiple pages:

| Bug | File | Fix |
|-----|------|-----|
| React hooks violation (error #310) | `calendar/page.tsx` | Moved hooks before early returns |
| React hooks violation (error #310) | `content/page.tsx` | Moved hooks before early returns |
| React hooks violation (error #310) | `projects/page.tsx` | Moved hooks before early returns |
| React hooks violation (error #310) | `ActiveClientsSidebar.tsx` | Moved hooks before early returns |
| SSR hydration mismatch | `overview/page.tsx` | Created `OverviewTopBar` client component |
| ICU locale mismatch | `utils.ts` | Replaced `Intl.NumberFormat` with manual formatter |

---

## Testing Checklist

Before considering the app production-ready, manually verify:

- [ ] Login with wrong password shows error (doesn't crash)
- [ ] Accessing `/overview` while logged out redirects to `/login`
- [ ] Creating a task without a title shows validation error
- [ ] Deleting a project shows a confirmation prompt
- [ ] Finance page loads correctly for ADMIN role
- [ ] Client role cannot see Finance or Team pages
- [ ] Logging out clears the session and redirects to login
- [ ] Chat assistant responds when OpenAI key is set
- [ ] Calendar shows events in correct timezone (IST)
- [ ] Notifications bell shows unread count
