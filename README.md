# Taha Media OS — Clean Next.js Build

Production-ready internal dashboard. Next.js 14 · Prisma · PostgreSQL · JWT Auth · Tailwind CSS

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Custom JWT (jose) + bcrypt |
| Styling | Tailwind CSS |
| State | Zustand (persisted) |
| Runtime | Node.js 18+ |

---

## Folder Structure

```
/
├── prisma/
│   ├── schema.prisma        # DB models: User, Project, Task, Content
│   └── seed.ts              # Seed admin + demo accounts
├── src/
│   ├── app/
│   │   ├── (auth)/login/    # Login page (username or phone + password)
│   │   ├── (dashboard)/     # All protected pages
│   │   │   ├── layout.tsx   # Sidebar layout
│   │   │   ├── overview/    # Stats + recent tasks + content
│   │   │   ├── tasks/       # Full CRUD, board + list view
│   │   │   ├── content/     # Content workflow tracker
│   │   │   ├── clients/     # Project management
│   │   │   ├── team/        # User management (admin only)
│   │   │   └── settings/    # System overview (admin only)
│   │   └── api/
│   │       ├── auth/login/  # POST — issues JWT cookie
│   │       ├── auth/logout/ # POST — clears cookie
│   │       ├── auth/register/ # POST — admin only
│   │       ├── tasks/       # GET + POST
│   │       ├── tasks/[id]/  # PATCH + DELETE
│   │       ├── projects/    # GET + POST
│   │       ├── content/     # GET + POST
│   │       ├── content/[id]/ # PATCH + DELETE
│   │       └── users/       # GET (admin only)
│   ├── components/
│   │   ├── ui/              # Badge, Button, Input, Select, Modal
│   │   └── layout/          # Sidebar, TopBar
│   ├── hooks/useAuth.ts     # login() + logout() hook
│   ├── lib/
│   │   ├── auth.ts          # signToken, verifyToken, getServerUser
│   │   ├── db.ts            # Prisma singleton
│   │   └── utils.ts         # cn(), status labels, colors, dates
│   ├── middleware.ts        # Route protection + role-based access
│   ├── store/
│   │   ├── auth.store.ts    # Zustand auth (persisted)
│   │   └── ui.store.ts      # Sidebar open/close
│   └── types/index.ts       # All TypeScript types
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or Neon.tech free tier)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL and JWT_SECRET

# 3. Push schema to database
npm run db:push

# 4. Seed demo accounts
npm run db:seed

# 5. Run dev server
npm run dev
```

Open http://localhost:3000

---

## Login Credentials (after seed)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin — full access |
| `editor` | `editor123` | Employee — tasks + content |
| `designer` | `designer123` | Employee — tasks + content |
| `axsclient` | `client123` | Client — read-only projects |

Login also works with phone number: `9840000001` / `admin123`

---

## Role Permissions

| Page | Admin | Employee | Client |
|---|---|---|---|
| Overview | ✓ | ✓ | ✓ |
| Tasks | ✓ (all) | ✓ (own) | — |
| Content | ✓ (all) | ✓ (own) | — |
| Projects | ✓ | ✓ | ✓ (own) |
| Team | ✓ | — | — |
| Settings | ✓ | — | — |

---

## Deploy to Vercel + Neon (Free)

### 1. Database — Neon.tech
1. Go to neon.tech → create free project → copy connection string
2. Paste into `NEXT_PUBLIC_DATABASE_URL` / `DATABASE_URL` in Vercel env

### 2. Push to GitHub
```bash
git init && git add . && git commit -m "Initial"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 3. Vercel
1. vercel.com → Import repo
2. Add env vars:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Any 32+ char random string |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |

3. Click Deploy

### 4. Run migrations on production
```bash
# In Vercel dashboard → Settings → Functions → add build command:
npx prisma db push && npm run build
```
Or in your local terminal pointing at the Neon DB:
```bash
DATABASE_URL="your-neon-url" npx prisma db push
DATABASE_URL="your-neon-url" npm run db:seed
```

---

## Adding New Users

From the **Team** page (admin only) — fill in username, name, phone (optional), password, role. The user logs in immediately with those credentials.

Or via API:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","name":"New User","password":"pass123","role":"EMPLOYEE"}'
```

---

## Extending the Project

**Add a new page:**
1. Create `src/app/(dashboard)/your-page/page.tsx`
2. Add nav item to `src/components/layout/Sidebar.tsx`
3. Add role restriction if needed in `src/middleware.ts`

**Add a new API route:**
1. Create `src/app/api/your-route/route.ts`
2. Call `getUserFromRequest(req)` at the top for auth
3. Check `user.role` for permission

**Add a new DB model:**
1. Add to `prisma/schema.prisma`
2. Run `npm run db:push`
3. Use `db.yourModel` in API routes
