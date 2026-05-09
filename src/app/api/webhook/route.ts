// src/app/api/webhook/route.ts
// External webhook endpoint — used by n8n (Telegram voice note pipeline).
// Auth: Bearer token via WEBHOOK_SECRET env var (no JWT cookie needed).
// POST body: { message: string }
// Returns:   { reply: string }

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { TOOL_DEFS, runTool } from '@/lib/agent/tools'
import type { AuthUser } from '@/types'

/** Timing-safe string comparison to prevent bearer-token timing attacks */
function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const MAX_TOOL_HOPS = 6

interface ChatMsg {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: any[]
  name?: string
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ─────────────────────────────────────────────────
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'WEBHOOK_SECRET not configured on server' }, { status: 500 })
    }
    const authHeader = req.headers.get('authorization') ?? ''
    const expected = `Bearer ${secret}`
    if (!safeEqual(authHeader, expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse body ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const message: string = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // ── 3. Resolve the admin/founder user from DB ────────────────
    const adminRecord = await db.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, username: true, name: true, role: true, phone: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!adminRecord) {
      return NextResponse.json({ error: 'No active admin user found in database' }, { status: 500 })
    }
    const user: AuthUser = {
      id: adminRecord.id,
      username: adminRecord.username,
      name: adminRecord.name,
      role: adminRecord.role as AuthUser['role'],
      phone: adminRecord.phone,
    }

    // ── 4. OpenAI key ────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, '').trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    // ── 5. Build prompt ──────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = `You are an assistant inside Taha Media OS, an internal ops platform for a content/marketing agency.
You help the logged-in user create and manage tasks, content items, calendar events, projects, and team users — by calling the available tools.

Current user: ${user.name} (@${user.username}), role: ${user.role}
Today's date: ${today}

This request came via Telegram voice note. The message has been transcribed — treat it exactly as you would a typed message.

Rules:
- When the user references someone or something by name (e.g. "editor1", "AXS", "Sneha"), call list_users / list_projects FIRST to resolve to an id, then call the create_* tool with that id.
- Always set times in ISO 8601. For dates without an explicit time, default startTime to 09:00 and endTime to 18:00 of that date.
- For calendar entries spanning multiple days, treat the user's request as a single event (startTime = day 1 09:00, endTime = last day 18:00) UNLESS they say "every day" or "daily".
- Do not repeat tool calls you've already executed in this turn.
- After all tools succeed, reply with a short confirmation in plain language ("Done — created event 'AXS shoot' on May 1, assigned to Sneha"). Do NOT include ids in the reply.
- If a tool returns an error, explain the error in plain language and stop.
- You are the founder. You can do anything.
- Never invent ids. Always look them up first.`

    const messages: ChatMsg[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]

    // ── 6. Agent loop ────────────────────────────────────────────
    let hops = 0
    let lastContent: string | null = null

    while (hops < MAX_TOOL_HOPS) {
      hops++

      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOL_DEFS,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `LLM error (${res.status}): ${text.slice(0, 200)}` },
          { status: 500 }
        )
      }

      const completion = await res.json()
      const choice = completion.choices?.[0]
      const msg = choice?.message
      if (!msg) {
        return NextResponse.json({ error: 'Empty LLM response' }, { status: 500 })
      }

      lastContent = msg.content

      // No tool calls → done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return NextResponse.json(
          { reply: msg.content ?? '', hops },
          { headers: { 'Cache-Control': 'no-store' } }
        )
      }

      messages.push({ role: 'assistant', content: msg.content, tool_calls: msg.tool_calls })

      for (const call of msg.tool_calls) {
        let parsedArgs: any = {}
        try { parsedArgs = JSON.parse(call.function.arguments || '{}') } catch { parsedArgs = {} }
        const result = await runTool(call.function.name, parsedArgs, user)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result).slice(0, 4000),
        })
      }
    }

    return NextResponse.json(
      { reply: lastContent ?? 'I ran out of steps. Try simplifying your request.', hops },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[webhook] Unhandled error:', err?.stack ?? err)
    return NextResponse.json(
      { error: `Server error: ${err?.message ?? String(err)}` },
      { status: 500 }
    )
  }
}
