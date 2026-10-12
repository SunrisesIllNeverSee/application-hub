import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { decryptKey } from '@/lib/encryption'
import { resolveKind, buildDraftPrompt } from '@/lib/draft-prompts'
import type { OpportunityKind } from '@/lib/draft-prompts'
import { refusePrivateWrite } from '@/lib/local-first-guard'

function isProhibitedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true
  if (h.endsWith('.localhost')) return true
  if (h.startsWith('169.254.')) return true
  if (h === 'metadata.google.internal') return true
  if (h.startsWith('10.')) return true
  if (h.startsWith('192.168.')) return true
  if (h.startsWith('172.')) {
    const parts = h.split('.')
    const second = parseInt(parts[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  if (h.startsWith('100.')) {
    const parts = h.split('.')
    const second = parseInt(parts[1], 10)
    if (second >= 64 && second <= 127) return true
  }
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('fe80:')) return true
  return false
}

const MODEL = 'claude-haiku-4-5-20251001'
const PLATFORM_DRAFTS_ENABLED = process.env.PLATFORM_AI_DRAFTS_ENABLED === 'true'
const PLATFORM_PROVIDER = 'platform_anthropic'


function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function POST(req: NextRequest) {
  try {
    // Local-first: drafting sends the user's answer bodies to an external LLM
    // provider and persists prompt + output in ai_draft_runs. Refuse honestly.
    const lfRefusal = refusePrivateWrite({
      detail: 'Drafting runs on your device in local-first mode.',
    })
    if (lfRefusal) return lfRefusal

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { archived_question_id, program_id } = body

    if (!archived_question_id) {
      return NextResponse.json({ error: 'archived_question_id is required' }, { status: 400 })
    }

    // BYOK-first routing: check providers in priority order
    let resolvedApiKey: string | null = null
    let resolvedProvider: string | null = null
    let resolvedBaseUrl: string | null = null
    let resolvedModelPreference: string | null = null
    let integrationProvider = 'byok_anthropic'

    const PROVIDER_PRIORITY = ['anthropic', 'openai', 'ollama']

    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('id, provider, key_encrypted, key_storage_ref, base_url, model_preference, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (integrations?.length) {
      const sorted = [...integrations].sort(
        (a, b) => PROVIDER_PRIORITY.indexOf(a.provider) - PROVIDER_PRIORITY.indexOf(b.provider)
      )
      const best = sorted[0]
      if (best?.key_encrypted && best?.key_storage_ref) {
        try {
          resolvedApiKey = decryptKey(best.key_encrypted, best.key_storage_ref)
          resolvedProvider = best.provider
          resolvedBaseUrl = best.base_url ?? null
          resolvedModelPreference = best.model_preference ?? null
          integrationProvider = `byok_${best.provider}`
        } catch (e) {
          console.error('[/api/draft] key decryption failed:', e)
        }
      }
    }

    // Fall back to platform Anthropic key
    if (!resolvedApiKey) {
      if (PLATFORM_DRAFTS_ENABLED && process.env.ANTHROPIC_API_KEY) {
        resolvedApiKey = process.env.ANTHROPIC_API_KEY
        resolvedProvider = 'anthropic'
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

    // Init Anthropic client only if needed
    const anthropic = resolvedProvider === 'anthropic'
      ? new Anthropic({ apiKey: resolvedApiKey! })
      : null
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

    // 5. Build the prompt — shared with the local-first BYOK path
    const { systemPrompt, userPrompt, wordLimit } = buildDraftPrompt({
      kind: opportunityKind,
      questionText: question.text,
      theme: question.theme,
      wordLimit: question.typical_word_limit,
      dnaContext,
      profileContext,
      existingAnswerContext: existingContext,
    })

    // 6. Call AI provider
    let draft = ''
    let promptTokens: number | null = null
    let completionTokens: number | null = null

    if (resolvedProvider === 'anthropic' && anthropic) {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      })
      draft = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      promptTokens = message.usage?.input_tokens ?? null
      completionTokens = message.usage?.output_tokens ?? null

    } else if (resolvedProvider === 'openai' || resolvedProvider === 'ollama') {
      // OpenAI-compatible API (works for OpenAI, Ollama, Groq, etc.)
      const baseUrl = resolvedProvider === 'ollama'
        ? (resolvedBaseUrl ?? resolvedApiKey ?? 'http://localhost:11434').replace(/\/$/, '') + '/v1'
        : 'https://api.openai.com/v1'
      const apiKey = resolvedProvider === 'ollama' ? 'ollama' : resolvedApiKey!
      if (resolvedProvider === 'ollama') {
        try {
          const parsed = new URL(baseUrl)
          if (isProhibitedHost(parsed.hostname)) {
            return NextResponse.json({ error: 'Ollama URL must not point to a private/internal host.' }, { status: 400 })
          }
        } catch { /* invalid URL — fetch will fail with a clear error */ }
      }
      // Respect the user's saved model_preference; fall back to a sensible default per provider.
      // For Ollama, the default 'llama3.2' will fail if that model isn't pulled — savvy users
      // should save their pulled model name (e.g. 'llama3.1:8b', 'qwen2.5:3b') as model_preference.
      const model = resolvedModelPreference
        ?? (resolvedProvider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini')

      // Catch fetch-level failures (unreachable host, DNS, refused connection)
      // and return a friendly 502 instead of bubbling up a generic TypeError.
      // This is the failure mode when a user types localhost as the Ollama URL
      // and then tries to draft from the production site — Vercel's serverless
      // function has no path back to their laptop.
      let resp: Response
      try {
        resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            // ngrok free tier serves an HTML interstitial unless this header is included.
            // Harmless for non-ngrok endpoints.
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(baseUrl)
        const hint = resolvedProvider === 'ollama' && isLocal
          ? `Cannot reach ${baseUrl} from the live site. Ollama on localhost is only reachable when running the app locally. To use Ollama with the live site, expose it via a tunnel (ngrok, Tailscale Funnel, Cloudflare Tunnel) and save the public URL in Profile → Integrations.`
          : resolvedProvider === 'ollama'
          ? `Cannot reach Ollama at ${baseUrl}. Check that Ollama is running and the URL is correct. Use the Test connection button in Profile → Integrations to diagnose.`
          : `Cannot reach the AI provider. ${msg}`
        return NextResponse.json({ error: hint, code: 'provider_unreachable' }, { status: 502 })
      }
      if (!resp.ok) {
        const err = await resp.text()
        return NextResponse.json({ error: `Provider error: ${err}` }, { status: 502 })
      }
      const json = await resp.json() as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      draft = json.choices?.[0]?.message?.content?.trim() ?? ''
      promptTokens = json.usage?.prompt_tokens ?? null
      completionTokens = json.usage?.completion_tokens ?? null

    } else {
      return NextResponse.json({ error: 'Unsupported AI provider' }, { status: 400 })
    }

    if (!draft) {
      return NextResponse.json({ error: 'AI draft response was empty' }, { status: 502 })
    }

    const wordCount = countWords(draft)

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
