import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isLocalFirst, LOCAL_FIRST_REFUSAL_MESSAGE } from '@/lib/local-first-guard'

const APPLICANT_MODES = ['founder', 'student', 'researcher', 'job_seeker'] as const
type ApplicantMode = typeof APPLICANT_MODES[number]

interface CompletePayload {
  mode: 'starter' | 'upload'
  answers?: Record<string, string>
  upload?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Local-first: answer bodies and free-text uploads must not be persisted
  // server-side. The non-private profile metadata update below
  // (onboarding_completed_at, active_identity) still succeeds.
  const localFirst = isLocalFirst()

  const body = (await req.json().catch(() => null)) as CompletePayload | null
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  let answersCount = 0
  const themeCount: Record<string, number> = {}

  if (body.mode === 'starter') {
    const answers = body.answers ?? {}
    const entries = Object.entries(answers).filter(([, text]) => text.trim().length > 30)
    if (entries.length < 5) {
      return NextResponse.json({ error: 'At least 5 answers required.' }, { status: 400 })
    }

    const ids = entries.map(([id]) => id)
    const { data: questions } = await supabase
      .from('archived_questions')
      .select('id, text, theme')
      .in('id', ids)

    const questionLookup = Object.fromEntries(
      (questions ?? []).map((q) => [q.id, q as { id: string; text: string; theme: string }])
    )

    const rows = entries.map(([archived_question_id, text]) => {
      const q = questionLookup[archived_question_id]
      if (q?.theme) themeCount[q.theme] = (themeCount[q.theme] ?? 0) + 1
      const wc = text.trim().split(/\s+/).length
      return {
        user_id: user.id,
        archived_question_id,
        question_text: q?.text ?? '',
        content: text.trim(),
        answer_content: text.trim(),
        word_count: wc,
        confidence: 'draft' as const,
      }
    })

    if (localFirst) {
      // Do NOT write rows to profile_answers. Answers were accepted in the
      // payload for compatibility but are deliberately dropped server-side —
      // the client keeps them on device. Reported honestly below.
      answersCount = 0
    } else {
      const { error: insertErr } = await supabase
        .from('profile_answers')
        .upsert(rows, { onConflict: 'user_id,archived_question_id', ignoreDuplicates: false })

      if (insertErr) {
        return NextResponse.json({ error: `Could not save answers: ${insertErr.message}` }, { status: 500 })
      }
      answersCount = rows.length
    }
  } else if (body.mode === 'upload') {
    const raw = (body.upload ?? '').trim()
    if (raw.length < 100) {
      return NextResponse.json({ error: 'Add at least a paragraph.' }, { status: 400 })
    }

    if (localFirst) {
      // The uploaded free text is private content — do not persist it into
      // applicant_context. Onboarding metadata still completes below.
      answersCount = 0
      themeCount.other = 0
    } else {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('applicant_context')
        .eq('user_id', user.id)
        .maybeSingle<{ applicant_context: Record<string, unknown> | null }>()

      const newContext = {
        ...(prof?.applicant_context ?? {}),
        onboarding_upload: raw,
        onboarding_upload_at: new Date().toISOString(),
      }

      const { error: upErr } = await supabase
        .from('user_profiles')
        .update({ applicant_context: newContext })
        .eq('user_id', user.id)

      if (upErr) {
        return NextResponse.json({ error: `Could not save upload: ${upErr.message}` }, { status: 500 })
      }
      answersCount = 1
      themeCount.other = 1
    }
  } else {
    return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 })
  }

  const founderSignals = (themeCount.traction ?? 0) + (themeCount.business_model ?? 0) + (themeCount.fundraising ?? 0) + (themeCount.market ?? 0)
  const researcherSignals = (themeCount.technical ?? 0) + (themeCount.impact ?? 0)
  const studentSignals = (themeCount.fit ?? 0) + (themeCount.personal ?? 0) + (themeCount.vision ?? 0)
  const jobSeekerSignals = (themeCount.team ?? 0) + (themeCount.personal ?? 0)

  let identity: ApplicantMode = 'founder'
  const max = Math.max(founderSignals, researcherSignals, studentSignals)
  if (max === 0) {
    identity = 'founder'
  } else if (researcherSignals === max && researcherSignals > founderSignals) {
    identity = 'researcher'
  } else if (studentSignals === max && studentSignals > founderSignals && studentSignals > researcherSignals) {
    identity = 'student'
  } else if (jobSeekerSignals > founderSignals && jobSeekerSignals > researcherSignals && jobSeekerSignals > studentSignals && (themeCount.traction ?? 0) === 0 && (themeCount.business_model ?? 0) === 0) {
    identity = 'job_seeker'
  }

  const { data: updatedProfile, error: profileErr } = await supabase
    .from('user_profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      active_identity: identity,
    })
    .eq('user_id', user.id)
    .select('user_id')

  if (profileErr)
    return NextResponse.json({ error: `Could not persist onboarding: ${profileErr.message}` }, { status: 500 })
  if (!updatedProfile?.length)
    return NextResponse.json({ error: 'Profile row missing — onboarding could not be recorded.' }, { status: 500 })

  const { data: starterCount } = await supabase.rpc('claim_starter_package', { p_user_id: user.id })

  const topThemes = Object.entries(themeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([t]) => t)

  return NextResponse.json({
    ok: true,
    // Truthful local-first reporting: private answer/upload content was NOT
    // stored server-side. Only onboarding metadata was persisted.
    answers_stored_server_side: !localFirst,
    ...(localFirst ? { local_first: true, note: LOCAL_FIRST_REFUSAL_MESSAGE } : {}),
    summary: {
      identity: identity.replace(/_/g, ' '),
      answersCount,
      themesCovered: Object.keys(themeCount).length,
      topThemes,
      starter_unlocked: starterCount ?? 0,
    },
  })
}
