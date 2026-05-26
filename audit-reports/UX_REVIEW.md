# 🎨 PHASE 6 — UX & Product Quality Review
_Audit Date: 2026-05-26 | Second Pass Production Review_

> **Plain English:** How does the app feel to use? What frustrates users? What would make clients trust you more?

---

## Summary

| Area | Score | Notes |
|---|---|---|
| Visual design | 8/10 | Clean, professional |
| Loading experience | 5/10 | Missing skeletons on several pages |
| Error states | 4/10 | Silent failures common |
| Mobile responsiveness | 5/10 | Kanban/calendar break on small screens |
| Empty states | 6/10 | Some empty, some missing context |
| Accessibility | 4/10 | Missing ARIA labels, contrast issues |
| Onboarding | 3/10 | No guided first-use experience |
| Client-facing polish | 6/10 | Good progress, room to improve |

---

## 6.1 — Loading Experience ⚠️

### Issues Found

| Page | Loading State | Assessment |
|---|---|---|
| Overview | Skeleton loaders ✅ | Good |
| Tasks | "Loading tasks..." text | Poor — should be skeleton |
| Content | No loading state visible | Poor |
| Calendar | Spinner on header only | Acceptable |
| Projects | No loading state | Poor |
| Finance | No loading state | Poor |

### Impact
On slow internet (common in India on mobile), users see blank screens or old data for 2-3 seconds. This feels broken even when it isn't.

### Recommended Fix
Add skeleton loading states to Tasks, Content, and Projects pages — matching the design already on the Overview page.

---

## 6.2 — Error States 🔴

### Issue
When an API call fails (network error, database timeout, permissions issue), most pages:
- Show an empty list (looks like "no data")
- Don't tell the user something went wrong
- Don't offer a "retry" option

### Example: `supa.ts` returns `[]` on error
```typescript
// Current behavior:
if (!res.ok) {
  console.error(...)
  return []  // ← Page shows empty state, not error
}
```

### Recommended Fix
- Add a global "Failed to load. Tap to retry." state to all list pages
- Add a toast notification when mutations fail silently

---

## 6.3 — Mobile Responsiveness ⚠️

### Issues

| Component | Mobile Status |
|---|---|
| Sidebar navigation | Collapses to icon-only ✅ Good |
| Overview cards | Responsive ✅ Good |
| Task Kanban board | ❌ Horizontal scroll required — poor UX |
| Task List view | ✅ Mostly OK |
| Calendar grid | ❌ Very cramped on phone — dates overlap |
| Finance tables | ❌ Requires horizontal scroll |
| Content list | ✅ OK |
| Projects board | ❌ Cards overflow on mobile |

### Impact
Your clients (AXS Architects, Aruvi Bakery etc.) likely check status from their phones. The Calendar and Overview are the pages they'll use most — Calendar is broken on mobile.

---

## 6.4 — Empty States ⚠️

### Good Empty States (already implemented)
- Tasks board with no tasks: Shows "No tasks in this column"
- Notes with no notes: Informative

### Missing or Weak Empty States
- **Content page — no content:** Just shows empty table, no action prompt
- **Projects — new client, no project:** Shows nothing — client is confused
- **Reports — no reports submitted:** Just blank, no guidance
- **CRM pipeline — empty:** No guidance on how to add first lead

### Recommended Fix
Each empty state should:
1. Show a friendly illustration or icon
2. Explain what this section is for
3. Offer a clear action button ("Add your first project", "Create a task")

---

## 6.5 — Client-Facing Experience 🔴

### Issue: Clients See Technical Project Names
Clients see internal project names like "axs june", "aruvi may" which are your internal tracking codes — not professional client-facing names.

**Recommendation:** Add a separate "Display Name" field for projects that clients see, while keeping the internal code for team reference.

### Issue: No Welcome Message for Clients
When a client logs in, they see the same overview as staff. There's no:
- "Welcome, Aruvi Bakery!"
- "Your project is 60% complete"
- "Next milestone: Content posting starts June 1"

**Recommendation:** Add a client-specific overview header with their project summary prominently displayed.

### Issue: No Progress Visualization for Clients
Clients can't tell at a glance how far along their project is. A simple progress bar (tasks completed / total tasks) would dramatically improve trust.

---

## 6.6 — Accessibility ⚠️

### Issues Found
| Issue | Severity | Location |
|---|---|---|
| Buttons have no ARIA labels (icon-only buttons show "✕" or icons) | Medium | Calendar, Tasks modals |
| Form inputs missing `htmlFor`/`id` linking | Low | Multiple forms |
| Color alone used to indicate status (red/green/amber) | Medium | Task priority, content status |
| No focus visible state on custom buttons | Medium | Task cards, calendar cells |
| No `alt` text on any avatar/icon images | Low | Team page |

---

## 6.7 — Onboarding 🔴

### Issue
There is no first-time user experience. A new team member logs in and sees:
- Empty tasks board (no guidance)
- Empty reports section
- No tooltips or hints

### Recommended First-Time Experience
1. Show a welcome modal on first login
2. Link to a "Getting started" guide
3. For staff: "Your first task is to submit today's daily report"
4. For clients: "Your project is being set up. Here's what to expect..."

---

## Top UX Wins (High Impact, Low Effort)

| Action | Impact | Effort |
|---|---|---|
| Add skeleton loaders to Tasks/Content/Projects | High | Low |
| Add "Failed to load" error states | High | Low |
| Fix Calendar on mobile (list view for mobile) | High | Medium |
| Add client welcome banner on Overview | Medium | Low |
| Add project progress bar for clients | High | Low |
| Add empty state illustrations | Medium | Medium |
