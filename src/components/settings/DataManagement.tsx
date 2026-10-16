'use client'
// src/components/settings/DataManagement.tsx
// ADMIN-only panel for deleting finance records and client accounts.
import { useState, useEffect, useCallback } from 'react'
import { Trash2, AlertTriangle, Users, Wallet, RefreshCw, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface ClientRow {
  id: string
  name: string
  username: string
  projectCount: number
}

type Step = 'idle' | 'confirm1' | 'confirm2' | 'running' | 'done'

interface ConfirmFlowProps {
  title: string
  description: string
  confirmWord: string
  dangerLabel: string
  onConfirmed: () => Promise<void>
  onCancel: () => void
}

function ConfirmFlow({ title, description, confirmWord, dangerLabel, onConfirmed, onCancel }: ConfirmFlowProps) {
  const [step, setStep] = useState<'warn' | 'type'>('warn')
  const [typed, setTyped] = useState('')
  const [running, setRunning] = useState(false)

  const execute = async () => {
    if (typed !== confirmWord) return
    setRunning(true)
    try {
      await onConfirmed()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="border border-red-200 rounded-lg overflow-hidden">
      {/* Warning step */}
      <div className="bg-red-50 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-700">{title}</p>
          <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="bg-white px-4 py-3 space-y-3">
        {step === 'warn' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
            <button
              onClick={() => setStep('type')}
              className="text-[11px] font-semibold text-red-600 hover:text-red-800 underline"
            >
              I understand — proceed
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[11px] text-stone-600">
              Type <span className="font-mono font-bold text-red-600">{confirmWord}</span> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && typed === confirmWord && execute()}
              placeholder={`Type "${confirmWord}"`}
              autoFocus
              className="w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={execute}
                disabled={typed !== confirmWord || running}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-colors"
              >
                {running ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                {running ? 'Deleting…' : dangerLabel}
              </button>
              <Button size="sm" variant="secondary" onClick={onCancel} disabled={running}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function DataManagement() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [clientsOpen, setClientsOpen] = useState(false)
  const [singleClientId, setSingleClientId] = useState<string | null>(null)

  // Which confirm flows are open
  const [showFinanceConfirm, setShowFinanceConfirm] = useState(false)
  const [showAllClientsConfirm, setShowAllClientsConfirm] = useState(false)
  const [showSingleClientConfirm, setShowSingleClientConfirm] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoadingClients(true)
    try {
      const [usersRes, projRes] = await Promise.all([
        fetch('/api/users?role=CLIENT'),
        fetch('/api/projects?fields=id,clientId'),
      ])
      const usersJson = await usersRes.json()
      const projJson = await projRes.json()
      const users: any[] = usersJson.data ?? []
      const projects: any[] = projJson.data ?? []

      const countMap: Record<string, number> = {}
      for (const p of projects) {
        if (p.clientId) countMap[p.clientId] = (countMap[p.clientId] ?? 0) + 1
      }

      setClients(users.map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        projectCount: countMap[u.id] ?? 0,
      })))
    } catch {
      toast.error('Failed to load clients')
    } finally {
      setLoadingClients(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // ── Finance purge ──────────────────────────────────────────────────────────
  const purgeFinance = async () => {
    const res = await fetch('/api/admin/purge?action=finance', { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    toast.success(json.message, { duration: 6000 })
    setShowFinanceConfirm(false)
    setFinanceOpen(false)
  }

  // ── Remove all clients ─────────────────────────────────────────────────────
  const purgeAllClients = async () => {
    const res = await fetch('/api/admin/purge?action=clients', { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    toast.success(json.message, { duration: 6000 })
    setShowAllClientsConfirm(false)
    setClientsOpen(false)
    fetchClients()
  }

  // ── Remove single client ───────────────────────────────────────────────────
  const purgeSingleClient = async () => {
    if (!singleClientId) return
    const res = await fetch(`/api/admin/purge?action=client&clientId=${singleClientId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    toast.success(json.message, { duration: 6000 })
    setShowSingleClientConfirm(false)
    setSingleClientId(null)
    fetchClients()
  }

  const selectedClient = clients.find(c => c.id === singleClientId)

  return (
    <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-red-100 bg-red-50/50 flex items-center gap-2">
        <Trash2 size={14} className="text-red-500" />
        <h2 className="text-xs font-semibold text-red-700 uppercase tracking-wide">Data Management</h2>
        <span className="ml-auto text-[10px] font-semibold text-red-400 bg-red-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Admin Only</span>
      </div>

      <div className="divide-y divide-stone-100">

        {/* ── Finance Data ──────────────────────────────────────────────────── */}
        <div className="p-4">
          <button
            onClick={() => { setFinanceOpen(o => !o); setShowFinanceConfirm(false) }}
            className="flex items-center justify-between w-full text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-50">
                <Wallet size={13} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-800">Clear Finance Records</p>
                <p className="text-[10px] text-stone-400 mt-0.5">Delete all transactions, invoices, loans, and receivables</p>
              </div>
            </div>
            {financeOpen ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
          </button>

          {financeOpen && (
            <div className="mt-3 space-y-3">
              <div className="bg-stone-50 rounded-lg px-3 py-2.5 text-[11px] text-stone-600 space-y-1">
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-0.5 text-stone-500">
                  <li>All transactions (income &amp; expenses)</li>
                  <li>All invoices</li>
                  <li>All loans &amp; repayment records</li>
                  <li>All receivables</li>
                </ul>
                <p className="text-stone-400 mt-1.5">Projects, tasks, content, and users are <strong className="text-stone-600">not affected</strong>.</p>
              </div>

              {!showFinanceConfirm ? (
                <button
                  onClick={() => setShowFinanceConfirm(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 rounded-md px-3 py-1.5 transition-colors"
                >
                  <Trash2 size={11} /> Delete all finance data
                </button>
              ) : (
                <ConfirmFlow
                  title="Delete all finance data?"
                  description="This cannot be undone. All transactions, invoices, loans, and receivables will be permanently removed."
                  confirmWord="DELETE FINANCE"
                  dangerLabel="Delete all finance data"
                  onConfirmed={purgeFinance}
                  onCancel={() => setShowFinanceConfirm(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Client Accounts ───────────────────────────────────────────────── */}
        <div className="p-4">
          <button
            onClick={() => { setClientsOpen(o => !o); setShowAllClientsConfirm(false); setSingleClientId(null); setShowSingleClientConfirm(false) }}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Users size={13} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-800">Remove Client Accounts</p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {loadingClients ? 'Loading…' : `${clients.length} client account${clients.length !== 1 ? 's' : ''} found`}
                </p>
              </div>
            </div>
            {clientsOpen ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
          </button>

          {clientsOpen && (
            <div className="mt-3 space-y-3">
              <div className="bg-stone-50 rounded-lg px-3 py-2.5 text-[11px] text-stone-500 leading-relaxed">
                Removing a client <strong className="text-stone-700">deletes their login account</strong> and unlinks their projects. 
                Projects, tasks, and content are <strong className="text-stone-700">preserved but unlinked</strong>.
              </div>

              {/* Individual client list */}
              {clients.length > 0 ? (
                <div className="border border-stone-100 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-100">
                    <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Client Accounts</p>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {clients.map(client => (
                      <div key={client.id} className="px-3 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-stone-900">{client.name}</p>
                          <p className="text-[10px] text-stone-400 font-mono">@{client.username} · {client.projectCount} project{client.projectCount !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSingleClientId(client.id)
                            setShowSingleClientConfirm(true)
                            setShowAllClientsConfirm(false)
                          }}
                          className="text-[10px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded px-2 py-1 transition-colors flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-stone-400">
                  <CheckCircle2 size={13} className="text-green-400" /> No client accounts found.
                </div>
              )}

              {/* Single client confirm */}
              {showSingleClientConfirm && selectedClient && (
                <ConfirmFlow
                  title={`Remove ${selectedClient.name}?`}
                  description={`This will delete @${selectedClient.username}'s account and unlink their ${selectedClient.projectCount} project(s). Their project data stays but will be unlinked.`}
                  confirmWord="REMOVE CLIENT"
                  dangerLabel={`Remove ${selectedClient.name}`}
                  onConfirmed={purgeSingleClient}
                  onCancel={() => { setShowSingleClientConfirm(false); setSingleClientId(null) }}
                />
              )}

              {/* Remove all clients */}
              {clients.length > 0 && (
                <div className="pt-1 border-t border-stone-100">
                  {!showAllClientsConfirm ? (
                    <button
                      onClick={() => { setShowAllClientsConfirm(true); setShowSingleClientConfirm(false) }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 rounded-md px-3 py-1.5 transition-colors"
                    >
                      <Trash2 size={11} /> Remove all {clients.length} client account{clients.length !== 1 ? 's' : ''}
                    </button>
                  ) : (
                    <ConfirmFlow
                      title={`Remove all ${clients.length} client accounts?`}
                      description="All CLIENT accounts will be deleted. Their projects remain but become unlinked. This cannot be undone."
                      confirmWord="REMOVE ALL CLIENTS"
                      dangerLabel="Remove all clients"
                      onConfirmed={purgeAllClients}
                      onCancel={() => setShowAllClientsConfirm(false)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
