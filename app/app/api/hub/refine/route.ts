import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function refineSelectedText(selectedText: string, context: string) {
  const trimmed = selectedText.trim()
  if (!trimmed) return ''

  // TODO: Your IP — replace this deterministic refinement with SigTune /
  // language quantification logic or a BYOK model call.
  const contextHints = context
    .split(/\s+/)
    .filter((word) => word.length > 6)
    .slice(0, 6)
    .join(' ')

  return `${trimmed.replace(/\s+/g, ' ')}${contextHints ? ` (${contextHints})` : ''}`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    selectedText?: string
    context?: string
  }

  if (!body.selectedText || body.selectedText.trim().length < 2) {
    return NextResponse.json({ error: 'selectedText is required' }, { status: 400 })
  }

  return NextResponse.json({
    refinedText: refineSelectedText(body.selectedText, body.context ?? ''),
    algorithm_status: 'placeholder',
  })
}
