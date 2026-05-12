import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { APPLICANT_MODES, DEFAULT_MODE } from '@/lib/applicantMode'
import type { ApplicantMode } from '@/lib/database.types'

const APPLICANT_MODE_SET = new Set<ApplicantMode>(APPLICANT_MODES)

function isApplicantMode(value: unknown): value is ApplicantMode {
  return typeof value === 'string' && APPLICANT_MODE_SET.has(value as ApplicantMode)
}

interface PatchBody {
  active_identity?: ApplicantMode
  identities?: ApplicantMode[]
  /** If true and active_identity is not in identities[], add it. */
  add_to_identities?: boolean
}

/**
 * PATCH /api/profile/identity
 *
 * Update the user's active applicant mode and/or claimed identities. The
 * active mode must be a member of identities[]; if add_to_identities=true
 * we auto-include the active mode in identities[] for the user.
 */
export async function PATCH(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Validate inputs
  if (body.active_identity !== undefined && !isApplicantMode(body.active_identity)) {
    return NextResponse.json(
      { error: 'invalid_active_identity' },
      { status: 400 }
    )
  }
  if (body.identities !== undefined) {
    if (!Array.isArray(body.identities) || body.identities.length === 0) {
      return NextResponse.json(
        { error: 'identities_must_be_nonempty_array' },
        { status: 400 }
      )
    }
    if (!body.identities.every(isApplicantMode)) {
      return NextResponse.json(
        { error: 'invalid_identity_in_array' },
        { status: 400 }
      )
    }
  }

  // Fetch current state — needed for both the merge logic and the
  // CHECK constraint that active_identity must belong to identities[].
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('identities, active_identity')
    .eq('user_id', user.id)
    .single<{ identities: ApplicantMode[] | null; active_identity: ApplicantMode | null }>()

  const currentIdentities: ApplicantMode[] = existing?.identities ?? [DEFAULT_MODE]
  const currentActive: ApplicantMode = existing?.active_identity ?? DEFAULT_MODE

  const nextActive = body.active_identity ?? currentActive
  let nextIdentities: ApplicantMode[] = body.identities ?? currentIdentities

  // Auto-include the active mode in identities[] if asked.
  if (body.add_to_identities && !nextIdentities.includes(nextActive)) {
    nextIdentities = [...nextIdentities, nextActive]
  }

  // Enforce CHECK constraint client-side so we return a clear error.
  if (!nextIdentities.includes(nextActive)) {
    return NextResponse.json(
      { error: 'active_identity_not_in_identities' },
      { status: 400 }
    )
  }

  // Deduplicate identities[] preserving order.
  nextIdentities = Array.from(new Set(nextIdentities))

  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        identities: nextIdentities,
        active_identity: nextActive,
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    active_identity: nextActive,
    identities: nextIdentities,
  })
}
