// src/app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server'

const TASK_KEYWORDS = ['idea', 'generate', 't-shirt', 'create']

export async function POST(req: NextRequest) {
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
