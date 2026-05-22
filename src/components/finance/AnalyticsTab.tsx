'use client'
// src/components/finance/AnalyticsTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, BarChart2, PieChart, Activity, HandCoins, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Transaction {
  id: string
  title: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  category: string
  date: string
  project?: { id: string; name: string } | null
}

interface Loan {
  id: string
  title: string
  amount: number
  status: 'PENDING' | 'PAID'
  due_date: string | null
  notes: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT_PAYMENT: 'Client Payment',
  SALARY: 'Salary',
  SOFTWARE: 'Software',
  EQUIPMENT: 'Equipment',
  SHOOT_COST: 'Shoot Cost',
  OFFICE: 'Office',
  MARKETING: 'Marketing',
  TAX: 'Tax',
  REFUND: 'Refund',
  OTHER: 'Other',
}

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
]

// ─── Utility helpers ──────────────────────────────────────────────────────────

function getLast6Months(): { key: string; label: string }[] {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    months.push({ key, label })
  }
  return months
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

// ─── SVG Area/Line Chart ──────────────────────────────────────────────────────

function AreaChart({
  incomeData,
  expenseData,
  labels,
}: {
  incomeData: number[]
  expenseData: number[]
  labels: string[]
}) {
  const W = 560
  const H = 200
  const PAD = { top: 20, right: 20, bottom: 36, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const n = labels.length

  const allVals = [...incomeData, ...expenseData, 0]
  const maxVal = Math.max(...allVals)
  const step = maxVal > 0 ? maxVal : 1

  const xOf = (i: number) =>
    n <= 1 ? PAD.left + chartW / 2 : PAD.left + (i / (n - 1)) * chartW
  const yOf = (v: number) => PAD.top + chartH - (v / step) * chartH

  const linePath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')

  const areaPath = (data: number[]) => {
    const line = linePath(data)
    const close = ` L${xOf(n - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${xOf(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`
    return line + close
  }

  // Y axis gridlines
  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = (step * i) / gridCount
    return { y: yOf(v), v }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(({ y, v }, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
            stroke="#e7e5e4" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4 3'} />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#a8a29e">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Area fills */}
      <path d={areaPath(incomeData)} fill="url(#incGrad)" />
      <path d={areaPath(expenseData)} fill="url(#expGrad)" />

      {/* Lines */}
      <path d={linePath(incomeData)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={linePath(expenseData)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points */}
      {incomeData.map((v, i) => (
        <circle key={`inc-${i}`} cx={xOf(i)} cy={yOf(v)} r="3.5" fill="#10b981" stroke="white" strokeWidth="1.5">
          <title>{labels[i]}: Income {formatMoney(v)}</title>
        </circle>
      ))}
      {expenseData.map((v, i) => (
        <circle key={`exp-${i}`} cx={xOf(i)} cy={yOf(v)} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.5">
          <title>{labels[i]}: Expense {formatMoney(v)}</title>
        </circle>
      ))}

      {/* X axis labels */}
      {labels.map((label, i) => (
        <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#78716c">
          {label}
        </text>
      ))}

      {/* Legend */}
      <circle cx={PAD.left + 4} cy={PAD.top - 6} r="4" fill="#10b981" />
      <text x={PAD.left + 12} y={PAD.top - 2} fontSize="9" fill="#44403c">Income</text>
      <circle cx={PAD.left + 65} cy={PAD.top - 6} r="4" fill="#ef4444" />
      <text x={PAD.left + 73} y={PAD.top - 2} fontSize="9" fill="#44403c">Expense</text>
    </svg>
  )
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const R = 70
  const CX = 85
  const CY = 85
  const total = slices.reduce((s, sl) => s + sl.value, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-stone-400 text-xs">
        No income data
      </div>
    )
  }

  let startAngle = -Math.PI / 2
  const paths = slices.map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const innerR = R * 0.55
    const ix1 = CX + innerR * Math.cos(endAngle)
    const iy1 = CY + innerR * Math.sin(endAngle)
    const ix2 = CX + innerR * Math.cos(startAngle)
    const iy2 = CY + innerR * Math.sin(startAngle)
    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      'Z',
    ].join(' ')
    const result = { d, color: sl.color, label: sl.label, value: sl.value, pct: ((sl.value / total) * 100).toFixed(1) }
    startAngle = endAngle
    return result
  })

  return (
    <svg viewBox="0 0 170 170" className="w-full max-w-[170px]">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth="1.5">
          <title>{p.label}: {formatMoney(p.value)} ({p.pct}%)</title>
        </path>
      ))}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fill="#44403c" fontWeight="600">Total</text>
      <text x={CX} y={CY + 10} textAnchor="middle" fontSize="10" fill="#78716c">
        {total >= 100000
          ? `₹${(total / 100000).toFixed(1)}L`
          : total >= 1000
          ? `₹${(total / 1000).toFixed(0)}k`
          : `₹${total}`}
      </text>
    </svg>
  )
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HorizBar({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-20 text-stone-400 text-xs">
        No expense data
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-right text-[10px] text-stone-500 truncate flex-shrink-0">{item.label}</div>
          <div className="flex-1 bg-stone-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${clamp((item.value / max) * 100, 1, 100)}%`, backgroundColor: item.color }}
            />
          </div>
          <div className="w-20 text-[10px] font-semibold text-stone-600 flex-shrink-0">{formatMoney(item.value)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main AnalyticsTab ────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/transactions').then((r) => r.json()),
      fetch('/api/loans').then((r) => r.json()),
    ])
      .then(([txJson, loanJson]) => {
        setTransactions(txJson.data ?? [])
        setLoans(loanJson.data ?? [])
      })
      .catch((e) => console.error('[AnalyticsTab] fetch error:', e))
      .finally(() => setLoading(false))
  }, [])

  // Loan stats
  const loanPending = useMemo(() => loans.filter((l) => l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0), [loans])
  const loanPaid    = useMemo(() => loans.filter((l) => l.status === 'PAID').reduce((s, l) => s + Number(l.amount), 0), [loans])
  const loanTotal   = loanPending + loanPaid

  const months = useMemo(() => getLast6Months(), [])

  // Monthly income/expense
  const { incomeByMonth, expenseByMonth } = useMemo(() => {
    const inc: Record<string, number> = {}
    const exp: Record<string, number> = {}
    months.forEach(({ key }) => { inc[key] = 0; exp[key] = 0 })
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7)
      if (inc[key] !== undefined) {
        if (t.type === 'INCOME') inc[key] += Number(t.amount)
        else exp[key] += Number(t.amount)
      }
    })
    return { incomeByMonth: months.map((m) => inc[m.key]), expenseByMonth: months.map((m) => exp[m.key]) }
  }, [transactions, months])

  // Revenue by project/client (top 6 income sources)
  const revenueSlices = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'INCOME')
      .forEach((t) => {
        const key = t.project?.name ?? 'Direct'
        map[key] = (map[key] ?? 0) + Number(t.amount)
      })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
  }, [transactions])

  // Expense breakdown by category
  const expenseSlices = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const key = CATEGORY_LABELS[t.category] ?? t.category
        map[key] = (map[key] ?? 0) + Number(t.amount)
      })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
  }, [transactions])

  // Summary stats
  const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0)
  const net = totalIncome - totalExpense

  // Current month stats
  const thisMonthInc = incomeByMonth[incomeByMonth.length - 1] ?? 0
  const thisMonthExp = expenseByMonth[expenseByMonth.length - 1] ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-600 rounded-full animate-spin" />
          <p className="text-xs text-stone-400">Loading analytics…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* KPI strip — 5 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center">
              <TrendingUp size={14} className="text-green-700" />
            </div>
            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Total Income</p>
          </div>
          <p className="text-xl font-bold text-green-800">{formatMoney(totalIncome)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-red-100 flex items-center justify-center">
              <TrendingDown size={14} className="text-red-700" />
            </div>
            <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Total Expense</p>
          </div>
          <p className="text-xl font-bold text-red-700">{formatMoney(totalExpense)}</p>
        </div>
        <div className={`rounded-xl border p-4 bg-gradient-to-br ${net >= 0 ? 'from-violet-50 to-indigo-50 border-violet-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${net >= 0 ? 'bg-violet-100' : 'bg-red-100'}`}>
              <Wallet size={14} className={net >= 0 ? 'text-violet-700' : 'text-red-700'} />
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${net >= 0 ? 'text-violet-700' : 'text-red-700'}`}>Net Balance</p>
          </div>
          <p className={`text-xl font-bold ${net >= 0 ? 'text-violet-800' : 'text-red-700'}`}>{formatMoney(net)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center">
              <Activity size={14} className="text-amber-700" />
            </div>
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">This Month Net</p>
          </div>
          <p className="text-xl font-bold text-amber-800">{formatMoney(thisMonthInc - thisMonthExp)}</p>
        </div>
        {/* Loans Pending KPI */}
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center">
              <HandCoins size={14} className="text-orange-700" />
            </div>
            <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Loans Pending</p>
          </div>
          <p className="text-xl font-bold text-orange-800">{formatMoney(loanPending)}</p>
          {loans.length > 0 && (
            <p className="text-[9px] text-orange-500 mt-0.5">{loans.filter(l => l.status === 'PENDING').length} of {loans.length} unpaid</p>
          )}
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center">
            <Activity size={14} className="text-stone-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-900">Cash Flow — Last 6 Months</p>
            <p className="text-[10px] text-stone-400">Income vs Expense trend</p>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-stone-400 text-xs">
            No transaction data yet
          </div>
        ) : (
          <AreaChart
            incomeData={incomeByMonth}
            expenseData={expenseByMonth}
            labels={months.map((m) => m.label)}
          />
        )}
      </div>

      {/* Donut + Bar side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Distribution */}
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center">
              <PieChart size={14} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-900">Revenue by Source</p>
              <p className="text-[10px] text-stone-400">Top income-generating projects</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <DonutChart slices={revenueSlices} />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {revenueSlices.map((sl, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sl.color }} />
                  <p className="text-[10px] text-stone-600 truncate flex-1">{sl.label}</p>
                  <p className="text-[10px] font-semibold text-stone-700 flex-shrink-0">{formatMoney(sl.value)}</p>
                </div>
              ))}
              {revenueSlices.length === 0 && (
                <p className="text-[10px] text-stone-400">No income recorded yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center">
              <BarChart2 size={14} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-900">Expense Breakdown</p>
              <p className="text-[10px] text-stone-400">By category</p>
            </div>
          </div>
          <HorizBar data={expenseSlices} />
        </div>
      </div>

      {/* ── Loans Overview ─────────────────────────────────────────────────── */}
      {loans.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center">
                <HandCoins size={14} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-900">Loans Overview</p>
                <p className="text-[10px] text-stone-400">Money lent out — pending vs recovered</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[9px] text-stone-400 uppercase tracking-wide">Total Lent</p>
                <p className="text-sm font-bold text-stone-800">{formatMoney(loanTotal)}</p>
              </div>
            </div>
          </div>

          {/* Pending vs Paid summary bar */}
          {loanTotal > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-orange-600 font-semibold">Pending — {formatMoney(loanPending)}</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Recovered — {formatMoney(loanPaid)}</span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-700"
                  style={{ width: `${clamp((loanPending / loanTotal) * 100, 0, 100)}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-400 transition-all duration-700"
                  style={{ width: `${clamp((loanPaid / loanTotal) * 100, 0, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Loan itemised list */}
          <div className="space-y-2">
            {loans.map((loan) => {
              const isPending = loan.status === 'PENDING'
              const isOverdue = isPending && loan.due_date && new Date(loan.due_date) < new Date()
              return (
                <div
                  key={loan.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isOverdue
                      ? 'bg-red-50/60 border-red-100'
                      : isPending
                      ? 'bg-orange-50/40 border-orange-100'
                      : 'bg-emerald-50/30 border-emerald-100'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isOverdue ? 'bg-red-100' : isPending ? 'bg-orange-100' : 'bg-emerald-100'
                  }`}>
                    {isPending
                      ? <AlertCircle size={13} className={isOverdue ? 'text-red-600' : 'text-orange-600'} />
                      : <CheckCircle2 size={13} className="text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-800 truncate">{loan.title}</p>
                    {loan.due_date && (
                      <p className={`text-[10px] mt-0.5 ${
                        isOverdue ? 'text-red-500 font-semibold' : 'text-stone-400'
                      }`}>
                        {isOverdue ? '⚠ Overdue · ' : 'Due '}
                        {new Date(loan.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {loan.notes && <p className="text-[10px] text-stone-400 truncate mt-0.5">{loan.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-stone-900">{formatMoney(Number(loan.amount))}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${
                      isOverdue ? 'text-red-500' : isPending ? 'text-orange-500' : 'text-emerald-600'
                    }`}>
                      {isOverdue ? 'Overdue' : isPending ? 'Pending' : 'Paid'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
