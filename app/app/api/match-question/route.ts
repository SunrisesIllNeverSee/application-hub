import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ============================================================
// POST /api/match-question
// ============================================================
// Core of the V1 browser extension. Takes a form field label/
// question text and returns the top matching archived questions
// from the user's archive, plus their saved answer for each.
//
// Used by: browser extension content scripts
//
// Auth: session cookie (user must be logged in) OR
//       x-api-token header with user's integration token (future)
//
// Request:  { text: string, program_id?: string, limit?: number }
// Response: { matches: MatchResult[], mode: 'vector' | 'fulltext' }
// ============================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMS = 1536
const DEFAULT_THRESHOLD = 0.72
const AUTO_FILL_THRESHOLD = 0.87  // above this: safe to auto-fill

interface MatchResult {
  question_id: string
  question_text: string
  theme: string | null
  significance_score: number
  asked_by_count: number
  similarity: number
  confidence: 'high' | 'medium' | 'low'
  auto_fill_safe: boolean
  user_answer: {
    id: string
    content: string
    confidence: string
    word_count: number | null
  } | null
}

// ─── Embedding generation ─────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: [{ embedding: number[] }] }
    return data.data[0].embedding
  } catch {
    return null
  }
}

// ─── User BYOK OpenAI key fallback ───────────────────────────────────────────

async function embedWithBYOK(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: [{ embedding: number[] }] }
    return data.data[0].embedding
  } catch {
    return null
  }
}

// ─── Full-text fallback ───────────────────────────────────────────────────────

async function fulltextSearch(text: string, limit: number, url: string, key: string) {
  // Postgres full-text search via direct REST call to avoid client type issues
  const query = text.split(' ').slice(0, 6).map(w => w.replace(/[^a-z0-9]/gi, '')).filter(Boolean).join(' | ')
  const endpoint = `${url}/rest/v1/archived_questions?select=id,text,theme,significance_score,asked_by_count&text=wfts.${encodeURIComponent(query)}&order=significance_score.desc&limit=${limit}`
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return []
    return await res.json() as Array<{ id: string; text: string; theme: string; significance_score: number; asked_by_count: number }>
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { text, program_id, limit = 3 } = body as {
    text?: string
    program_id?: string
    limit?: number
  }

  if (!text || text.trim().length < 3) {
    return NextResponse.json({ error: 'text must be at least 3 characters' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Try to get an embedding ────────────────────────────────────────────

  let embedding: number[] | null = null
  let embeddingSource: 'platform' | 'byok' | null = null

  // Platform key first
  embedding = await embedText(text.trim())
  if (embedding) embeddingSource = 'platform'

  // BYOK OpenAI key if no platform key
  if (!embedding) {
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('key_encrypted, provider')
      .eq('user_id', user.id)
      .eq('provider', 'openai')
      .eq('is_active', true)
      .single()

    if (integration?.key_encrypted) {
      // Decrypt via service client (same pattern as /api/draft)
      const { data: decrypted } = await adminClient.rpc('decrypt_integration_key', {
        p_user_id: user.id,
        p_provider: 'openai',
      })
      if (decrypted) {
        embedding = await embedWithBYOK(text.trim(), decrypted)
        if (embedding) embeddingSource = 'byok'
      }
    }
  }

  // ── 2. Vector search (if we have an embedding) ────────────────────────────

  let rawMatches: Array<{
    id: string
    text: string
    theme: string | null
    significance_score: number
    asked_by_count: number
    similarity?: number
  }> = []
  let searchMode: 'vector' | 'fulltext' = 'fulltext'

  if (embedding) {
    const { data: vectorMatches } = await adminClient.rpc('match_archived_questions', {
      query_embedding: embedding,
      match_threshold: DEFAULT_THRESHOLD,
      match_count: limit,
    })
    if (vectorMatches && vectorMatches.length > 0) {
      rawMatches = vectorMatches
      searchMode = 'vector'
    }
  }

  // ── 3. Full-text fallback ─────────────────────────────────────────────────

  if (rawMatches.length === 0) {
    rawMatches = await fulltextSearch(text.trim(), limit, process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  }

  if (rawMatches.length === 0) {
    return NextResponse.json({ matches: [], mode: searchMode, embedding_available: !!embedding })
  }

  // ── 4. Fetch user's saved answers for matched questions ───────────────────

  const questionIds = rawMatches.map(m => m.id)
  const { data: answers } = await supabase
    .from('profile_answers')
    .select('id, archived_question_id, answer_content, content, confidence, word_count')
    .eq('user_id', user.id)
    .in('archived_question_id', questionIds)

  const answerMap = Object.fromEntries(
    (answers ?? []).map(a => [a.archived_question_id, a])
  )

  // ── 5. Build program-aware context if program_id given ────────────────────

  let dnaThemes: string[] = []
  if (program_id) {
    const { data: dna } = await adminClient
      .from('program_dna')
      .select('theme')
      .eq('program_id', program_id)
      .order('weight_pct', { ascending: false })
      .limit(3)
    dnaThemes = (dna ?? []).map(d => d.theme)
  }

  // ── 6. Assemble results ───────────────────────────────────────────────────

  const matches: MatchResult[] = rawMatches.map(m => {
    const similarity = m.similarity ?? 0.65  // fallback similarity for FTS results
    const confidence: 'high' | 'medium' | 'low' =
      similarity >= AUTO_FILL_THRESHOLD ? 'high'
      : similarity >= DEFAULT_THRESHOLD ? 'medium'
      : 'low'

    const savedAnswer = answerMap[m.id]
    const answerContent: string = savedAnswer?.answer_content ?? savedAnswer?.content ?? ''

    return {
      question_id: m.id,
      question_text: m.text,
      theme: m.theme,
      significance_score: m.significance_score,
      asked_by_count: m.asked_by_count,
      similarity,
      confidence,
      auto_fill_safe: similarity >= AUTO_FILL_THRESHOLD,
      dna_relevant: dnaThemes.includes(m.theme ?? ''),
      user_answer: savedAnswer ? {
        id: savedAnswer.id,
        content: answerContent,
        confidence: savedAnswer.confidence,
        word_count: savedAnswer.word_count,
      } : null,
    }
  })

  // Sort: answered questions first, then by similarity
  matches.sort((a, b) => {
    if (!!a.user_answer !== !!b.user_answer) return a.user_answer ? -1 : 1
    return b.similarity - a.similarity
  })

  return NextResponse.json({
    matches,
    mode: searchMode,
    embedding_available: !!embeddingSource,
    embedding_source: embeddingSource,
    query: text.trim(),
  })
}
