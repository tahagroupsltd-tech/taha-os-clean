// src/app/(dashboard)/billing/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { formatMoney, formatDate } from '@/lib/utils'
import { IndianRupee, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { ProjectValueInput } from '@/components/billing/ProjectValueInput'
import { MonthSelector } from '@/components/billing/MonthSelector'
import { PaymentReminderButton } from '@/components/billing/PaymentReminderButton'

export default async function BillingPage({
  searchParams = {},
}: {
  searchParams?: { month?: string }
}) {
  const user = await getServerUser()
  if (!user) return null
  if (user.role !== 'ADMIN') redirect('/overview')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed

  if (searchParams?.month) {
    const parts = searchParams.month.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) - 1
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m < 12) {
        year = y
        month = m
      }
    }
  }

  const startOfMonth = new Date(year, month, 1)
  const startOfNextMonth = new Date(year, month + 1, 1)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // All active/paused/completed projects with client info
  const projectsRaw = await sbSelect('projects', {
    select: '*,client:users!clientId(id,name,username)',
    filters: { status: 'in.(ACTIVE,PAUSED,COMPLETED)' },
    order: 'createdAt.desc',
  }).catch(() => [] as any[])

  // All income transactions
  const allTransactions = await sbSelect('transactions', {
    select: 'id,amount,date,projectId,type',
    filters: { type: 'eq.INCOME' },
    order: 'date.desc',
  }).catch(() => [] as any[])

  // Group transactions by project (keep unlinked for summary)
  const txByProject = new Map<string, any[]>()
  let unlinkedIncomeThisMonth = 0
  let unlinkedIncomeAllTime = 0
  for (const t of allTransactions) {
    if (!t.projectId) {
      // Unlinked — count in summary totals
      const d = new Date(t.date)
      if (d >= startOfMonth && d < startOfNextMonth) unlinkedIncomeThisMonth += Number(t.amount)
      unlinkedIncomeAllTime += Number(t.amount)
      continue
    }
    const arr = txByProject.get(t.projectId) ?? []
    arr.push(t)
    txByProject.set(t.projectId, arr)
  }

  // Show ALL active/paused projects — month filter only affects "this month" income column
  // (previously projects were hidden if they started outside the selected month)
  const projects = projectsRaw

  // Compute per-project metrics for filtered projects
  const rows = projects.map((p: any) => {
    const transactions = txByProject.get(p.id) ?? []
    const allIncome = transactions.reduce((s: number, t: any) => s + Number(t.amount), 0)
    const thisMonthIncome = transactions
      .filter((t: any) => {
        const d = new Date(t.date)
        return d >= startOfMonth && d < startOfNextMonth
      })
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
    const valNum = p.value ? Number(p.value) : 0
    const remainingBalance = valNum > 0 ? Math.max(0, valNum - allIncome) : 0
    const paymentStatus: 'fully_paid' | 'advance' | 'unpaid' | 'no_contract' =
      valNum === 0
        ? 'no_contract'
        : allIncome >= valNum
          ? 'fully_paid'
          : allIncome > 0
            ? 'advance'
            : 'unpaid'

    return {
      id: p.id,
      project: p.name,
      projectStatus: p.status,
      client: p.client ?? null,
      status,
      value: valNum,
      remainingBalance,
      paymentStatus,
      allIncome,
      thisMonthIncome,
      lastPaymentDate: lastPayment?.date ?? null,
      lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : 0,
      daysSinceLast,
      promiseToPayDate: p.promise_to_pay_date ?? null,
      reminderDate: p.reminder_date ?? null,
      reminderNote: p.reminder_note ?? null,
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

  // All income in the selected month
  const totalIncomeThisMonth = allTransactions
    .filter((t: any) => {
      const d = new Date(t.date)
      return d >= startOfMonth && d < startOfNextMonth
    })
    .reduce((s: number, t: any) => s + Number(t.amount), 0)

  const totalIncomeAllTime = allTransactions.reduce((s: number, t: any) => s + Number(t.amount), 0)
  
  // Calculate lapsed count globally across all active/paused projects in system
  const globalRows = projectsRaw.map((p: any) => {
    const transactions = txByProject.get(p.id) ?? []
    const lastPayment = transactions[0] ?? null
    const recentActivity = transactions.find((t: any) => new Date(t.date) >= ninetyDaysAgo)
    const status: 'paid_this_month' | 'recent' | 'lapsed' | 'never' =
      transactions.some((t: any) => {
        const d = new Date(t.date)
        return d >= startOfMonth && d < startOfNextMonth
      })
        ? 'paid_this_month'
        : recentActivity
          ? 'recent'
          : lastPayment
            ? 'lapsed'
            : 'never'
    return { status }
  })
  const lapsedCount = globalRows.filter((r: any) => r.status === 'lapsed').length
  
  const paidThisMonthCount = rows.filter((r) => r.status === 'paid_this_month').length
  const totalOutstanding = rows.reduce((s, r) => s + r.remainingBalance, 0)
  const unlinkedCount = allTransactions.filter((t: any) => !t.projectId).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Client Billing" actions={<MonthSelector />} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              <IndianRupee size={14} className="text-red-500" />
              <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">Outstanding Balance</p>
            </div>
            <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-stone-900'}`}>{formatMoney(totalOutstanding)}</p>
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

        {/* Unlinked income warning */}
        {unlinkedCount > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                {unlinkedCount} income transaction{unlinkedCount > 1 ? 's' : ''} in Finance not linked to any project
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                {formatMoney(unlinkedIncomeAllTime)} total unlinked income ({formatMoney(unlinkedIncomeThisMonth)} this month) — these won&apos;t appear in project rows below.
                Go to <a href="/finance" className="underline font-semibold">Finance → Transactions</a> and link each one to a project.
              </p>
            </div>
          </div>
        )}
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
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Contract Value</th>
                      <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Recency</th>
                      <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Payment Status</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Last paid</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Paid (All Time)</th>
                      <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Remaining</th>
                      <th className="text-center px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Reminder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {projectRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 font-medium text-stone-900 whitespace-nowrap">
                          <div>{r.project}</div>
                          {r.projectStatus === 'COMPLETED' && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-150 uppercase tracking-wide">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <ProjectValueInput projectId={r.id} initialValue={r.value} />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <StatusPill status={r.status} daysSinceLast={r.daysSinceLast} />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <PaymentStatusPill status={r.paymentStatus} value={r.value} paid={r.allIncome} />
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
                        <td className="px-5 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">{formatMoney(r.allIncome)}</td>
                        <td className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${r.remainingBalance > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                          {r.remainingBalance > 0 ? formatMoney(r.remainingBalance) : '₹0'}
                        </td>
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          <PaymentReminderButton
                            projectId={r.id}
                            projectName={r.project}
                            clientName={r.client?.name}
                            initialPromiseDate={r.promiseToPayDate}
                            initialReminderDate={r.reminderDate}
                            initialReminderNote={r.reminderNote}
                          />
                        </td>
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
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Contract Value</th>
                    <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Recency</th>
                    <th className="text-left px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Payment Status</th>
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Last paid</th>
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Paid (All Time)</th>
                    <th className="text-right px-5 py-2 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {noClient.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-stone-900 whitespace-nowrap">
                        <div>{r.project}</div>
                        {r.projectStatus === 'COMPLETED' && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-155 uppercase tracking-wide">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <ProjectValueInput projectId={r.id} initialValue={r.value} />
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <StatusPill status={r.status} daysSinceLast={r.daysSinceLast} />
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <PaymentStatusPill status={r.paymentStatus} value={r.value} paid={r.allIncome} />
                      </td>
                      <td className="px-5 py-3 text-right text-stone-500 whitespace-nowrap">
                        {r.lastPaymentDate ? formatDate(r.lastPaymentDate) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">{formatMoney(r.allIncome)}</td>
                      <td className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${r.remainingBalance > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                        {r.remainingBalance > 0 ? formatMoney(r.remainingBalance) : '₹0'}
                      </td>
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

function PaymentStatusPill({
  status,
  value,
  paid,
}: {
  status: 'fully_paid' | 'advance' | 'unpaid' | 'no_contract'
  value: number
  paid: number
}) {
  if (status === 'no_contract') {
    return (
      <Badge className="bg-stone-100 text-stone-500 border-none">
        No Contract
      </Badge>
    )
  }
  if (status === 'fully_paid') {
    return (
      <Badge className="bg-green-50 text-green-700 border border-green-200">
        Fully Paid
      </Badge>
    )
  }
  if (status === 'advance') {
    const pct = value > 0 ? Math.round((paid / value) * 100) : 0
    return (
      <div className="flex flex-col gap-1">
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 w-fit">
          Advance ({pct}%)
        </Badge>
        <div className="w-20 bg-stone-100 rounded-full h-1 overflow-hidden">
          <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${pct}%` }}></div>
        </div>
      </div>
    )
  }
  return (
    <Badge className="bg-red-50 text-red-700 border border-red-200">
      Unpaid
    </Badge>
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
