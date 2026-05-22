'use client'
// src/app/(dashboard)/settings/settings-client.tsx
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { KeyRound, Shield, CalendarDays, CheckCircle2, AlertCircle, RefreshCw, Unlink, Bell, BellOff, Eye, EyeOff, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

interface SimpleUser {
  id: string
  username: string
  name: string
  role: string
}

interface Props {
  currentUserId: string
  canResetOthers: boolean
  users: SimpleUser[]
  gcalConnected: boolean
  calendarReminderMins: number | null
}

export function SettingsClient({ currentUserId, canResetOthers, users, gcalConnected, calendarReminderMins }: Props) {
  // ── Self-service password change ───────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingSelf, setSavingSelf] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  // ── Admin reset show/hide ──────────────────────────────────
  const [showResetPw, setShowResetPw] = useState(false)

  const handleChangeOwn = async () => {
    if (newPw.length < 6) return toast.error('New password must be at least 6 characters')
    if (newPw !== confirmPw) return toast.error('Passwords do not match')
    setSavingSelf(true)
    try {
      const res = await fetch(`/api/users/${currentUserId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(json.message ?? 'Password updated')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSavingSelf(false)
    }
  }

  // ── Admin reset for other users ────────────────────────────
  const [targetUserId, setTargetUserId] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [savingReset, setSavingReset] = useState(false)

  const handleAdminReset = async () => {
    if (!targetUserId) return toast.error('Pick a user')
    if (resetPw.length < 6) return toast.error('Password must be at least 6 characters')
    setSavingReset(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPw }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(json.message ?? 'Password reset')
      setTargetUserId('')
      setResetPw('')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSavingReset(false)
    }
  }

  const otherUsers = users.filter((u) => u.id !== currentUserId)

  // ── Google Calendar section ────────────────────────────────
  const searchParams = useSearchParams()

  // Show toast based on OAuth redirect result
  useEffect(() => {
    const gcal = searchParams.get('gcal')
    const gcalError = searchParams.get('gcal_error')
    if (gcal === 'connected') {
      toast.success('Google Calendar connected!')
      // Clean URL
      window.history.replaceState({}, '', '/settings')
    } else if (gcalError) {
      const raw = decodeURIComponent(gcalError).replace(/_/g, ' ')
      const msg =
        gcalError === 'access_denied'
          ? 'Access denied — please grant Calendar permission.'
          : gcalError === 'needs_revoke'
          ? 'Please go to myaccount.google.com/permissions → remove this app, then try connecting again.'
          : raw.includes('redirect uri mismatch') || raw.includes('redirect_uri_mismatch')
          ? 'Google OAuth error: redirect_uri_mismatch. Ensure https://taha-os-clean.vercel.app/api/auth/google-calendar/callback is in Google Cloud Console → Credentials → Authorised redirect URIs.'
          : raw.includes('invalid grant') || raw.includes('invalid_grant')
          ? 'Auth code expired — please click Connect again to get a fresh code.'
          : `Calendar connection failed: ${raw}`
      toast.error(msg, { duration: 15000 })
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  const [connected, setConnected] = useState(gcalConnected)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Reminder preference state
  const [reminderEnabled, setReminderEnabled] = useState(calendarReminderMins != null)
  const [reminderMins, setReminderMins] = useState<string>(
    calendarReminderMins != null ? String(calendarReminderMins) : ''
  )
  const [savingReminder, setSavingReminder] = useState(false)

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Future events will no longer be created.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/google-calendar/disconnect', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disconnect')
      setConnected(false)
      toast.success('Google Calendar disconnected')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/gcal/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(json.message)
    } catch (err: any) {
      toast.error(err.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveReminder = async () => {
    const mins = reminderEnabled && reminderMins !== ''
      ? parseInt(reminderMins, 10)
      : null

    if (reminderEnabled && (isNaN(mins as number) || (mins as number) <= 0)) {
      return toast.error('Enter a valid number of minutes (e.g. 30)')
    }

    setSavingReminder(true)
    try {
      const res = await fetch('/api/gcal/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderMins: mins }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(
        mins != null
          ? `Reminder set: ${mins} minute${mins === 1 ? '' : 's'} before`
          : 'Reminders disabled'
      )
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSavingReminder(false)
    }
  }

  return (
    <>
      {/* Self-service password change */}
      <div className="bg-white rounded-lg border border-stone-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={14} className="text-stone-500" />
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            Change My Password
          </h2>
        </div>
        <div className="space-y-3 max-w-md">
          <Input
            label="Current password"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Your current password"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Input
                label="New password"
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(v => !v)}
                className="absolute right-2.5 bottom-2 text-stone-400 hover:text-stone-700"
              >
                {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Confirm new password"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-type"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(v => !v)}
                className="absolute right-2.5 bottom-2 text-stone-400 hover:text-stone-700"
              >
                {showConfirmPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <Button size="sm" loading={savingSelf} onClick={handleChangeOwn}>
            Update password
          </Button>
        </div>
      </div>

      {/* Reset another user's password (admin + manager, scope-limited at server) */}
      {canResetOthers && otherUsers.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} className="text-stone-500" />
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Reset Another User's Password
            </h2>
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2.5 mb-3 max-w-md">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Use this to reset a teammate or client's password. After resetting, copy the password and share it via a <strong>private message, Signal, or WhatsApp</strong> — never over email or Slack.
            </p>
          </div>
          <div className="space-y-3 max-w-md">
            <Select
              label="User"
              placeholder="Pick a user"
              options={otherUsers.map((u) => ({
                value: u.id,
                label: `${u.name} (@${u.username}) — ${u.role}`,
              }))}
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
            />
            <div className="relative">
              <Input
                label="New password"
                type={showResetPw ? 'text' : 'password'}
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Set a new password"
              />
              <div className="absolute right-2.5 bottom-2 flex items-center gap-1">
                {resetPw && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(resetPw); toast.success('Copied') }}
                    className="text-stone-400 hover:text-stone-700"
                    title="Copy password"
                  >
                    <Copy size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowResetPw(v => !v)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  {showResetPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <Button size="sm" loading={savingReset} onClick={handleAdminReset}>
              Reset password
            </Button>
          </div>
        </div>
      )}

      {/* ── Google Calendar Integration ───────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-stone-500" />
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Google Calendar
            </h2>
          </div>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
              <CheckCircle2 size={10} />
              Connected
            </span>
          )}
        </div>

        <p className="text-[11px] text-stone-400 mb-4 leading-relaxed max-w-lg">
          Connect your Google account so tasks and content deadlines are automatically added to your
          Google Calendar — with a popup alarm before they're due.
        </p>

        {!connected ? (
          /* ── Not connected ── */
          <div className="space-y-3 max-w-md">
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                <span className="font-semibold">What gets synced:</span><br />
                • Your assigned tasks → deadline reminder event<br />
                • Content you're editing → post-date reminder event<br />
                • Content you schedule (manager) → posting day event
              </p>
            </div>
            <a
              href="/api/auth/google-calendar"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-700 transition-colors"
            >
              {/* Google "G" icon via SVG */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Calendar
            </a>
          </div>
        ) : (
          /* ── Connected ── */
          <div className="space-y-4 max-w-md">
            {/* Reminder preference */}
            <div className="rounded-md border border-stone-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-stone-500" />
                <p className="text-xs font-semibold text-stone-700">Popup Reminder</p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => {
                    setReminderEnabled(e.target.checked)
                    if (!e.target.checked) setReminderMins('')
                  }}
                  className="rounded border-stone-300 accent-stone-800"
                />
                <span className="text-xs text-stone-700">Enable popup alarm before events</span>
              </label>

              {reminderEnabled && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={reminderMins}
                    onChange={(e) => setReminderMins(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-24 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <span className="text-xs text-stone-500">minutes before</span>
                </div>
              )}

              {/* Quick presets */}
              {reminderEnabled && (
                <div className="flex items-center gap-1.5 pl-6">
                  {[15, 30, 60, 120].map((m) => (
                    <button
                      key={m}
                      onClick={() => setReminderMins(String(m))}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        reminderMins === String(m)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>
              )}

              <div className="pl-6">
                <Button size="sm" loading={savingReminder} onClick={handleSaveReminder}>
                  Save reminder
                </Button>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                loading={syncing}
                onClick={handleSync}
              >
                <RefreshCw size={12} />
                Sync all pending now
              </Button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 transition-colors"
              >
                <Unlink size={11} />
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>

            <p className="text-[10px] text-stone-400 leading-relaxed">
              "Sync all pending now" re-pushes all your upcoming tasks and content deadlines.
              Safe to run multiple times — existing events are updated, not duplicated.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
