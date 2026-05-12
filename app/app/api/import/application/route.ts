import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { decryptKey } from '@/lib/encryption'

const MODEL = 'claude-3-5-haiku-20241022'
const PLATFORM_DRAFTS_ENABLED = process.env.PLATFORM_AI_DRAFTS_ENABLED === 'true'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { text, program_name } = body as { text?: string; program_name?: string }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length < 50 || text.length > 15000) {
      return NextResponse.json(
        { error: 'text must be between 50 and 15,000 characters' },
        { status: 400 }
      )
    }

    // BYOK-first: prefer user's own Anthropic key, fall back to platform key
    let resolvedApiKey: string | null = null

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('id, key_encrypted, key_storage_ref, status')
      .eq('user_id', user.id)
      .eq('provider', 'anthropic')
      .eq('status', 'active')
      .maybeSingle()

    if (integration?.key_encrypted && integration?.key_storage_ref) {
      try {
        resolvedApiKey = decryptKey(integration.key_encrypted, integration.key_storage_ref)
      } catch (e) {
        console.error('[/api/import/application] key decryption failed:', e)
      }
    }

    if (!resolvedApiKey) {
      if (PLATFORM_DRAFTS_ENABLED && process.env.ANTHROPIC_API_KEY) {
        resolvedApiKey = process.env.ANTHROPIC_API_KEY
      } else {
        return NextResponse.json(
          {
            error: 'Connect an AI provider in Profile → Integrations to enable application imports.',
            code: 'provider_required',
            provider_required: true,
          },
          { status: 402 }
        )
      }
    }

    // Fetch top 30 archived questions by significance_score for matching context
    const { data: archivedQuestions } = await supabase
      .from('archived_questions')
      .select('id, text, theme')
      .order('significance_score', { ascending: false })
      .limit(30)

    const questionsContext = archivedQuestions
      ? archivedQuestions
          .map((q) => `[${q.id}] (${q.theme}) ${q.text}`)
          .join('\n')
      : ''

    const anthropic = new Anthropic({ apiKey: resolvedApiKey })

    const systemPrompt =
      'You are an expert at parsing startup accelerator applications. Extract question-answer pairs from application text.'

    // Detect domain from text signals
    const domainHints = {
      founder: ['startup', 'funding', 'equity', 'cohort', 'accelerator', 'mvp', 'traction', 'investors', 'co-founder'],
      jobs: ['role', 'salary', 'responsibilities', 'qualifications', 'team', 'compensation', 'cover letter', 'resume'],
      education: ['degree', 'gpa', 'campus', 'research', 'thesis', 'advisor', 'program', 'graduate', 'undergraduate', 'college'],
      grants: ['budget', 'deliverables', 'irb', 'principal investigator', 'award period', 'grant', 'funding period'],
    }
    const textLower = text.toLowerCase()
    const domainScores = Object.entries(domainHints).map(([domain, hints]) => ({
      domain,
      score: hints.filter(h => textLower.includes(h)).length,
    }))
    const detectedDomain = domainScores.reduce((a, b) => b.score > a.score ? b : a).domain as string || 'general'

    const userPrompt = `First, classify this application. Based on the text, the domain is most likely: ${detectedDomain}.

Extract all question-answer pairs. For each pair return a JSON object with:
- "question": the original question text exactly as asked
- "answer": the applicant's full answer
- "universal_theme": one of: background, competency, problem, approach, impact, motivation, personal, fit, general
- "archived_question_id": if the question closely matches one of the archived questions below with confidence > 0.7, put that question's ID here; otherwise null

Universal theme guide:
- background: who you/your team are, experience, qualifications
- competency: what you've built or achieved, skills, traction
- problem: what problem you're solving or challenge faced
- approach: how you solve it, methodology, solution
- impact: market size, scope, contribution, outcomes
- motivation: why this program/role/school, vision, goals
- personal: personal story, background, values
- fit: why this specific opportunity, alignment

Archived questions for matching (founder domain):
${questionsContext}

Return ONLY a JSON array of objects — no markdown, no preamble. Example:
[{"question":"What does your company do?","answer":"We build...","universal_theme":"approach","archived_question_id":"uuid-or-null"}]

Application text to parse:
${text}`

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const rawContent = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'

    // Parse JSON — strip markdown fences if present
    let pairs: Array<{
      question: string
      answer: string
      universal_theme: string
      archived_question_id: string | null
    }> = []

    try {
      const stripped = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      const parsed = JSON.parse(stripped)
      if (Array.isArray(parsed)) {
        pairs = parsed
      }
    } catch (e) {
      console.error('[/api/import/application] JSON parse failed:', e)
      return NextResponse.json(
        { error: 'Failed to parse extracted pairs from AI response' },
        { status: 502 }
      )
    }

    // Insert session record
    const { data: session, error: sessionError } = await supabase
      .from('app_import_sessions')
      .insert({
        user_id: user.id,
        raw_text: text,
        program_name: program_name ?? null,
        status: 'processing',
        extracted_pairs: pairs,
        domain: detectedDomain,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error('[/api/import/application] session insert failed:', sessionError)
      return NextResponse.json({ error: 'Failed to save import session' }, { status: 500 })
    }

    return NextResponse.json({
      session_id: session.id,
      pairs,
      count: pairs.length,
      domain: detectedDomain,
    })
  } catch (err) {
    console.error('[/api/import/application] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
