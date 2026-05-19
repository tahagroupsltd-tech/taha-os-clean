// src/app/(dashboard)/clients/[id]/page.tsx
// Redirect to the renamed /projects/[id] route
import { redirect } from 'next/navigation'

export default function ClientDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}`)
}
