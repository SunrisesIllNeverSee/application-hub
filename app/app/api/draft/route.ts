import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { decryptKey } from '@/lib/encryption'

const MODEL = 'claude-haiku-4-5-20251001'
const PLATFORM_DRAFTS_ENABLED = process.env.PLATFORM_AI_DRAFTS_ENABLED === 'true'
const PLATFORM_PROVIDER = 'platform_anthropic'

type CoachProfile = {
  voice: string
  audience: string
  tone_guidance: string
}

type OpportunityKind =
  | 'accelerator'
  | 'vc'
  | 'grant'
  | 'fellowship'
  | 'job_fulltime'
  | 'job_internship'
  | 'job_contract'
  | 'school_undergrad'
  | 'school_grad'
  | 'school_professional'
  | 'other'

const KIND_COACH_PROFILE: Record<OpportunityKind, CoachProfile> = {
  accelerator: {
    voice: 'expert startup application coach',
    audience: 'accelerator partners and program selection committees',
    tone_guidance:
      'Strong drafts are written in first-person founder voice — direct, confident, and metric-driven. Lead with traction, insight, and a sharp wedge; avoid generic vision-speak.',
  },
  vc: {
    voice: 'seasoned venture pitch coach',
    audience: 'venture capital investors evaluating a potential investment',
    tone_guidance:
      'Strong drafts emphasize market size, defensibility, traction, and team edge. First-person founder voice, concrete numbers over adjectives, and a clear why-now.',
  },
  grant: {
    voice: 'grant-writing specialist',
    audience: 'grant review panels and program officers',
    tone_guidance:
      'Strong drafts are structured, evidence-based, and tied to the funder\'s stated priorities. Specify problem, approach, deliverables, and measurable impact; avoid marketing language.',
  },
  fellowship: {
    voice: 'fellowship application coach',
    audience: 'fellowship selection committees evaluating candidates and their projects',
    tone_guidance:
      'Strong drafts blend personal narrative with concrete accomplishments and a clear plan for the fellowship period. Show motivation, fit, and what only this candidate would do.',
  },
  job_fulltime: {
    voice: 'experienced job-search advisor and résumé editor',
    audience: 'hiring managers and recruiters screening candidates',
    tone_guidance:
      'Strong drafts are first-person, results-oriented, and quantified (impact, scope, scale). Map directly to the role\'s competencies; cut buzzwords and clichés.',
  },
  job_internship: {
    voice: 'early-career coach for internship applicants',
    audience: 'hiring managers and university recruiters reviewing internship candidates',
    tone_guidance:
      'Strong drafts highlight learning trajectory, relevant projects/coursework, and concrete contributions. First-person, eager but specific — no filler enthusiasm.',
  },
  job_contract: {
    voice: 'independent-contractor proposal coach',
    audience: 'clients evaluating a contractor or freelancer for a defined engagement',
    tone_guidance:
      'Strong drafts are scoped, outcome-focused, and demonstrate relevant past delivery. Be specific about approach, timeline, and value; avoid generic agency speak.',
  },
  school_undergrad: {
    voice: 'undergraduate admissions essay editor',
    audience: 'undergraduate admissions committees reading hundreds of essays',
    tone_guidance:
      'Strong drafts are personal, reflective, and show character through specific scenes and decisions. First-person student voice, no résumé recitation, no clichés about overcoming adversity.',
  },
  school_grad: {
    voice: 'graduate admissions essay editor',
    audience: 'graduate admissions committees evaluating academic and research fit',
    tone_guidance:
      'Strong drafts demonstrate intellectual trajectory, research/professional motivation, and fit with the program\'s faculty or focus. Specific, rigorous, and forward-looking.',
  },
  school_professional: {
    voice: 'professional-school admissions essay editor (MBA, JD, MD, etc.)',
    audience: 'professional-school admissions committees evaluating career fit and leadership',
    tone_guidance:
      'Strong drafts connect lived professional experience to concrete future goals, with the school as the bridge. First-person, results-driven, self-aware about strengths and gaps.',
  },
  other: {
    voice: 'application writing coach',
    audience: 'the review committee evaluating this application',
    tone_guidance:
      'Strong drafts are specific, evidence-based, and tailored to what this opportunity actually cares about. Cut filler, lead with substance.',
  },
}

function resolveKind(raw: string | null | undefined): OpportunityKind {
  if (raw && raw in KIND_COACH_PROFILE) {
    return raw as OpportunityKind
  }
  return 'accelerator'
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { archived_question_id, program_id } = body

    if (!archived_question_id) {
      return NextResponse.json({ error: 'archived_question_id is required' }, { status: 400 })
    }

    // BYOK-first routing: prefer user's own key, fall back to platform key for Pro
    let resolvedApiKey: string | null = null
    let integrationProvider = 'byok_anthropic'

    // Check user's stored integrations for an Anthropic key
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
        console.error('[/api/draft] key decryption failed:', e)
      }
    }

    // Fall back to platform key if BYOK not set and platform drafts enabled
    if (!resolvedApiKey) {
      if (PLATFORM_DRAFTS_ENABLED && process.env.ANTHROPIC_API_KEY) {
        resolvedApiKey = process.env.ANTHROPIC_API_KEY
        integrationProvider = PLATFORM_PROVIDER
      } else {
        return NextResponse.json(
          {
            error: 'Connect an AI provider in Profile → Integrations to enable drafting.',
            code: 'provider_required',
            provider_required: true,
          },
          { status: 402 }
        )
      }
    }

    const anthropic = new Anthropic({ apiKey: resolvedApiKey })
    void integrationProvider // used in ai_draft_runs insert below

    // Best-effort preflight so free-tier users do not burn provider tokens
    // before the database trigger gets a chance to reject over-limit usage.
    const month = new Date().toISOString().slice(0, 7)
    const [{ data: subscription }, { data: usage }] = await Promise.all([
      supabase
        .from('user_subscriptions')
        .select('tier, monthly_draft_limit')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('ai_usage')
        .select('draft_count')
        .eq('user_id', user.id)
        .eq('month_year', month)
        .maybeSingle(),
    ])

    const monthlyLimit = subscription?.monthly_draft_limit
    if (
      typeof monthlyLimit === 'number' &&
      monthlyLimit >= 0 &&
      (usage?.draft_count ?? 0) >= monthlyLimit
    ) {
      return NextResponse.json(
        {
          error: `Monthly AI draft limit (${monthlyLimit}) reached. Upgrade or connect your own AI provider.`,
          code: 'draft_limit_reached',
          drafts_remaining: 0,
        },
        { status: 429 }
      )
    }

    // 1. Fetch the question
    const { data: question, error: qErr } = await supabase
      .from('archived_questions')
      .select('id, text, theme, typical_word_limit, significance_score, asked_by_count')
      .eq('id', archived_question_id)
      .single()

    if (qErr || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // 2. Fetch program DNA if program_id provided
    let dnaContext = ''
    let opportunityKind: OpportunityKind = 'accelerator'
    if (program_id) {
      // Resolve opportunity kind (graceful fallback chain: kind → program_type → 'accelerator')
      // We select with a broad column list and tolerate missing columns by querying
      // each candidate separately so a missing migration does not crash the route.
      let kindCandidate: string | null = null
      const { data: programKindRow } = await supabase
        .from('programs')
        .select('kind')
        .eq('id', program_id)
        .maybeSingle()
      if (programKindRow && typeof (programKindRow as { kind?: unknown }).kind === 'string') {
        kindCandidate = (programKindRow as { kind: string }).kind
      }
      if (!kindCandidate) {
        const { data: programTypeRow } = await supabase
          .from('programs')
          .select('program_type')
          .eq('id', program_id)
          .maybeSingle()
        if (
          programTypeRow &&
          typeof (programTypeRow as { program_type?: unknown }).program_type === 'string'
        ) {
          kindCandidate = (programTypeRow as { program_type: string }).program_type
        }
      }
      opportunityKind = resolveKind(kindCandidate)

      const { data: dna } = await supabase
        .from('program_dna')
        .select('theme, weight_pct, question_count')
        .eq('program_id', program_id)
        .order('weight_pct', { ascending: false })
        .limit(5)

      if (dna && dna.length > 0) {
        const top = dna.map((d) => `${d.theme} (${Math.round(d.weight_pct)}%)`).join(', ')
        dnaContext = `\nThis opportunity weights these themes most heavily: ${top}.`
      }

      // Also fetch exact phrasing + word limit for this program
      if (program_id) {
        const { data: pq } = await supabase
          .from('program_questions')
          .select('asked_as, word_limit, char_limit')
          .eq('program_id', program_id)
          .eq('archived_question_id', archived_question_id)
          .single()

        if (pq?.asked_as) {
          // Use exact phrasing if available
          question.text = pq.asked_as
        }
        if (pq?.word_limit) {
          question.typical_word_limit = pq.word_limit
        }
      }
    }

    // 3. Fetch user's existing profile answers for this theme
    const { data: profileAnswers } = await supabase
      .from('profile_answers')
      .select('content, word_count, confidence')
      .eq('user_id', user.id)
      .eq('theme', question.theme)
      .order('updated_at', { ascending: false })
      .limit(3)

    let profileContext = ''
    if (profileAnswers && profileAnswers.length > 0) {
      profileContext = '\n\nUser\'s existing answers on this theme (use as raw material — adapt, don\'t copy):\n'
      profileAnswers.forEach((a, i) => {
        profileContext += `\n[Answer ${i + 1} — ${a.word_count ?? '?'} words, confidence: ${a.confidence ?? 'unknown'}]\n${a.content}\n`
      })
    }

    // 4. Also check if user already has an answer for this exact question
    const { data: existingAnswer } = await supabase
      .from('profile_answers')
      .select('content, word_count, confidence')
      .eq('user_id', user.id)
      .eq('archived_question_id', archived_question_id)
      .single()

    let existingContext = ''
    if (existingAnswer?.content) {
      existingContext = `\n\nUser's current answer for this exact question (${existingAnswer.word_count ?? '?'} words):\n${existingAnswer.content}\n\nImprove and adapt this — don't start from scratch.`
    }

    // 5. Build the prompt
    const wordLimit = question.typical_word_limit ?? 300
    const targetWords = Math.round(wordLimit * 0.85)

    const coach = KIND_COACH_PROFILE[opportunityKind]
    const systemPrompt = `You are an ${coach.voice}. You draft compelling, specific application answers that read well to ${coach.audience}.

${coach.tone_guidance}

Your drafts are:
- Concrete and evidence-driven (not vague or generic)
- Tailored to what this specific opportunity cares about
- Exactly within word limits (target ${targetWords} words, hard max ${wordLimit})

Never use filler phrases like "In conclusion", "I am excited to", or "innovative solution". Cut straight to substance.`

    const userPrompt = `Draft a strong application answer for this question:

**Question**: ${question.text}
**Theme**: ${question.theme}
**Word limit**: ${wordLimit} words (target ~${targetWords} words)${dnaContext}${profileContext}${existingContext}

Write the draft answer only — no preamble, no explanation, no word count at the end. Just the answer text.`

    // 6. Call Anthropic
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const draft = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!draft) {
      return NextResponse.json({ error: 'AI draft response was empty' }, { status: 502 })
    }

    const wordCount = countWords(draft)
    const promptTokens = message.usage?.input_tokens ?? null
    const completionTokens = message.usage?.output_tokens ?? null

    const { data: draftRun, error: draftRunError } = await supabase
      .from('ai_draft_runs')
      .insert({
        user_id: user.id,
        program_id: program_id ?? null,
        archived_question_id,
        integration_type: integrationProvider,
        model_used: MODEL,
        prompt_used: `${systemPrompt}\n\n${userPrompt}`,
        output_content: draft,
        word_count: wordCount,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      })
      .select('id')
      .single()

    if (draftRunError) {
      console.error('[/api/draft] usage log error:', draftRunError)
      const isLimitError = draftRunError.message.toLowerCase().includes('draft limit')
      return NextResponse.json(
        { error: isLimitError ? 'Monthly AI draft limit reached.' : 'Unable to record AI draft usage.' },
        { status: isLimitError ? 429 : 500 }
      )
    }

    const { data: updatedUsage } = await supabase
      .from('ai_usage')
      .select('draft_count')
      .eq('user_id', user.id)
      .eq('month_year', month)
      .maybeSingle()

    const draftsRemaining = typeof monthlyLimit === 'number' && monthlyLimit >= 0
      ? Math.max(0, monthlyLimit - (updatedUsage?.draft_count ?? 0))
      : 'unlimited'

    return NextResponse.json({
      draft,
      question_theme: question.theme,
      word_limit: wordLimit,
      draft_run_id: draftRun?.id,
      drafts_remaining: draftsRemaining,
      integration_type: integrationProvider,
    })

  } catch (err) {
    console.error('[/api/draft] error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
