'use client'
// src/components/billing/PaymentReminderButton.tsx
// Button on each billing row: log when client promised to pay + set a calendar reminder.

import { useState } from 'react'
import { Bell, BellRing, X, CalendarClock } from 'lucide-react'

interface Props {
  projectId: string
  projectName: string
  clientName?: string
  initialPromiseDate?: string | null
  initialReminderDate?: string | null
  initialReminderNote?: string | null
}

export function PaymentReminderButton({
  projectId,
  projectName,
  clientName,
  initialPromiseDate,
  initialReminderDate,
  initialReminderNote,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [promiseDate, setPromiseDate] = useState(
    initialPromiseDate ? initialPromiseDate.slice(0, 10) : ''
  )
  const [reminderDate, setReminderDate] = useState(
    initialReminderDate ? initialReminderDate.slice(0, 16) : ''
  )
  const [note, setNote] = useState(initialReminderNote ?? '')
  const [saved, setSaved] = useState(false)

  const hasReminder = !!initialReminderDate

  async function save() {
    setSaving(true)
    try {
      // 1. Update project with promise_to_pay_date, reminder_date, reminder_note
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promise_to_pay_date: promiseDate || null,
          reminder_date: reminderDate ? new Date(reminderDate).toISOString() : null,
          reminder_note: note || null,
        }),
      })

      // 2. If reminder date set, create a calendar event
      if (reminderDate) {
        const reminderDt = new Date(reminderDate)
        const endDt = new Date(reminderDt.getTime() + 30 * 60 * 1000) // 30 min slot
        const title = `💰 Follow up: ${clientName ?? projectName} — ask for payment`
        const description = [
          `Project: ${projectName}`,
          promiseDate ? `Client promised to pay on: ${promiseDate}` : '',
          note ? `Note: ${note}` : '',
        ].filter(Boolean).join('\n')

        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            type: 'REMINDER',
            startTime: reminderDt.toISOString(),
            endTime: endDt.toISOString(),
            projectId,
          }),
        })
      }

      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={hasReminder ? 'Reminder set — click to edit' : 'Set payment reminder'}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all hover:opacity-80 ${
          hasReminder
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-stone-50 text-stone-400 border-stone-200 hover:text-stone-600'
        }`}
      >
        {hasReminder ? <BellRing size={11} /> : <Bell size={11} />}
        {hasReminder ? 'Reminder' : 'Remind me'}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <CalendarClock size={15} className="text-amber-500" />
                  Payment Reminder
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5 truncate max-w-[220px]">{projectName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Promise date */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                  📅 Client said they&apos;ll pay on
                </label>
                <input
                  type="date"
                  value={promiseDate}
                  onChange={e => setPromiseDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <p className="text-[10px] text-stone-400 mt-1">When the client verbally promised to pay</p>
              </div>

              {/* Reminder date */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                  🔔 Remind me to follow up on
                </label>
                <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <p className="text-[10px] text-stone-400 mt-1">A calendar event will be created automatically</p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                  📝 Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder={`e.g. ${clientName ?? 'Client'} said they'll transfer after salary...`}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || (!promiseDate && !reminderDate)}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                {saved ? '✓ Saved!' : saving ? 'Saving…' : reminderDate ? '📅 Save & Add to Calendar' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
