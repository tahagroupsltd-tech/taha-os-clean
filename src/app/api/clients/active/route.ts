// src/app/api/clients/active/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 1. Fetch active or paused projects that have a client
    const projects = await sbSelect('projects', {
      select: 'id,name,status,sopLevel,value,clientId,client:users!clientId(id,name,username)',
      filters: { status: 'in.(ACTIVE,PAUSED)' },
      order: 'name.asc',
    })

    // Filter out projects that don't have a client
    const activeProjects = projects.filter((p: any) => p.clientId && p.client)

    // 2. Fetch details for each active project
    const data = await Promise.all(
      activeProjects.map(async (p: any) => {
        const projectId = p.id
        
        // Income transactions for this project
        const transactions = await sbSelect('transactions', {
          select: 'amount',
          filters: { projectId: `eq.${projectId}`, type: 'eq.INCOME' },
        }).catch(() => [] as any[])

        const totalPaid = transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0)
        const projectValue = p.value ? Number(p.value) : 0
        const outstandingBalance = Math.max(0, projectValue - totalPaid)

        // Next upcoming shoot
        const shoots = await sbSelect('events', {
          select: 'title,startTime,location',
          filters: { projectId: `eq.${projectId}`, type: 'eq.SHOOT', startTime: `gte.${new Date().toISOString()}` },
          order: 'startTime.asc',
          limit: 1,
        }).catch(() => [] as any[])
        const nextShoot = shoots[0] || null

        // Next scheduled video post
        const nextPosts = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}`, postDate: `gte.${new Date().toISOString()}` },
          order: 'postDate.asc',
          limit: 1,
        }).catch(() => [] as any[])
        const nextPost = nextPosts[0] || null

        // Last posted video
        const lastPosts = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}`, status: 'eq.POSTED' },
          order: 'postDate.desc',
          limit: 1,
        }).catch(() => [] as any[])
        const lastPost = lastPosts[0] || null

        // All content items for this project to find the last video of the current month
        const projectContent = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}` },
          order: 'postDate.desc',
        }).catch(() => [] as any[])

        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() // 0-indexed

        const lastVideoCurrentMonth = projectContent.find((c: any) => {
          if (!c.postDate) return false
          if (c.type !== 'REEL' && c.type !== 'VIDEO') return false
          const pDate = new Date(c.postDate)
          return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth
        }) || null

        // Compute current month's video progress
        const currentMonthContent = projectContent.filter((c: any) => {
          if (!c.postDate) return false
          const pDate = new Date(c.postDate)
          return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth
        })
        const currentMonthVideos = currentMonthContent.filter((c: any) => c.type === 'REEL' || c.type === 'VIDEO')
        const targetList = currentMonthVideos.length > 0 ? currentMonthVideos : currentMonthContent

        const currentMonthTotal = targetList.length
        const currentMonthPosted = targetList.filter((c: any) => c.status === 'POSTED').length
        const currentMonthProgress = currentMonthTotal > 0 ? Math.round((currentMonthPosted / currentMonthTotal) * 100) : 0

        const SOP_LEVEL_LABELS: Record<number, string> = {
          1: 'Onboarding',
          2: 'PM Setup',
          3: 'Script Prep',
          4: 'Script Approval',
          5: 'Shoot Logistics',
          6: 'Shoot Day',
          7: 'Post-Prod',
        }

        const currentSop = p.sopLevel ?? 1
        let nextMonthScriptsNeeded = false
        let scriptStatusLabel = ''

        if (currentSop < 4) {
          nextMonthScriptsNeeded = true
          scriptStatusLabel = `⚠️ Needed (In ${SOP_LEVEL_LABELS[currentSop] || 'Prep'})`
        } else {
          if (currentMonthProgress >= 60) {
            nextMonthScriptsNeeded = true
            scriptStatusLabel = `⚠️ Next Month Scripts (${currentMonthProgress}% posted)`
          } else {
            nextMonthScriptsNeeded = false
            scriptStatusLabel = `Not needed yet (${currentMonthProgress}%)`
          }
        }

        return {
          projectId,
          projectName: p.name,
          projectStatus: p.status,
          clientId: p.clientId,
          clientName: p.client.name,
          clientUsername: p.client.username,
          sopLevel: p.sopLevel ?? 1,
          projectValue,
          outstandingBalance,
          nextShoot,
          nextPost,
          lastPost,
          lastVideoCurrentMonth,
          currentMonthProgress,
          currentMonthPosted,
          currentMonthTotal,
          nextMonthScriptsNeeded,
          scriptStatusLabel,
        }
      })
    )

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
