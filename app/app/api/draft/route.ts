import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
    if (program_id) {
      const { data: dna } = await supabase
        .from('program_dna')
        .select('theme, weight_pct, question_count')
        .eq('program_id', program_id)
        .order('weight_pct', { ascending: false })
        .limit(5)

      if (dna && dna.length > 0) {
        const top = dna.map((d) => `${d.theme} (${Math.round(d.weight_pct * 100)}%)`).join(', ')
        dnaContext = `\nThis program weights these themes most heavily: ${top}.`
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

    const systemPrompt = `You are an expert startup application coach. You draft compelling, specific application answers that help founders get into top accelerators and programs.

Your drafts are:
- Written in first-person founder voice — direct, confident, specific
- Concrete and metric-driven (not vague or generic)
- Tailored to what this specific program cares about
- Exactly within word limits (target ${targetWords} words, hard max ${wordLimit})

Never use filler phrases like "In conclusion", "We are excited to", or "Our innovative solution". Cut straight to substance.`

    const userPrompt = `Draft a strong application answer for this question:

**Question**: ${question.text}
**Theme**: ${question.theme}
**Word limit**: ${wordLimit} words (target ~${targetWords} words)${dnaContext}${profileContext}${existingContext}

Write the draft answer only — no preamble, no explanation, no word count at the end. Just the answer text.`

    // 6. Call Anthropic
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const draft = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({
      draft,
      question_theme: question.theme,
      word_limit: wordLimit,
    })

  } catch (err) {
    console.error('[/api/draft] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
