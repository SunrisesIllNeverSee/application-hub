import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SavePair {
  archived_question_id: string
  answer: string
  confidence?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, pairs } = body as {
      session_id?: string
      pairs?: SavePair[]
    }

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({ error: 'pairs must be a non-empty array' }, { status: 400 })
    }

    // Filter to pairs that have a real archived_question_id
    const validPairs = pairs.filter(
      (p) => p.archived_question_id && typeof p.archived_question_id === 'string' && p.answer
    )

    let savedCount = 0

    if (validPairs.length > 0) {
      const upsertRows = validPairs.map((p) => ({
        user_id: user.id,
        archived_question_id: p.archived_question_id,
        content: p.answer,
        confidence: (p.confidence === 'solid' || p.confidence === 'locked') ? p.confidence : 'draft',
        word_count: p.answer.trim().split(/\s+/).filter(Boolean).length,
        version: 1,
      }))

      const { error: upsertError, count } = await supabase
        .from('profile_answers')
        .upsert(upsertRows, {
          onConflict: 'user_id,archived_question_id',
          ignoreDuplicates: false,
        })
        .select()

      if (upsertError) {
        console.error('[/api/import/application/save] upsert failed:', upsertError)
        return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 })
      }

      savedCount = count ?? validPairs.length
    }

    // Update session status and saved_count
    await supabase
      .from('app_import_sessions')
      .update({ status: 'complete', saved_count: savedCount })
      .eq('id', session_id)
      .eq('user_id', user.id)

    return NextResponse.json({ saved: savedCount })
  } catch (err) {
    console.error('[/api/import/application/save] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
