# 📈 PHASE 4 — Scalability Report
_Audit Date: 2026-05-26 | Second Pass Production Review_

> **Plain English:** How many people can use this app at once before it breaks? What breaks first? How do we fix it?

---

## Current Capacity Estimate

| Metric | Current Limit | Safe Zone | Danger Zone |
|---|---|---|---|
| Concurrent users | ~30–50 | <20 | >50 |
| Tasks in system | ~500 before slowdowns | <200 | >500 |
| Content items | ~500 before slowdowns | <200 | >500 |
| Projects | ~50 before waterfall queries | <30 | >50 |
| API requests/min | ~100 (Supabase free tier) | <80 | >100 |
| Database connections | Supabase REST (unlimited connections) | ✅ OK | N/A |

**Bottom line:** The app can comfortably handle your current team of ~20 users. For 100 users it needs the fixes listed below.

---

## PHASE 4.1 — Biggest Bottleneck: Projects Page N+1 Query

### Problem (explained simply)
When you open the Projects page, the server makes **1 query to get projects + 5 queries PER PROJECT** to count tasks, content, events, notes, and transactions. With 8 projects, that's **41 database calls** for one page load.

With 30 projects this becomes 151 database calls. This will cause Supabase rate limiting.

### File
`src/app/api/projects/route.ts` L24-44

### Impact: HIGH — slows every Projects page visit

### Recommended Fix
Replace individual counts with a single Supabase RPC function or use `select=*,tasks(count),content(count)` PostgREST syntax.

---

## PHASE 4.2 — No Pagination Anywhere

### Problem
Every API returns all rows with a 200-row cap we just added. A proper app needs pagination (page 1, page 2, etc.) so users never have to load everything.

### Affected Routes
- `/api/tasks` — 200 row cap added ✅ (was unlimited)
- `/api/content` — 200 row cap added ✅ (was unlimited)
- `/api/events` — No limit (filtered by date range — acceptable for now)
- `/api/transactions` — No limit (admin only, acceptable)

### Recommended Fix
Add `?page=1&limit=50` query parameter support to tasks and content APIs.

---

## PHASE 4.3 — No Caching

### Problem
Every page load makes fresh database calls. There is no caching layer anywhere. If 10 users open the overview page at the same time, it fires 180+ database queries simultaneously.

### Impact: HIGH for multi-user concurrent access

### Recommended Fix
1. **Short-term (free):** Next.js route handlers support `revalidate` — set `export const revalidate = 30` on read-only server components
2. **Medium-term:** Add Vercel Edge Config for frequently read, rarely changed data (user roles, project list)
3. **Long-term:** Redis cache layer (Upstash free tier) for expensive aggregated queries

---

## PHASE 4.4 — In-Memory Filtering for CLIENT Role

### Problem
CLIENT users (bakyavathy, AXS Architects, etc.) cause the server to:
1. Fetch ALL tasks from the database
2. Filter to only their tasks in JavaScript
3. Discard the rest

At 1,000 tasks (very achievable in 6 months), this means fetching 1,000 rows and keeping 5.

### Impact: HIGH — security risk + performance waste

### Recommended Fix
Add PostgREST-compatible DB-level filter for CLIENT tasks:
```
projectId=in.(project_id_1,project_id_2)
```
(Already partially implemented in the Overview page fix — needs completing in `/api/tasks` and `/api/events`)

---

## PHASE 4.5 — Bundle Size

| Bundle | Size | Assessment |
|---|---|---|
| Shared chunks | 87 kB gzipped | ✅ Good |
| Largest page (Finance) | 142 kB first load JS | ⚠️ Acceptable |
| Largest page (Schedule) | 141 kB first load JS | ⚠️ Acceptable |
| Smallest page (Overview) | 129 kB first load JS | ✅ Good |

No major bundle splitting issues. All pages are dynamic (server-rendered) which is correct.

---

## PHASE 4.6 — No Real-Time Updates

### Problem
When admin updates a task, clients don't see the change until they refresh. No WebSocket or polling is in place.

### Impact: LOW at current team size (5–20 users know to refresh)

### Recommended Fix (future)
Supabase has built-in real-time via WebSockets. Adding `supabase.channel('tasks').on('postgres_changes', ...)` would enable live updates.

---

## Scaling Roadmap

### Stage 1 — Current (0-50 users) ✅
- Architecture is functional
- No caching needed yet
- Supabase free tier sufficient

### Stage 2 — Growth (50-200 users)
- [ ] Fix Projects N+1 query waterfall
- [ ] Add pagination to tasks/content
- [ ] Add 30s cache to overview stats
- [ ] Fix CLIENT-side filtering at DB level
- [ ] Upgrade to Supabase Pro ($25/mo)

### Stage 3 — Scale (200-1000 users)
- [ ] Add Redis caching (Upstash ~$0-10/mo)
- [ ] Add Supabase real-time for live updates
- [ ] Add CDN for static assets
- [ ] Consider separating AI tools to a separate serverless function

---

## Infrastructure Recommendations

| Component | Current | Recommended |
|---|---|---|
| Database | Supabase free | Supabase Pro ($25/mo) at 50+ users |
| Hosting | Vercel free | Vercel Pro ($20/mo) at 50+ users |
| Caching | None | Upstash Redis free → $10/mo |
| Monitoring | None | Sentry free → $26/mo |
| Uptime | None | Better Uptime free tier |
