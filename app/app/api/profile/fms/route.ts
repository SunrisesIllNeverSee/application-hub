import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PostBody {
  fms_tier: number
}

/**
 * POST /api/profile/fms
 *
 * Saves the user's FMS (Founder Moat Score) self-classification tier (1–5)
 * into user_profiles.applicant_context JSONB field.
 */
export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const tier = body.fms_tier
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > 5) {
    return NextResponse.json({ error: 'fms_tier must be an integer between 1 and 5' }, { status: 400 })
  }

  // Fetch current applicant_context so we can merge, not overwrite
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('applicant_context')
    .eq('user_id', user.id)
    .maybeSingle<{ applicant_context: Record<string, unknown> | null }>()

  const current = (existing?.applicant_context ?? {}) as Record<string, unknown>
  const next = { ...current, fms_tier: tier }

  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: user.id, applicant_context: next },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ fms_tier: tier })
}
