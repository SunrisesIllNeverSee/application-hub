import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { url, program_name, questions_text } = body as {
      url?: string
      program_name?: string
      questions_text?: string
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'url must be a valid http or https URL' }, { status: 400 })
    }

    const rawText = questions_text?.trim() || url

    const { data: queued, error: insertError } = await supabase
      .from('import_queue')
      .insert({
        raw_text: rawText,
        program_id: null,
        submitted_by: user.id,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !queued) {
      console.error('[/api/import/program] insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to queue program' }, { status: 500 })
    }

    return NextResponse.json({ queued: true, id: queued.id })
  } catch (err) {
    console.error('[/api/import/program] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
