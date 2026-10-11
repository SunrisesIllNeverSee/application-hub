import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isLocalFirst,
  publicUrlForLocalFirstStorage,
  refusePrivateTextFields,
} from '@/lib/local-first-guard'

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    // F-B7: url + program_name are public-program catalog metadata;
    // questions_text is a free-text channel into import_queue.raw_text and
    // refuses under local-first.
    const refused = refusePrivateTextFields(body as Record<string, unknown>, ['questions_text'])
    if (refused) return refused
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

    // FB7R-01: under local-first the stored URL keeps scheme+host+path only —
    // query/fragment/userinfo would otherwise persist user-supplied text into
    // import_queue.raw_text through the one field meant to carry it.
    let storedUrl = url
    if (isLocalFirst()) {
      const sanitized = publicUrlForLocalFirstStorage(url)
      if (sanitized.refuse) return sanitized.refuse
      storedUrl = sanitized.url
    }

    const rawText = questions_text?.trim() || storedUrl

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
