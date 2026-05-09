// src/app/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'

export default async function RootPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  redirect('/overview')
}
