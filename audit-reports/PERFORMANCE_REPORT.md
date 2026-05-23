# ⚡ Performance Audit Report
**Project:** Taha Media OS  
**Audited:** 2026-05-24  

---

## Summary

The app works well for a team of ~20 people but has several patterns that will cause **slow page loads and database strain** as data grows. The most important fixes are adding database indexes and pagination to API calls.

---

## 🔴 Critical Performance Issues

### 1. No Database Indexes on the 3 Most-Used Tables
**Tables affected:** `tasks`, `content`, `projects`, `users`  
**What it means:** Every time someone loads the Tasks page, the database reads through **every single task** to find the ones you need. With 100 tasks this is fine. With 10,000 tasks (a year from now) the page will be noticeably slow.  
**Fix applied:** Added indexes to `prisma/schema.prisma`:

| Table | Fields Indexed |
|-------|---------------|
| `tasks` | `assignedToId`, `projectId`, `status`, `deadline`, `createdAt` |
| `content` | `projectId`, `assigneeId`, `status`, `postDate`, `createdAt` |
| `projects` | `clientId`, `status`, `createdAt` |
| `users` | `role`, `isActive` |

**Your action required:** Run this once to apply the indexes to your live database:
```bash
# From your project folder in terminal:
npx prisma db push
# or: npx prisma migrate dev --name add_performance_indexes
```

### 2. 47 API Calls Fetch All Records With No Limit
**What it means:** Routes like `/api/content`, `/api/tasks`, `/api/projects` fetch every single record from the database every time the page loads. If you have 5,000 content items, every page load downloads all 5,000 rows.  
**Impact:** Slow load times, high database load, large data transfers.  
**Recommended fix:** Add pagination to all list endpoints:
```typescript
// In each GET handler, accept ?page=1&limit=50
const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
const offset = (parseInt(searchParams.get('page') ?? '1') - 1) * limit
const data = await sbSelect('tasks', { filters, limit, offset })
```

---

## 🟠 High Impact

### 3. Very Large Page Files (Monolithic Components)
**What it means:** Several pages are extremely large single files. React has to compile and run all of this code even if the user is only looking at one section.

| Page | Lines of Code |
|------|--------------|
| Finance | 1,259 lines |
| Projects | 1,161 lines |
| Calendar | 1,041 lines |
| Tasks | 675 lines |
| Overview | 626 lines |

**Recommended fix:** Split these into smaller components and use `React.lazy()` to load sections only when needed. For example, the Finance page's Analytics tab doesn't need to load until the user clicks on it.

### 4. No Caching — Every Click Hits the Database
**What it means:** Every time you navigate to any page, all data is freshly fetched from the database. Users who switch between pages rapidly cause many redundant database calls.  
**Recommended fix:** Add simple client-side caching with a 30-60 second TTL. The `zustand` package you're already using can store recently fetched data:
```typescript
// Check cache before fetching
const cached = useAppStore((s) => s.tasks)
const cacheTime = useAppStore((s) => s.tasksFetchedAt)
const isStale = !cacheTime || Date.now() - cacheTime > 60_000
if (!isStale) return // use cached data
```

### 5. Missing Lazy Loading on Heavy Components
**What it means:** Components like `ActiveClientsSidebar`, `ChatLauncher`, and the Finance analytics charts are loaded on every page even when not visible. This increases the initial JavaScript bundle size.  
**Recommended fix:**
```typescript
// In dashboard layout
const ChatLauncher = dynamic(() => import('@/components/layout/ChatLauncher'), { ssr: false })
const ActiveClientsSidebar = dynamic(() => import('@/components/layout/ActiveClientsSidebar'), { ssr: false })
```

---

## 🟡 Medium Impact

### 6. N+1 Query Pattern in Active Clients Sidebar
**File:** `src/app/api/clients/active/route.ts`  
**What it means:** For each active project, the sidebar runs 4 separate database queries (transactions, events, content twice). With 10 active clients that's 40+ database round trips per sidebar open.  
**Recommended fix:** Combine into fewer queries with broader date filters, then filter in memory.

### 7. Polling / Refresh Strategy
**What it means:** The app doesn't appear to use WebSockets or polling for real-time updates. Users won't see changes made by colleagues without refreshing the page.  
**This is acceptable** for a small team but worth noting. Supabase provides real-time subscriptions if needed in future.

### 8. No Image Optimisation
**File:** `src/assets/media__1779211152696.jpg`  
**What it means:** There is a large image asset in the source directory. Next.js has a built-in image optimizer (`next/image`) that compresses and resizes images automatically.  
**Recommended fix:** Use `<Image>` from `next/image` instead of `<img>` tags.

---

## 🟢 Already Optimised

- ✅ `compress: true` in `next.config.mjs` — responses are gzip compressed
- ✅ `cache: 'no-store'` on all Supabase fetch calls — prevents stale data
- ✅ `dynamic = 'force-dynamic'` on API routes — no stale server caches
- ✅ Supabase connection pooling is configured correctly for serverless
- ✅ Images configured for avif/webp format
- ✅ `server-only` imports prevent heavy server libraries from shipping to the browser

---

## Estimated Performance Impact

| Fix | Expected Improvement |
|-----|---------------------|
| Database indexes | 5-10× faster queries on filtered lists |
| Pagination | 80% reduction in data transfer for large datasets |
| Lazy loading | 15-25% faster initial page load |
| Caching | 50-70% fewer database calls for active users |

---

## Scalability Estimate

| Users / Data Volume | Current Expected Performance |
|---------------------|------------------------------|
| 1-5 users, <1k records | ✅ Fast — no issues |
| 5-20 users, 1k-10k records | ⚠️ Acceptable but add indexes now |
| 20-50 users, 10k-100k records | ❌ Will be slow — needs pagination + caching |
| 50+ users | ❌ Requires architectural changes (pagination, caching, query optimisation) |
