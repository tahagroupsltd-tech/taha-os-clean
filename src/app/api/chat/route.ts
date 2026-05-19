// src/app/api/chat/route.ts
// Conversational agent endpoint. Calls OpenAI's Chat Completions with tool
// support and runs tools server-side using the logged-in user's role.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { TOOL_DEFS, runTool } from '@/lib/agent/tools'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const MAX_TOOL_HOPS = 6 // safety cap for the tool loop

interface ChatMsg {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: any[]
  name?: string
}

// ── POST /api/chat ──────────────────────────────────────────
// body: { messages: [{ role, content }, ...] }  (no system message; we add ours)
export async function POST(req: NextRequest) {
  try {
    return await handleChat(req)
  } catch (err: any) {
    console.error('[chat] Unhandled error:', err?.stack ?? err)
    return NextResponse.json(
      { error: `Server error: ${err?.message ?? String(err)}` },
      { status: 500 }
    )
  }
}

async function handleChat(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Strip any non-ASCII / whitespace that could corrupt the Authorization header
  const apiKey = process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, '').trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.',
      },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const incoming: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
  }

  // Use IST (Asia/Kolkata, UTC+5:30) so relative words like "tomorrow" are correct for the user
  const nowIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  // en-CA gives YYYY-MM-DD format

  const systemPrompt = `You are an assistant inside Taha Media OS, an internal ops platform for a content/marketing agency.

You help the logged-in user create and manage tasks, content items, calendar events, projects, team users, and CRM records (leads, contacts, companies, deals) — by calling the available tools.

Current user: ${user.name} (@${user.username}), role: ${user.role}
Current date & time (IST): ${nowIST}
Today (ISO): ${todayIST}

Rules:
- When the user references someone or something by name (e.g. "editor1", "AXS", "Sneha", "Karthick"), call list_users / list_projects / list_contacts / list_companies / list_leads FIRST to resolve to an id, then call the create_* or update_* tool with that id.
- Always set times in ISO 8601. For dates without an explicit time, default startTime to 09:00 and endTime to 18:00 of that date.
- For calendar entries spanning multiple days, treat the user's request as a single event (startTime = day 1 09:00, endTime = last day 18:00) UNLESS they say "every day" or "daily", in which case ask for clarification.
- Do not repeat tool calls you've already executed in this turn.
- After all tools succeed, reply with a short confirmation in plain language ("Done — Aruvi Shoot scheduled for tomorrow, 20 May from 8 AM to 10 PM"). Do NOT include ids in the reply.
- If a tool returns an error, explain the error in plain language and stop. Do not retry the same tool with the same args.
- Google Calendar sync: when the user creates an event or task, it is automatically synced to their Google Calendar if they have connected it in Settings. Do NOT mention Google Calendar errors or database sync issues — just confirm what was created. If the user explicitly asks about Google Calendar, tell them to check Settings → Integrations to connect it.
- CRM notes: "lead" → use CRM lead tools. "contact" or "client contact" → use CRM contact tools. "company" or "client company" → use CRM company tools. "deal" → use CRM deal tools.
- Permissions: ${user.role === 'CLIENT' ? 'You are a client. You can only view your own projects.' : user.role === 'EMPLOYEE' ? 'You are an employee. You can create tasks and content but not projects, users, or finance.' : user.role === 'MANAGER' ? 'You are a manager. You can do everything except finance and password resets.' : 'You are the founder. You can do anything.'}
- Never invent ids. Always look them up first.`

  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt },
    ...incoming.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ]

  let hops = 0
  let lastAssistant: ChatMsg | null = null

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
      console.error('[chat] OpenAI error:', res.status, text)
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

    lastAssistant = msg

    // No tool calls → final reply
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return NextResponse.json({
        reply: msg.content ?? '',
        finishReason: choice.finish_reason,
        hops,
      })
    }

    // Append the assistant message with its tool_calls
    messages.push({
      role: 'assistant',
      content: msg.content,
      tool_calls: msg.tool_calls,
    })

    // Execute each tool, append results
    for (const call of msg.tool_calls) {
      let parsedArgs: any = {}
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}')
      } catch {
        parsedArgs = {}
      }
      const result = await runTool(call.function.name, parsedArgs, user)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result).slice(0, 4000), // cap size
      })
    }
  }

  // Hit hop limit
  return NextResponse.json({
    reply:
      lastAssistant?.content ??
      'I ran out of steps. Try simplifying or splitting your request.',
    finishReason: 'tool_limit',
    hops,
  })
}
