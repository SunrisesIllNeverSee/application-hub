import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { loadEmbeddingIntegrations } from '@/lib/intake-extract'
import { embedQuestionText } from '@/lib/embed'

// POST /api/answers/capture
// Called by the Appfeeder extension when a user finishes typing in a form field.
// Semantically matches the question text against the archive, then saves a new
// answer version — never overwrites, always appends.
//
// Request:  { questionText: string, answerText: string }
// Response: { saved: boolean, questionId?: string, version?: number }

const MATCH_THRESHOLD = 0.72

export async function POST(req: Request) {
  // Auth: session cookie OR Bearer JWT (extension)
  const authHeader = req.headers.get('authorization')
  let supabase = await createClient()
  let user = (await supabase.auth.getUser()).data.user

  if (!user && authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7)
    const { createClient: createBrowserClient } = await import('@supabase/supabase-js').then((m) => m)
    const extClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )
    const { data } = await extClient.auth.getUser(jwt)
    if (data.user) {
      user = data.user
      supabase = extClient as typeof supabase
    }
  }

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { questionText, answerText } = body as { questionText?: string; answerText?: string }

  if (!questionText || !answerText || questionText.trim().length < 3 || answerText.trim().length < 10) {
    return NextResponse.json({ saved: false, reason: 'too_short' })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Match question text against archive.
  // Embedding: BYOK (Ollama/OpenAI integrations) → local Ollama → (opt-in) OpenAI.
  const byok = await loadEmbeddingIntegrations(supabase, user.id)
  const embedResult = await embedQuestionText(questionText.trim(), byok)
  let questionId: string | null = null

  if (embedResult) {
    const { data: matches } = await adminClient.rpc('match_archived_questions', {
      query_embedding: JSON.stringify(embedResult.embedding),
      match_threshold: MATCH_THRESHOLD,
      match_count: 1,
    })
    if (matches && matches.length > 0) questionId = matches[0].id
  }

  if (!questionId) {
    // No match above threshold — skip saving (don't pollute bank with unmatched answers)
    return NextResponse.json({
      saved: false,
      reason: embedResult ? 'no_match' : 'embedding_unavailable',
    })
  }

  // Get current max version for this user + question
  const { data: existing } = await supabase
    .from('profile_answers')
    .select('id, version')
    .eq('user_id', user.id)
    .eq('archived_question_id', questionId)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existing && existing.length > 0 ? (existing[0].version ?? 1) + 1 : 1

  // Skip if identical to latest version
  if (existing && existing.length > 0) {
    const { data: latest } = await supabase
      .from('profile_answers')
      .select('answer_content, content')
      .eq('id', existing[0].id)
      .single()
    const latestContent = latest?.answer_content ?? latest?.content ?? ''
    if (latestContent.trim() === answerText.trim()) {
      return NextResponse.json({ saved: false, reason: 'duplicate' })
    }
  }

  // Insert new version — matches actual profile_answers schema
  const trimmed = answerText.trim()
  const { error } = await supabase.from('profile_answers').insert({
    user_id: user.id,
    archived_question_id: questionId,
    content: trimmed,
    answer_content: trimmed,
    question_text: questionText.trim(),
    word_count: trimmed.split(/\s+/).filter(Boolean).length,
    version: nextVersion,
    confidence: 'draft',
  })

  if (error) return NextResponse.json({ saved: false, reason: error.message })

  return NextResponse.json({ saved: true, questionId, version: nextVersion })
}
