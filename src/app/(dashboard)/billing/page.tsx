// src/app/(dashboard)/billing/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { formatMoney, formatDate } from '@/lib/utils'
import { IndianRupee, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

export default async function BillingPage() {
  const user = await getServerUser()
  if (!user) return null
  if (user.role !== 'ADMIN') redirect('/overview')

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // All active/paused projects with client info
  const projectsRaw = await sbSelect('projects', {
    select: '*,client:users!clientId(id,name,username)',
    filters: { status: 'in.(ACTIVE,PAUSED)' },
    order: 'createdAt.desc',
  }).catch(() => [] as any[])

  // All income transactions
  const allTransactions = await sbSelect('transactions', {
    select: 'id,amount,date,projectId,type',
    filters: { type: 'eq.INCOME' },
    order: 'date.desc',
  }).catch(() => [] as any[])

  // Group transactions by project
  const txByProject = new Map<string, any[]>()
  for (const t of allTransactions) {
    if (!t.projectId) continue
    const arr = txByProject.get(t.projectId) ?? []
    arr.push(t)
    txByProject.set(t.projectId, arr)
  }

  // Compute per-project metrics
  const rows = projectsRaw.map((p: any) => {
    const transactions = txByProject.get(p.id) ?? []
    const allIncome = transactions.reduce((s: number, t: any) => s + Number(t.amount), 0)
    const thisMonthIncome = transactions
      .filter((t: any) => new Date(t.date) >= startOfMonth)
      .reduce((s: number, t: any) => s + Number(t.amount), 0)
    const lastPayment = transactions[0] ?? null
    const daysSinceLast = lastPayment
      ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const recentActivity = transactions.find((t: any) => new Date(t.date) >= ninetyDaysAgo)
    const status: 'paid_this_month' | 'recent' | 'lapsed' | 'never' =
      thisMonthIncome > 0
        ? 'paid_this_month'
        : recentActivity
          ? 'recent'
          : lastPayment
            ? 'lapsed'
            : 'never'
    return {
      id: p.id,
      project: p.name,
      client: p.client ?? null,
      status,
      allIncome,
      thisMonthIncome,
      lastPaymentDate: lastPayment?.date ?? null,
      lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : 0,
      daysSinceLast,
    }
  })

  // Group by client
  const byClient = new Map<string, typeof rows>()
  const noClient: typeof rows = []
  for (const r of rows) {
    if (r.client) {
      const arr = byClient.get(r.client.id) ?? []
      arr.push(r)
      byClient.set(r.client.id, arr)
    } else {
      noClient.push(r)
    }
  }

  const totalIncomeAllTime = rows.reduce((s, r) => s + r.allIncome, 0)
  const totalIncomeThisMonth = rows.reduce((s, r) => s + r.thisMonthIncome, 0)
  const lapsedCount = rows.filter((r) => r.status === 'lapsed').length
  const paidThisMonthCount = rows.filter((r) => r.status === 'paid_this_month').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Client Billing" />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee size={14} className="text-stone-500" />
              <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">Income this month</p>
            </div>
            <p className="text-xl font-bold text-stone-900">{formatMoney(totalIncomeThisMonth)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee size={14} className="text-stone-500" />
              <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">Income all time</p>
            </div>
            <p className="text-xl font-bold text-stone-900">{formatMoney(totalIncomeAllTime)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-green-600" />
              <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">Paid this month</p>
            </div>
            <p className="text-xl font-bold text-stone-900">
              {paidThisMonthCount}<span className="text-sm text-stone-400 font-normal"> / {rows.length} projects</span>
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className={lapsedCount > 0 ? 'text-red-500' : 'text-stone-400'} />
              <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">Lapsed (no payment 90d+)</p>
            </div>
            <p className={`text-xl font-bold ${lapsedCount > 0 ? 'text-red-600' : 'text-stone-900'}`}>{lapsedCount}</p>
          </div>
        </div>

        {/* By client */}
        {[...byClient.entries()].map(([clientId, projectRows]) => {
          const clientName = projectRows[0].client?.name
          const clientTotal = projectRows.reduce((s, r) => s + r.allIncome, 0)
          const clientThisMonth = projectRows.reduce((s, r) => s + r.thisMonthIncome, 0)
          return (
            <div key={clientId} className="bg-white rounded-lg border border-stone-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{clientName}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {projectRows.length} project{projectRows.length === 1 ? '' : 's'} • All time {formatMoney(clientTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-400 mb-0.5">This month</p>
                  <p className="text-sm font-semibold text-stone-900">{formatMoney(clientThisMonth)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-50 bg-stone-50/40">
                      <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Project</th>
                      <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Last paid</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">This month</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">All time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {projectRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 font-medium text-stone-900 whitespace-nowrap">{r.project}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <StatusPill status={r.status} daysSinceLast={r.daysSinceLast} />
                        </td>
                        <td className="px-5 py-3 text-right text-stone-500 whitespace-nowrap">
                          {r.lastPaymentDate ? (
                            <>
                              <div>{formatDate(r.lastPaymentDate)}</div>
                              <div className="text-[10px] text-stone-400">{formatMoney(r.lastPaymentAmount)}</div>
                            </>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">{formatMoney(r.thisMonthIncome)}</td>
                        <td className="px-5 py-3 text-right text-stone-700 whitespace-nowrap">{formatMoney(r.allIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {/* Projects without a client */}
        {noClient.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-700">Projects without a client</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-50 bg-stone-50/40">
                    <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Project</th>
                    <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Last paid</th>
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">All time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {noClient.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-stone-900 whitespace-nowrap">{r.project}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <StatusPill status={r.status} daysSinceLast={r.daysSinceLast} />
                      </td>
                      <td className="px-5 py-3 text-right text-stone-500 whitespace-nowrap">
                        {r.lastPaymentDate ? formatDate(r.lastPaymentDate) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">{formatMoney(r.allIncome)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="bg-white rounded-lg border border-stone-100 p-10 text-center">
            <p className="text-sm text-stone-500">No active projects yet.</p>
            <p className="text-xs text-stone-400 mt-1">Create a project under Projects to start tracking billing.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({
  status,
  daysSinceLast,
}: {
  status: 'paid_this_month' | 'recent' | 'lapsed' | 'never'
  daysSinceLast: number | null
}) {
  if (status === 'paid_this_month') {
    return (
      <Badge className="bg-green-50 text-green-700">
        <CheckCircle2 size={10} className="inline mr-1" /> Paid this month
      </Badge>
    )
  }
  if (status === 'recent') {
    return (
      <Badge className="bg-blue-50 text-blue-700">
        <Clock size={10} className="inline mr-1" /> Paid {daysSinceLast}d ago
      </Badge>
    )
  }
  if (status === 'lapsed') {
    return (
      <Badge className="bg-red-50 text-red-700">
        <AlertCircle size={10} className="inline mr-1" /> {daysSinceLast}d since last
      </Badge>
    )
  }
  return (
    <Badge className="bg-stone-100 text-stone-500">
      Never paid
    </Badge>
  )
}
