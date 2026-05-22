'use client'
// src/app/(dashboard)/projects/[id]/page.tsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  formatDate, PROJECT_STATUS_LABELS, projectStatusColor,
  taskStatusColor, contentStatusColor, KANBAN_STAGE_LABELS, kanbanStageColor,
  TRANSACTION_CATEGORY_LABELS, formatMoney,
} from '@/lib/utils'
import type { Project, ProjectStatus, Task, Content, TaskStatus, ContentStatus, KanbanStage, TransactionCategory } from '@/types'
import {
  ArrowLeft, CheckSquare, FileVideo, Calendar, User as UserIcon,
  FolderOpen, CalendarRange, BookMarked, Upload, ExternalLink,
  FileText, Film, Image, File, Folder, RefreshCw, Link2, X, AlertCircle, Clock, Trash,
  TrendingUp, TrendingDown, IndianRupee, Plus, Wallet,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import toast from 'react-hot-toast'

const SOP_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',   2: 'bg-violet-100 text-violet-800',
  3: 'bg-amber-100 text-amber-800', 4: 'bg-red-100 text-red-800',
  5: 'bg-stone-100 text-stone-700', 6: 'bg-orange-100 text-orange-800',
  7: 'bg-green-100 text-green-800',
}
const SOP_LABELS: Record<number, string> = {
  1: 'L1 · Sales & Onboarding', 2: 'L2 · PM Setup',
  3: 'L3 · Script Prep',        4: 'L4 · Script Approval 🔒',
  5: 'L5 · Shoot Logistics',    6: 'L6 · Shoot Day',
  7: 'L7 · Post-Production',
}

interface DriveFile {
  id: string; name: string; mimeType: string
  size?: string | null; modifiedTime?: string | null
  webViewLink?: string | null; isFolder: boolean
}
interface ProjectDetail extends Project { tasks: Task[]; content: Content[] }

function DrivePanel({ projectId, driveFolder, canEdit }: {
  projectId: string; driveFolder: string | null | undefined; canEdit: boolean
}) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folderUrl, setFolderUrl] = useState(driveFolder ?? '')
  const [editingUrl, setEditingUrl] = useState(!driveFolder)
  const [savingUrl, setSavingUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const extractFolderId = (url: string) => url.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? null
  const folderId = extractFolderId(folderUrl)

  const loadFiles = useCallback(async () => {
    if (!folderId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error === 'NO_TOKEN' || json.error === 'NO_DRIVE_SCOPE' ? 'reconnect' : (json.error ?? 'Failed to load files'))
        return
      }
      setFiles(json.data ?? [])
    } catch { setError('Network error') } finally { setLoading(false) }
  }, [folderId])

  useEffect(() => { if (folderId) loadFiles() }, [folderId, loadFiles])

  const saveUrl = async () => {
    if (!folderUrl.trim()) return
    setSavingUrl(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolder: folderUrl.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Drive folder linked'); setEditingUrl(false)
    } catch { toast.error('Could not save folder URL') } finally { setSavingUrl(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !folderId) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('folderId', folderId); form.append('file', file)
      const res = await fetch('/api/drive/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      toast.success(`${file.name} uploaded`); loadFiles()
    } catch (err: any) { toast.error(err.message ?? 'Upload failed') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const fileIcon = (mimeType: string, isFolder: boolean) => {
    if (isFolder) return <Folder size={13} className="text-amber-500 flex-shrink-0" />
    if (mimeType.includes('video')) return <Film size={13} className="text-blue-500 flex-shrink-0" />
    if (mimeType.includes('image')) return <Image size={13} className="text-green-500 flex-shrink-0" />
    if (mimeType.includes('pdf') || mimeType.includes('document'))
      return <FileText size={13} className="text-red-400 flex-shrink-0" />
    return <File size={13} className="text-stone-400 flex-shrink-0" />
  }

  const fmtSize = (b?: string | null) => {
    if (!b) return ''; const n = parseInt(b)
    return n > 1_048_576 ? `${(n/1_048_576).toFixed(1)} MB` : n > 1024 ? `${(n/1024).toFixed(0)} KB` : `${n} B`
  }

  return (
    <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen size={13} /> Drive Files
        </p>
        <div className="flex items-center gap-2">
          {folderId && (
            <>
              <a href={folderUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-700 transition-colors">
                <ExternalLink size={11} /> Open folder
              </a>
              <button onClick={loadFiles} className="text-stone-400 hover:text-stone-700 transition-colors" title="Refresh">
                <RefreshCw size={12} />
              </button>
            </>
          )}
          {canEdit && folderId && !editingUrl && (
            <button onClick={() => setEditingUrl(true)} className="text-stone-400 hover:text-stone-700 transition-colors" title="Change folder">
              <Link2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {(editingUrl || !folderId) && canEdit && (
          <div className="flex items-center gap-2 mb-4">
            <input type="text" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="Paste Google Drive folder URL…"
              className="flex-1 text-xs border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 bg-stone-50" />
            <button onClick={saveUrl} disabled={savingUrl || !folderUrl.trim()}
              className="text-xs px-3 py-2 bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-40 transition-colors">
              {savingUrl ? 'Saving…' : 'Link'}
            </button>
            {folderId && <button onClick={() => setEditingUrl(false)} className="text-stone-400 hover:text-stone-700"><X size={14} /></button>}
          </div>
        )}

        {!folderId && (
          <p className="text-xs text-stone-400 text-center py-6">
            {canEdit ? 'Paste a Google Drive folder URL above to browse and upload files.' : 'No Drive folder linked yet.'}
          </p>
        )}

        {error === 'reconnect' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-md mb-3">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-800">Drive access required</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Your Google account needs Drive permission.{' '}
                <a href="/api/auth/google-calendar" className="underline font-medium">Reconnect Google in Settings</a>{' '}
                to enable file browsing and uploads.
              </p>
            </div>
          </div>
        )}
        {error && error !== 'reconnect' && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        )}

        {!loading && folderId && !error && (
          <>
            {files.length === 0
              ? <p className="text-xs text-stone-400 text-center py-4">Folder is empty</p>
              : (
                <div className="divide-y divide-stone-50 -mx-4 mb-3">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-stone-50/60 group">
                      {fileIcon(f.mimeType, f.isFolder)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-800 truncate">{f.name}</p>
                        {f.modifiedTime && (
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            {new Date(f.modifiedTime).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                            {f.size ? ` · ${fmtSize(f.size)}` : ''}
                          </p>
                        )}
                      </div>
                      {f.webViewLink && (
                        <a href={f.webViewLink} target="_blank" rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-700 transition-all" title="Open in Drive">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-stone-400">{files.length} item{files.length !== 1 ? 's' : ''}</p>
              <label className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                uploading ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-stone-900 text-white hover:bg-stone-700'}`}>
                <Upload size={11} />
                {uploading ? 'Uploading…' : 'Upload file'}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function fmtMins(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const canSchedule = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [timeLogs, setTimeLogs] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'SHOOT_COST', date: '', notes: '' })
  const [savingExpense, setSavingExpense] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetch(`/api/projects/${params.id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null } return r.json() })
      .then(j => { if (j?.data) setProject(j.data) })
      .finally(() => setLoading(false))
  }, [params?.id])

  useEffect(() => {
    if (!params?.id) return
    fetch(`/api/time-logs?projectId=${params.id}`)
      .then(r => r.json())
      .then(j => {
        setTotalMinutes(j.totalMinutes ?? 0)
        setTimeLogs(j.data ?? [])
      })
  }, [params?.id])

  const fetchTransactions = useCallback(async () => {
    if (!params?.id) return
    try {
      const res = await fetch(`/api/transactions?projectId=${params.id}`)
      const json = await res.json()
      if (json.data) {
        setTransactions(json.data)
        setIncome(json.summary?.income ?? 0)
        setExpenses(json.summary?.expense ?? 0)
      }
    } catch { /* silent */ }
  }, [params?.id])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  if (loading) return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Project" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="bg-white rounded-lg border border-stone-100 p-5">
          <Skeleton className="h-5 w-48 mb-3" /><Skeleton className="h-3 w-full mb-2" /><Skeleton className="h-3 w-3/4" />
        </div>
        {[1,2].map(i => (
          <div key={i} className="bg-white rounded-lg border border-stone-100 p-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            {[1,2,3].map(j => <div key={j} className="flex items-center gap-3"><Skeleton className="h-3 flex-1" /><Skeleton className="h-5 w-16 rounded-full" /></div>)}
          </div>
        ))}
      </div>
    </div>
  )

  if (notFound || !project) return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Project" />
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="text-sm font-medium text-stone-600">Project not found</p>
        <Button size="sm" variant="secondary" onClick={() => router.push('/projects')}>Back to projects</Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={project.name} actions={
        <div className="flex items-center gap-2">
          {canSchedule && (
            <Link href="/schedule" className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-md transition-colors">
              <CalendarRange size={12} /> Bulk Schedule
            </Link>
          )}
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100">
            <ArrowLeft size={12} /> All projects
          </Link>
        </div>
      } />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Project meta */}
        <div className="bg-white rounded-lg border border-stone-100 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-stone-900 mb-1">{project.name}</h2>
              {project.description && <p className="text-xs text-stone-500 leading-relaxed">{project.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={projectStatusColor(project.status)}>{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
              {project.boardColumn && (
                <Badge className={kanbanStageColor(project.boardColumn as KanbanStage)}>{KANBAN_STAGE_LABELS[project.boardColumn as KanbanStage]}</Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-stone-50">
            <MetaCell icon={<UserIcon size={11} />} label="Client" value={project.client?.name ?? '—'} />
            <MetaCell icon={<Calendar size={11} />} label="Start" value={project.startDate ? formatDate(project.startDate) : '—'} />
            <MetaCell icon={<Calendar size={11} />} label="Due" value={project.dueDate ? formatDate(project.dueDate) : '—'} />
            <MetaCell icon={<CheckSquare size={11} />} label="Activity" value={`${project.tasks.length} tasks · ${project.content.length} content`} />
            <MetaCell icon={<Clock size={11} />} label="Hours Logged" value={totalMinutes > 0 ? fmtMins(totalMinutes) : '—'} />
            {(income > 0 || expenses > 0) && (
              <>
                <MetaCell icon={<TrendingUp size={11} />} label="Income" value={formatMoney(income)} />
                <MetaCell icon={<TrendingDown size={11} />} label="Expenses" value={formatMoney(expenses)} />
                <MetaCell icon={<Wallet size={11} />} label="Net Profit" value={formatMoney(income - expenses)} />
              </>
            )}
            {project.sopLevel != null && (
              <div className="col-span-2 md:col-span-4">
                <div className="flex items-center gap-1 text-[10px] font-medium text-stone-400 uppercase tracking-wide mb-1">
                  <BookMarked size={11} /> SOP Level
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-block ${SOP_COLORS[project.sopLevel]}`}>
                  {SOP_LABELS[project.sopLevel] ?? `Level ${project.sopLevel}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Drive Files */}
        <DrivePanel projectId={project.id} driveFolder={project.driveFolder} canEdit={canEdit} />

        {/* Time Logs */}
        {timeLogs.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} /> Time Logged
              </p>
              <span className="text-xs font-bold text-stone-900">{fmtMins(totalMinutes)} total</span>
            </div>
            <div className="divide-y divide-stone-50">
              {timeLogs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[9px] font-bold text-stone-600">
                    {log.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-stone-700">{log.user?.name ?? 'Unknown'}</p>
                    {log.note && <p className="text-[10px] text-stone-400 truncate">{log.note}</p>}
                  </div>
                  <span className="text-xs font-semibold text-stone-900">{fmtMins(log.minutes)}</span>
                  <span className="text-[10px] text-stone-400">
                    {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
              {timeLogs.length > 10 && (
                <p className="text-[10px] text-stone-400 text-center py-2">+{timeLogs.length - 10} more entries</p>
              )}
            </div>
          </div>
        )}

        {/* Tasks */}
        <Section title="Tasks" icon={<CheckSquare size={13} />} count={project.tasks.length} empty="No tasks on this project yet">
          {project.tasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-900 truncate">{t.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                  {t.assignedTo && <span>{t.assignedTo.name}</span>}
                  {t.deadline && (<><span>·</span><span>Due {formatDate(t.deadline)}</span></>)}
                </div>
              </div>
              <Badge className={taskStatusColor(t.status as TaskStatus)}>{t.status.replace('_', ' ')}</Badge>
            </div>
          ))}
        </Section>

        {/* Content */}
        <Section title="Content" icon={<FileVideo size={13} />} count={project.content.length} empty="No content on this project yet">
          {project.content.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-900 truncate">{c.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                  <span>{c.type}</span>
                  {c.assignee && (<><span>·</span><span>{c.assignee.name}</span></>)}
                  {c.postDate && (<><span>·</span><span>{formatDate(c.postDate)}</span></>)}
                </div>
              </div>
              <Badge className={contentStatusColor(c.status as ContentStatus)}>{c.status}</Badge>
            </div>
          ))}
        </Section>

        {/* Financials */}
        <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={13} /> Financials
            </p>
            {canEdit && (
              <button
                onClick={() => setShowExpenseModal(true)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100 transition-colors"
              >
                <Plus size={11} /> Add Expense
              </button>
            )}
          </div>

          {/* Summary strip */}
          {(income > 0 || expenses > 0) && (
            <div className="grid grid-cols-3 border-b border-stone-50">
              <div className="px-4 py-3 border-r border-stone-50">
                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp size={10} className="text-green-500" /> Income
                </p>
                <p className="text-sm font-bold text-green-700 mt-0.5">{formatMoney(income)}</p>
              </div>
              <div className="px-4 py-3 border-r border-stone-50">
                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide flex items-center gap-1">
                  <TrendingDown size={10} className="text-red-500" /> Expenses
                </p>
                <p className="text-sm font-bold text-red-600 mt-0.5">{formatMoney(expenses)}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">Net</p>
                <p className={`text-sm font-bold mt-0.5 ${(income - expenses) >= 0 ? 'text-stone-900' : 'text-red-600'}`}>
                  {formatMoney(income - expenses)}
                </p>
              </div>
            </div>
          )}

          {/* Transaction list */}
          {transactions.length === 0
            ? <p className="text-xs text-stone-400 text-center py-8">No transactions linked to this project yet</p>
            : (
              <div className="divide-y divide-stone-50">
                {transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.type === 'INCOME' ? 'bg-green-500' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-800 truncate">{t.title}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {TRANSACTION_CATEGORY_LABELS[t.category as TransactionCategory] ?? t.category}
                        {t.date && <> · {formatDate(t.date)}</>}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>
                      {t.type === 'INCOME' ? '+' : '−'}{formatMoney(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <Modal open={showExpenseModal} title="Add Expense" onClose={() => { setShowExpenseModal(false); setExpenseForm({ title: '', amount: '', category: 'SHOOT_COST', date: '', notes: '' }) }}>
          <div className="space-y-3">
            <Input
              label="Title"
              placeholder="e.g. Shoot at Mumbai studio"
              value={expenseForm.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm(f => ({ ...f, title: e.target.value }))}
            />
            <Input
              label="Amount (₹)"
              type="number"
              placeholder="0"
              value={expenseForm.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
            />
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                className="w-full text-xs border border-stone-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                <option value="SHOOT_COST">Shoot Cost</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="ADS">Ads / Paid Media</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="SOFTWARE">Software</option>
                <option value="MARKETING">Marketing</option>
                <option value="TRAVEL">Travel</option>
                <option value="RENT">Rent</option>
                <option value="UTILITIES">Utilities</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <Input
              label="Date"
              type="date"
              value={expenseForm.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm(f => ({ ...f, date: e.target.value }))}
            />
            <Input
              label="Notes (optional)"
              placeholder="Any details…"
              value={expenseForm.notes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowExpenseModal(false); setExpenseForm({ title: '', amount: '', category: 'SHOOT_COST', date: '', notes: '' }) }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={savingExpense || !expenseForm.title.trim() || !expenseForm.amount}
                onClick={async () => {
                  setSavingExpense(true)
                  try {
                    const res = await fetch('/api/transactions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: expenseForm.title.trim(),
                        amount: parseFloat(expenseForm.amount),
                        type: 'EXPENSE',
                        category: expenseForm.category,
                        date: expenseForm.date || undefined,
                        notes: expenseForm.notes.trim() || undefined,
                        projectId: params.id,
                      }),
                    })
                    if (!res.ok) throw new Error()
                    toast.success('Expense recorded')
                    setShowExpenseModal(false)
                    setExpenseForm({ title: '', amount: '', category: 'SHOOT_COST', date: '', notes: '' })
                    fetchTransactions()
                  } catch {
                    toast.error('Could not save expense')
                  } finally {
                    setSavingExpense(false)
                  }
                }}
              >
                {savingExpense ? 'Saving…' : 'Save Expense'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-medium text-stone-400 uppercase tracking-wide">{icon} {label}</div>
      <p className="text-xs font-medium text-stone-900 mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Section({ title, icon, count, empty, children }: {
  title: string; icon: React.ReactNode; count: number; empty: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">{icon}{title}</p>
        <p className="text-[10px] text-stone-400">{count}</p>
      </div>
      {count === 0
        ? <p className="text-xs text-stone-400 text-center py-8">{empty}</p>
        : <div className="divide-y divide-stone-50">{children}</div>}
    </div>
  )
}
