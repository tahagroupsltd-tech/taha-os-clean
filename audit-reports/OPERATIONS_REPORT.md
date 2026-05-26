# ⚙️ PHASE 5 — DevOps & Operations Report
_Audit Date: 2026-05-26 | Second Pass Production Review_

> **Plain English:** Is your deployment process safe? Can you recover if something breaks? Do you know when things go wrong?

---

## Current DevOps State

| Area | Status | Score |
|---|---|---|
| Deployment process | Vercel CLI (`vercel deploy --prod`) | ✅ Works |
| Rollback capability | Vercel dashboard → previous deployments | ✅ Available |
| Environment separation | Dev/Prod same Supabase project | 🔴 Risk |
| Error monitoring | None | 🔴 Missing |
| Uptime monitoring | None | 🔴 Missing |
| Logging | `console.error` only | ⚠️ Minimal |
| Backup strategy | Supabase automated backups (free tier = 1 day) | ⚠️ Risky |
| CI/CD pipeline | None — manual deploy | ⚠️ Manual |
| Secret rotation | No process defined | 🔴 Missing |

---

## 5.1 — Environment Separation 🔴

### Problem
Development and production appear to use the **same Supabase project** (`zmhmxfndzrrdmvvqblkx`). This means:
- Testing deletes production data
- A dev mistake can corrupt real client data
- No safe place to test migrations

### Recommended Fix
Create a separate Supabase project for development. Takes 5 minutes, free tier allows 2 projects.

---

## 5.2 — No Error Monitoring 🔴

### Problem
When something breaks in production (API fails, JavaScript crashes, database error), you find out when a client complains. There's no automatic alert system.

### Recommended Fix: Sentry (Free Tier)

**Cost:** Free for up to 5,000 errors/month

**Setup (15 minutes):**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Then add `SENTRY_DSN` to Vercel environment variables.

**What you get:**
- Instant email/Slack alert when any error occurs
- Full stack trace with the exact line that crashed
- User context (which user triggered the error)
- Performance monitoring

---

## 5.3 — No Uptime Monitoring 🔴

### Problem
If your app goes down at 2am, you won't know until morning. Your clients will be frustrated.

### Recommended Fix: Better Uptime or UptimeRobot (Free)

**Cost:** Free

**Setup (5 minutes):**
1. Go to [betteruptime.com](https://betteruptime.com) or [uptimerobot.com](https://uptimerobot.com)
2. Add monitor for `https://taha-os-clean.vercel.app`
3. Set check interval: every 5 minutes
4. Add your phone number for SMS alerts

---

## 5.4 — Backup Strategy ⚠️

### Current State
Supabase free tier includes **1-day point-in-time backups**. If data is accidentally deleted and you don't notice within 24 hours, it's permanently gone.

### Recommended Fix
Upgrade to Supabase Pro ($25/mo) for 7-day backups. Alternatively, set up a weekly database export using Supabase CLI:
```bash
supabase db dump --db-url "your-connection-string" > backup_$(date +%Y%m%d).sql
```

Schedule this as a weekly GitHub Action or cron job.

---

## 5.5 — Deployment Process ⚠️

### Current State
Deployments are done manually via `vercel deploy --prod`. This means:
- No automated tests before deployment
- Human error can deploy broken code
- No staging environment to test first

### Recommended CI/CD Setup (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build  # Fails fast if build breaks
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**What this gives you:**
- Automatic deployment on every git push
- Build failure stops deployment automatically
- Full audit trail of what was deployed and when

---

## 5.6 — Logging Quality ⚠️

### Current State
Errors are logged with `console.error` which appears in Vercel function logs. This is readable but:
- No structured format (hard to search)
- No log retention beyond 1 day on free tier
- No alerting on specific error patterns

### Recommended Improvement
Add structured logging with request context:
```typescript
// Instead of:
console.error('[CRM leads GET]', err)

// Use:
console.error(JSON.stringify({
  event: 'crm_leads_get_failed',
  userId: user?.id,
  error: err?.message,
  timestamp: new Date().toISOString()
}))
```

---

## 5.7 — Secret Rotation Process 🔴

### Problem
No process exists for rotating secrets. If the JWT secret or Supabase key is compromised, there's no documented procedure for rotating them safely.

### Recommended Process
Document and practice:
1. Generate new secret
2. Add to Vercel as new env var
3. Deploy with new secret
4. Monitor error rate (old tokens will be invalid — users re-login)
5. Remove old secret

---

## Priority Actions

### 🔴 Do This Week
1. Set up Sentry (free, 15 minutes)
2. Set up UptimeRobot (free, 5 minutes)
3. Rotate compromised secrets (JWT, Google OAuth)
4. Add `SUPABASE_ANON_KEY` to Vercel env vars

### 🟡 Do This Month
5. Create separate Supabase project for development
6. Set up GitHub Actions for automated deployment
7. Set up weekly database backup

### 🟢 Eventually
8. Upgrade Supabase to Pro (7-day backups)
9. Set up staging environment on Vercel
10. Add structured logging
