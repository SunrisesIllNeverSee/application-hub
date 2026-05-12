import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import followUpData from '@/data/stress_test_follow_ups.json'

const STRESS_DEPTHS = ['light', 'medium', 'deep'] as const
type StressDepth = typeof STRESS_DEPTHS[number]

interface FollowUpTemplate {
  focus: string
  prompt: string
  expected_evidence: string[]
  risk_if_unanswered: string
}

const THEME_FOLLOW_UPS = followUpData.themeFollowUps as Record<string, FollowUpTemplate[]>
const GENERAL_FOLLOW_UPS = followUpData.generalFollowUps as FollowUpTemplate[]

function followUpCount(depth: StressDepth) {
  if (depth === 'light') return 3
  if (depth === 'deep') return 5
  return 4
}

function compactSignals(text: string) {
  const numeric_claims = Array.from(text.matchAll(/\b(?:\$?\d[\d,]*(?:\.\d+)?%?|\d+x)\b/gi))
    .map(m => m[0]).slice(0, 12)
  const likely_urls = Array.from(text.matchAll(/https?:\/\/\S+/gi))
    .map(m => m[0]).slice(0, 5)
  return {
    word_count: text.trim().split(/\s+/).filter(Boolean).length,
    numeric_claims,
    likely_urls,
  }
}

function buildFollowUps(theme: string | null, topDnaThemes: string[], depth: StressDepth) {
  const preferred = [theme, ...topDnaThemes].filter(Boolean) as string[]
  const templates: FollowUpTemplate[] = []

  for (const t of preferred) {
    for (const item of THEME_FOLLOW_UPS[t] ?? []) {
      if (!templates.some(e => e.focus === item.focus)) templates.push(item)
    }
  }
  for (const item of GENERAL_FOLLOW_UPS) {
    if (!templates.some(e => e.focus === item.focus)) templates.push(item)
  }

  return templates.slice(0, followUpCount(depth)).map((item, i) => ({
    id: `follow_up_${i + 1}`,
    ...item,
  }))
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { answer_id, program_id, depth = 'medium' } = body as {
    answer_id?: string
    program_id?: string
    depth?: StressDepth
  }

  if (!answer_id) return NextResponse.json({ error: 'answer_id required' }, { status: 400 })
  if (!STRESS_DEPTHS.includes(depth)) return NextResponse.json({ error: 'Invalid depth' }, { status: 400 })

  // Fetch the answer
  const { data: answer } = await supabase
    .from('profile_answers')
    .select('*, archived_questions(id, text, theme, significance_score)')
    .eq('id', answer_id)
    .eq('user_id', user.id)
    .single()

  if (!answer) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })

  const archived = (Array.isArray(answer.archived_questions)
    ? answer.archived_questions[0]
    : answer.archived_questions) as { id: string; text: string; theme: string; significance_score: number } | null

  const theme: string | null = archived?.theme ?? null
  const answerContent: string = (answer as unknown as Record<string, unknown>).answer_content as string ?? ''

  // Fetch program DNA if program_id given
  let topDnaThemes: string[] = []
  if (program_id) {
    const { data: dnaRows } = await supabase
      .from('program_dna')
      .select('theme, weight_pct')
      .eq('program_id', program_id)
      .order('weight_pct', { ascending: false })
      .limit(5)
    topDnaThemes = (dnaRows ?? []).map(d => d.theme)
  }

  const followUps = buildFollowUps(theme, topDnaThemes, depth)
  const signals = compactSignals(answerContent)

  return NextResponse.json({
    answer_id,
    question_text: archived?.text ?? '',
    theme,
    depth,
    signals,
    follow_ups: followUps,
    word_count: signals.word_count,
  })
}
