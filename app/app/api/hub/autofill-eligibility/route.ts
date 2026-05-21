import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function POST(req: Request) {
  const { user } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    program_question_count?: number
    matched_answer_count?: number
    avg_fidelity?: number
    outcomes_available?: boolean
  }

  const total = Math.max(0, Number(body.program_question_count ?? 0))
  const matched = Math.max(0, Number(body.matched_answer_count ?? 0))
  const coverage = total > 0 ? matched / total : 0
  const avgFidelity = Math.max(0, Math.min(1, Number(body.avg_fidelity ?? 0)))

  const level1 = coverage >= 0.60
  const level2 = coverage >= 0.85 && avgFidelity >= 0.85 && Boolean(body.outcomes_available)

  return NextResponse.json({
    coverage,
    avg_fidelity: avgFidelity,
    level_1_manual_prefill: level1,
    level_2_full_autofill: level2,
    auto_submit_beta: false,
    consent_required: true,
    thresholds: {
      level_1_coverage: 0.60,
      level_2_coverage: 0.85,
      level_2_fidelity: 0.85,
    },
  })
}
