import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/export/persona?format=gdpr|ler-rs|vc|json-resume
// ============================================================
// Data portability export endpoint. Returns the user's persona
// profile data in one of four interoperable formats.
//
// Auth: session cookie required
// ============================================================

type ExportFormat = 'gdpr' | 'ler-rs' | 'vc' | 'json-resume'
const VALID_FORMATS: ExportFormat[] = ['gdpr', 'ler-rs', 'vc', 'json-resume']

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const format = url.searchParams.get('format') as ExportFormat | null

  if (!format || !VALID_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch user's persona profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Fetch user's profile answers (existing answer bank)
  const { data: profileAnswers } = await supabase
    .from('profile_answers')
    .select('*, archived_questions(id, text, theme, significance_score)')
    .eq('user_id', user.id)

  // Fetch user's persona profile answers (new persona system)
  const { data: personaAnswers } = await supabase
    .from('persona_profile_answers')
    .select('*')
    .eq('profile_id', profile?.id ?? '00000000-0000-0000-0000-000000000000')

  // Fetch user's archived questions interactions
  const { data: programs } = await supabase
    .from('user_program_fit')
    .select('*, programs(id, name, slug, opportunity_kind, deadline)')
    .eq('user_id', user.id)

  // Fetch enrichments
  const { data: enrichments } = await supabase
    .from('profile_persona_enrichments')
    .select('*')
    .eq('profile_id', profile?.id ?? '00000000-0000-0000-0000-000000000000')

  const provenance = {
    exported_at: new Date().toISOString(),
    source: 'AQUA Application Hub',
    source_url: 'https://mos2es.xyz',
    user_id: user.id,
    commitment_hash: profile?.commitment_hash ?? null,
  }

  switch (format) {
    case 'gdpr':
      return NextResponse.json(buildGDPRExport(user, profile, profileAnswers, personaAnswers, programs, enrichments, provenance))

    case 'json-resume':
      return NextResponse.json(buildJsonResumeExport(user, profile, profileAnswers, provenance))

    case 'ler-rs':
      return NextResponse.json(buildLERExport(user, profile, profileAnswers, provenance))

    case 'vc':
      return NextResponse.json(buildVCExport(user, profile, profileAnswers, provenance))

    default:
      return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
  }
}

// ─── GDPR Full Export ────────────────────────────────────────────────────────

function buildGDPRExport(
  user: { id: string; email?: string; created_at?: string },
  profile: Record<string, unknown> | null,
  profileAnswers: Record<string, unknown>[] | null,
  personaAnswers: Record<string, unknown>[] | null,
  programs: Record<string, unknown>[] | null,
  enrichments: Record<string, unknown>[] | null,
  provenance: Record<string, unknown>
) {
  return {
    schema: 'aqua-gdpr-export/v1',
    provenance,
    subject: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    persona_profile: profile ?? null,
    profile_answers: (profileAnswers ?? []).map(a => ({
      ...a,
      archived_questions: undefined,
      question: (a as Record<string, unknown>).archived_questions ?? null,
    })),
    persona_answers: personaAnswers ?? [],
    program_fit_scores: programs ?? [],
    enrichments: enrichments ?? [],
  }
}

// ─── JSON Resume (jsonresume.org schema) ─────────────────────────────────────

function buildJsonResumeExport(
  user: { id: string; email?: string },
  profile: Record<string, unknown> | null,
  profileAnswers: Record<string, unknown>[] | null,
  provenance: Record<string, unknown>
) {
  const personalInfo = (profile?.personal_info ?? {}) as Record<string, unknown>

  // Map answers by theme to resume sections
  const answers = profileAnswers ?? []
  const answersByTheme: Record<string, Record<string, unknown>[]> = {}
  for (const a of answers) {
    const q = (a as Record<string, unknown>).archived_questions as Record<string, unknown> | null
    const theme = (q?.theme as string) ?? 'other'
    if (!answersByTheme[theme]) answersByTheme[theme] = []
    answersByTheme[theme].push(a)
  }

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    meta: {
      ...provenance,
      theme: 'aqua',
    },
    basics: {
      name: (personalInfo.name as string) ?? '',
      email: user.email ?? '',
      summary: (personalInfo.summary as string) ?? '',
      url: (personalInfo.url as string) ?? '',
      location: (personalInfo.location as Record<string, unknown>) ?? {},
      profiles: (personalInfo.profiles as unknown[]) ?? [],
    },
    work: answersByTheme['traction']?.map(a => ({
      summary: ((a as Record<string, unknown>).content as string) ?? '',
      position: 'Founder',
    })) ?? [],
    education: answersByTheme['team']?.map(a => ({
      summary: ((a as Record<string, unknown>).content as string) ?? '',
    })) ?? [],
    projects: answersByTheme['product']?.map(a => ({
      description: ((a as Record<string, unknown>).content as string) ?? '',
    })) ?? [],
    skills: Object.keys(answersByTheme).map(theme => ({
      name: theme,
      keywords: answersByTheme[theme].map(a => {
        const q = (a as Record<string, unknown>).archived_questions as Record<string, unknown> | null
        return (q?.text as string) ?? ''
      }).filter(Boolean),
    })),
  }
}

// ─── HR Open / LER-RS v2 (Candidate/Person Profile) ─────────────────────────

function buildLERExport(
  user: { id: string; email?: string },
  profile: Record<string, unknown> | null,
  profileAnswers: Record<string, unknown>[] | null,
  provenance: Record<string, unknown>
) {
  const personalInfo = (profile?.personal_info ?? {}) as Record<string, unknown>
  const answers = profileAnswers ?? []

  return {
    '@context': 'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json',
    type: 'LearningAndEmploymentRecord',
    id: `urn:aqua:persona:${user.id}`,
    issuedOn: new Date().toISOString(),
    issuer: {
      id: 'https://mos2es.xyz',
      name: 'AQUA Application Hub',
      type: 'Profile',
    },
    credentialSubject: {
      id: `urn:aqua:user:${user.id}`,
      type: 'Person',
      name: (personalInfo.name as string) ?? '',
      email: user.email ?? '',
    },
    achievements: answers.map(a => {
      const q = (a as Record<string, unknown>).archived_questions as Record<string, unknown> | null
      return {
        type: 'Achievement',
        name: (q?.text as string) ?? 'Application Response',
        description: ((a as Record<string, unknown>).content as string) ?? '',
        criteria: {
          narrative: `Significance: ${(q?.significance_score as number) ?? 0}`,
        },
      }
    }),
    provenance,
  }
}

// ─── W3C Verifiable Credentials ──────────────────────────────────────────────

function buildVCExport(
  user: { id: string; email?: string },
  profile: Record<string, unknown> | null,
  profileAnswers: Record<string, unknown>[] | null,
  provenance: Record<string, unknown>
) {
  const answers = profileAnswers ?? []

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    type: ['VerifiableCredential', 'PersonaProfileCredential'],
    id: `urn:aqua:vc:${user.id}:${Date.now()}`,
    issuer: {
      id: 'did:web:mos2es.xyz',
      name: 'AQUA Application Hub',
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `did:aqua:${user.id}`,
      type: 'ApplicantPersona',
      commitment_hash: (profile?.commitment_hash as string) ?? null,
      modes_enabled: (profile?.modes_enabled as string[]) ?? [],
      answer_count: answers.length,
      themes_covered: [...new Set(
        answers.map(a => {
          const q = (a as Record<string, unknown>).archived_questions as Record<string, unknown> | null
          return (q?.theme as string) ?? 'other'
        })
      )],
    },
    proof: {
      type: 'CommitmentHashProof2024',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: 'did:web:mos2es.xyz#commitment-verifier',
      commitment_hash: (profile?.commitment_hash as string) ?? null,
      provenance_chain: (profile?.provenance_chain as unknown[]) ?? [],
    },
    selectiveDisclosure: {
      supported: true,
      fields: ['answer_count', 'themes_covered', 'modes_enabled'],
      note: 'Individual answers are not included by default. Request specific answer disclosures via the AQUA API.',
    },
    provenance,
  }
}
