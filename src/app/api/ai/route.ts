// src/app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

const TASK_KEYWORDS = ['idea', 'generate', 't-shirt', 'create']

export async function POST(req: NextRequest) {
  // Auth guard — this endpoint was previously open to the internet
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.input !== 'string' || !body.input.trim()) {
      return NextResponse.json(
        { type: null, data: null, error: 'input is required and must be a string' },
        { status: 400 }
      )
    }

    const input = body.input.toLowerCase()
    const isTask = TASK_KEYWORDS.some((kw) => input.includes(kw))

    if (isTask) {
      return NextResponse.json({
        type: 'task',
        data: {
          idea: 'Sample Idea',
          print_text: 'Sample Idea',
          category: 'funny',
          confidence: 0.8,
        },
        error: null,
      })
    }

    return NextResponse.json({
      type: 'chat',
      data: {
        message: 'response text',
      },
      error: null,
    })
  } catch (err: any) {
    return NextResponse.json(
      { type: null, data: null, error: err?.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
