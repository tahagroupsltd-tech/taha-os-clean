# 🔴 PHASE 2 — Production Stress Test & Simulation Report
_Audit Date: 2026-05-24 | Auditor: Principal Engineer Review_

---

## Plain-English Summary
This report simulates what happens when real users hit your app under pressure — slow internet, many people using it at once, APIs failing, sessions expiring. Below are every failure scenario found.

---

## Scenario 1 — Slow 3G Internet (≤ 500 kbps)

### Findings
| Issue | Severity | Location |
|---|---|---|
| No skeleton loaders on Projects list — raw "loading..." text shown | Medium | `/projects/page.tsx` |
| Calendar fetches 3 APIs simultaneously with no loading state coordination | Medium | `/calendar/page.tsx` |
| Overview page fires 18+ parallel Supabase queries on load | High | `/overview/page.tsx` |
| No request timeout — if Supabase is slow, page hangs indefinitely | High | `supa.ts` - all fetch calls |
| No AbortController on navigating away mid-fetch (memory/error leak) | Medium | All API fetch calls in client components |

### Impact
On slow connections, the overview page can take 5–8 seconds to show data and shows no progress indicator.

### Fix Status
- ⬜ Add `AbortSignal.timeout(8000)` to all supa.ts fetch calls
- ⬜ Add skeleton loaders to projects/tasks pages

---

## Scenario 2 — API Latency Spikes (Supabase slow)

### Findings
| Issue | Severity | Location |
|---|---|---|
| `Promise.all` in `/api/projects` fires 5 count queries per project — if 8 projects = 40 DB calls in one request | High | `projects/route.ts` L24-44 |
| No caching on any repeated identical queries | High | All API routes |
| Overview page has no timeout — if one query fails silently, partial data loads | Medium | `overview/page.tsx` |

### Impact
Loading the Projects page with 8 projects fires 40 database count queries every time. This is the single biggest performance bottleneck in the app right now.

---

## Scenario 3 — Failed API Responses

### Findings
| Issue | Severity | Location |
|---|---|---|
| `supa.ts` `sbSelect` silently returns `[]` on failure — UI shows "No data" instead of "Error loading" | High | `supa.ts` L52-56 |
| No error boundary on any dashboard page — API failure in one component crashes the whole page | High | All dashboard pages |
| Login API catches all errors but returns generic "Internal server error" — no logging detail | Low | `api/auth/login/route.ts` |
| No retry logic on any API call | Medium | All client-side fetch calls |

### Impact
If Supabase is temporarily down, users see empty states (empty task lists, no content) instead of "Connection error — please refresh."

---

## Scenario 4 — Database Slowdowns

### Findings
| Issue | Severity | Location |
|---|---|---|
| `/api/tasks` client-side filter for CLIENT role fetches ALL tasks then filters — will fail at scale | High | `tasks/route.ts` L38-40 |
| `/api/events` client-side filter for CLIENT role fetches ALL events | High | `events/route.ts` L37-39 |
| `/api/content` client-side filter for CLIENT role fetches ALL content | High | `content/route.ts` L32-34 |
| `/api/register` fetches ALL users to check uniqueness — O(n) scan | Medium | `register/route.ts` L31-43 |
| `/api/transactions` loads all transactions then filters by date in-memory | Medium | `transactions/route.ts` L31-47 |
| No DB-level pagination — tasks/content/events return unlimited rows | High | Multiple routes |

### Impact
With 100+ tasks, CLIENT API calls fetch everything and filter in memory. At 1000 tasks this will be very slow and may hit Supabase row limits.

---

## Scenario 5 — Concurrent Dashboard Usage

### Findings
| Issue | Severity | Location |
|---|---|---|
| No optimistic UI — every action requires full refetch before showing changes | Low | Tasks, Content pages |
| Multiple tabs open: each tab polls independently, no shared state | Low | Architecture level |
| No WebSocket / realtime — changes by one user are not seen by another until refresh | Medium | All pages |

---

## Scenario 6 — Session Expiration During Activity

### Findings
| Issue | Severity | Location |
|---|---|---|
| JWT expires after 7 days with no refresh mechanism | Medium | `auth.ts` L17 |
| When session expires mid-session, API calls return 401 but UI shows silent errors or stale data | High | Client-side fetch calls |
| No automatic redirect to login on 401 response | High | All client components |
| No "session expired" toast or modal | Medium | UX gap |

### Impact
A user who leaves a tab open for a week comes back to a broken UI with silent errors. They won't know they're logged out.

---

## Scenario 7 — Extremely Large Datasets

### Findings
| Issue | Severity | Location |
|---|---|---|
| No pagination on Tasks board — all tasks loaded at once | High | `/api/tasks`, `/tasks/page.tsx` |
| No pagination on Content list | High | `/api/content`, `/content/page.tsx` |
| No virtual scrolling on task board with 100+ cards | Medium | `/tasks/page.tsx` |
| Reports limited to 100 — only protection in place | ✅ OK | `reports/route.ts` L66 |
| Calendar loads all content items for month ±15 days — no row limit | High | `/calendar/page.tsx` L319-320 |

---

## Scenario 8 — Mobile Performance

### Findings
| Issue | Severity | Location |
|---|---|---|
| Kanban board has `minWidth: 860px` — requires horizontal scroll on mobile | Medium | `tasks/page.tsx` L314 |
| Calendar grid is 7-column fixed width — very cramped on mobile | Medium | `calendar/page.tsx` |
| Finance page tables not responsive | Low | `/finance/page.tsx` |
| No `loading.tsx` files defined for any route — no Suspense boundaries | Medium | All routes |

---

## Scenario 9 — Browser Refresh During Live Updates

### Findings
| Issue | Severity | Location |
|---|---|---|
| All state is lost on refresh (no localStorage cache) | Low | Client stores |
| Timer state lost if user refreshes while timer running | Medium | `tasks/page.tsx` TimeTracker |

---

## Priority Fix List

### 🔴 Must Fix Now
1. Add row limit (100-500) to tasks/content/events APIs
2. Add 401→redirect-to-login handler globally
3. Fix CLIENT-side filtering at DB level (use `projectId=in.(...)` not in-memory)

### 🟡 Should Fix Soon
4. Add `AbortSignal.timeout(8000)` to all fetch calls
5. Add error boundaries to dashboard pages
6. Fix Projects page — remove per-project count waterfall (use aggregate query)
7. Add loading skeletons to all main pages

### 🟢 Nice to Have
8. Add optimistic UI to tasks/content mutations
9. Add session expiration handler
10. Add virtual scrolling for large datasets
