// src/app/(dashboard)/clients/page.tsx
// Redirect to the renamed /projects route
import { redirect } from 'next/navigation'

export default function ClientsRedirect() {
  redirect('/projects')
}
