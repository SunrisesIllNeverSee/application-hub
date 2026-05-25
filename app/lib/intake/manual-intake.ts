export type IntakeSourceType =
  | 'manual_url'
  | 'manual_paste'
  | 'manual_markdown'
  | 'manual_screenshot'
  | 'browser_extension'
  | 'api'
  | 'import_queue_legacy'

export type IntakeVertical = 'tech' | 'university' | 'grants' | 'jobs' | 'unknown'

export type IntakeCaptureMethod =
  | 'paste'
  | 'url_submit'
  | 'markdown_upload'
  | 'screenshot_upload'
  | 'extension_capture'
  | 'api_post'
  | 'legacy_import'

export type IntakeCheckpoint =
  | 'entity_checkpoint'
  | 'application_checkpoint'
  | 'structured_layers_checkpoint'
  | 'questions_checkpoint'
  | 'finalized'

export type IntakeReviewDecision = 'approve' | 'reject' | 'needs_revision'

export type IntakeMetaBlob = {
  schema_version: 'intake_meta_v1'
  adapter: {
    name: string
    version?: string | null
  }
  source: {
    original_url?: string | null
    normalized_url?: string | null
    domain?: string | null
    title?: string | null
    mime_type?: string | null
    file_name?: string | null
  }
  capture: {
    actor_type: 'user' | 'agent' | 'system'
    actor_id?: string | null
    method: string
    captured_at: string
    session_id?: string | null
    request_id?: string | null
  }
  classification: {
    vertical_hint?: IntakeVertical
    domain_hint?: 'founder' | 'education' | 'grants' | 'jobs' | 'general' | 'unknown'
    kind_hint?: string | null
    confidence?: number | null
  }
  content: {
    raw_char_count?: number | null
    raw_word_count?: number | null
    has_questions?: boolean | null
    has_answers?: boolean | null
    language?: string | null
  }
  ingestion: {
    route: string
    status?: string | null
    idempotency_key?: string | null
    legacy_queue_id?: string | null
    import_session_id?: string | null
  }
  notes?: {
    user_notes?: string | null
    internal_notes?: string | null
  }
}

export type IntakePayload = {
  source_type: IntakeSourceType
  raw_input: string
  source_url?: string | null
  source_title?: string | null
  vertical_hint?: IntakeVertical
  kind_hint?: string | null
  captured_at: string
  capture_method: IntakeCaptureMethod
  metadata: IntakeMetaBlob
}

export type ExtractedEntity = {
  name: string
  slug: string
  host_domain: string | null
  entity_type: string | null
  vertical: IntakeVertical
  payload: Record<string, unknown>
}

export type ExtractedApplication = {
  vertical: Exclude<IntakeVertical, 'unknown'>
  title: string
  cycle_label: string | null
  deadline_at: string | null
  application_status: string
  source_url: string | null
  payload: Record<string, unknown>
}

export type ExtractedLayer = {
  layer_key: 'obtained' | 'terms' | 'requirements'
  layer_order: 4 | 5 | 6
  payload: Record<string, unknown>
}

export type ExtractedQuestion = {
  question_text: string
  normalized_text: string
  order_index: number
  is_required: boolean
  word_limit: number | null
  char_limit: number | null
  payload: Record<string, unknown>
}

export type IntakeExtraction = {
  entity: ExtractedEntity
  application: ExtractedApplication
  layers: ExtractedLayer[]
  questions: ExtractedQuestion[]
}

const VERTICAL_KEYWORDS: Record<Exclude<IntakeVertical, 'unknown'>, string[]> = {
  tech: ['accelerator', 'startup', 'founder', 'equity', 'traction', 'cofounder', 'seed round', 'demo day'],
  university: ['university', 'college', 'gpa', 'admissions', 'degree', 'campus', 'essay', 'undergraduate', 'graduate'],
  grants: ['grant', 'fellowship', 'sbir', 'sttr', 'funding opportunity', 'principal investigator', 'award'],
  jobs: ['job', 'salary', 'compensation', 'resume', 'hiring', 'employment', 'cover letter', 'role'],
}

const QUESTION_LINE_REGEX = /^(\d+[\).\s-]+|q[:.\s-]+|question[:.\s-]+|prompt[:.\s-]+|essay[:.\s-]+|short answer[:.\s-]+)?(.+\?)\s*$/i

export function normalizeUrl(input?: string | null) {
  if (!input) return null
  try {
    const url = new URL(input)
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return input
  }
}

export function hostDomainFromUrl(input?: string | null) {
  if (!input) return null
  try {
    return new URL(input).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function inferVertical(rawInput: string, hint?: IntakeVertical, sourceUrl?: string | null): IntakeVertical {
  if (hint && hint !== 'unknown') return hint
  const corpus = `${rawInput}\n${sourceUrl ?? ''}`.toLowerCase()
  let best: { vertical: IntakeVertical; score: number } = { vertical: 'unknown', score: 0 }
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS) as Array<[Exclude<IntakeVertical, 'unknown'>, string[]]>) {
    const score = keywords.reduce((acc, keyword) => acc + (corpus.includes(keyword) ? 1 : 0), 0)
    if (score > best.score) best = { vertical, score }
  }
  return best.vertical
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entity'
}

export function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function buildIntakeMeta(input: {
  adapterName: string
  actorId: string
  route: string
  payload: Omit<IntakePayload, 'metadata'>
  requestId?: string | null
}): IntakeMetaBlob {
  const normalizedUrl = normalizeUrl(input.payload.source_url ?? null)
  const rawInput = input.payload.raw_input
  return {
    schema_version: 'intake_meta_v1',
    adapter: {
      name: input.adapterName,
    },
    source: {
      original_url: input.payload.source_url ?? null,
      normalized_url: normalizedUrl,
      domain: hostDomainFromUrl(normalizedUrl),
      title: input.payload.source_title ?? null,
    },
    capture: {
      actor_type: 'user',
      actor_id: input.actorId,
      method: input.payload.capture_method,
      captured_at: input.payload.captured_at,
      request_id: input.requestId ?? null,
    },
    classification: {
      vertical_hint: input.payload.vertical_hint ?? 'unknown',
      domain_hint: mapVerticalToDomain(input.payload.vertical_hint ?? 'unknown'),
      kind_hint: input.payload.kind_hint ?? null,
      confidence: null,
    },
    content: {
      raw_char_count: rawInput.length,
      raw_word_count: countWords(rawInput),
      has_questions: rawInput.includes('?'),
      has_answers: /\b(a:|answer[:\s-])/i.test(rawInput),
      language: 'en',
    },
    ingestion: {
      route: input.route,
      status: 'pending_review',
    },
    notes: {
      user_notes: null,
      internal_notes: null,
    },
  }
}

function mapVerticalToDomain(vertical: IntakeVertical): IntakeMetaBlob['classification']['domain_hint'] {
  switch (vertical) {
    case 'tech':
      return 'founder'
    case 'university':
      return 'education'
    case 'grants':
      return 'grants'
    case 'jobs':
      return 'jobs'
    default:
      return 'unknown'
  }
}

function guessEntityName(input: IntakePayload) {
  const title = input.source_title?.trim()
  if (title) return title
  const host = hostDomainFromUrl(input.source_url ?? null)
  if (host) {
    const first = host.split('.')[0] ?? host
    return first.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  return 'Unresolved Host'
}

function extractDeadline(rawInput: string) {
  const patterns = [
    /\b(deadline|due|apply by)[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /\b(deadline|due|apply by)[:\s]+(\d{4}-\d{2}-\d{2})/i,
  ]
  for (const pattern of patterns) {
    const match = rawInput.match(pattern)
    if (!match) continue
    const candidate = new Date(match[2])
    if (!Number.isNaN(candidate.getTime())) return candidate.toISOString()
  }
  return null
}

function extractCycleLabel(rawInput: string) {
  const match = rawInput.match(/\b([SWF]\d{2}|Spring \d{4}|Summer \d{4}|Fall \d{4}|Winter \d{4}|FY ?\d{4})\b/i)
  return match?.[1] ?? null
}

function collectSentences(rawInput: string, keywords: string[]) {
  const snippets = rawInput
    .split(/\n+|(?<=[.?!])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword)))
    .slice(0, 8)
  return snippets
}

function extractQuestions(rawInput: string): ExtractedQuestion[] {
  const lines = rawInput.split('\n').map((line) => line.trim()).filter(Boolean)
  const questions: ExtractedQuestion[] = []

  for (const line of lines) {
    const match = line.match(QUESTION_LINE_REGEX)
    if (!match) continue
    const questionText = match[2].trim()
    if (questionText.length < 8) continue
    const normalized = questionText.replace(/\s+/g, ' ').trim()
    if (questions.some((existing) => existing.normalized_text.toLowerCase() === normalized.toLowerCase())) continue
    const wordLimitMatch = line.match(/(\d{2,4})\s*(word|words)/i)
    const charLimitMatch = line.match(/(\d{2,5})\s*(character|characters|char)/i)
    questions.push({
      question_text: questionText,
      normalized_text: normalized,
      order_index: questions.length + 1,
      is_required: !/\b(optional)\b/i.test(line),
      word_limit: wordLimitMatch ? Number(wordLimitMatch[1]) : null,
      char_limit: charLimitMatch ? Number(charLimitMatch[1]) : null,
      payload: {
        raw_line: line,
        detected_by: 'regex_question_line',
      },
    })
  }

  if (questions.length > 0) return questions

  return rawInput
    .split(/\n{2,}|(?<=[?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.endsWith('?') && chunk.length > 8)
    .slice(0, 25)
    .map((chunk, index) => ({
      question_text: chunk,
      normalized_text: chunk.replace(/\s+/g, ' ').trim(),
      order_index: index + 1,
      is_required: true,
      word_limit: null,
      char_limit: null,
      payload: {
        raw_line: chunk,
        detected_by: 'fallback_question_split',
      },
    }))
}

export function extractManualIntake(payload: IntakePayload): IntakeExtraction {
  const vertical = inferVertical(payload.raw_input, payload.vertical_hint, payload.source_url)
  const entityName = guessEntityName(payload)
  const hostDomain = hostDomainFromUrl(payload.source_url ?? payload.metadata.source.normalized_url ?? null)

  const entity: ExtractedEntity = {
    name: entityName,
    slug: slugify(entityName),
    host_domain: hostDomain,
    entity_type: payload.kind_hint ?? null,
    vertical,
    payload: {
      source_url: payload.source_url ?? null,
      source_title: payload.source_title ?? null,
      guessed_from: hostDomain ? 'source_url' : 'source_title_or_fallback',
    },
  }

  const normalizedVertical: Exclude<IntakeVertical, 'unknown'> = vertical === 'unknown' ? 'tech' : vertical

  const application: ExtractedApplication = {
    vertical: normalizedVertical,
    title: payload.source_title?.trim() || `${entityName} Intake`,
    cycle_label: extractCycleLabel(payload.raw_input),
    deadline_at: extractDeadline(payload.raw_input),
    application_status: 'indexed',
    source_url: payload.source_url ?? null,
    payload: {
      source_type: payload.source_type,
      capture_method: payload.capture_method,
      source_title: payload.source_title ?? null,
      kind_hint: payload.kind_hint ?? null,
    },
  }

  const layers: ExtractedLayer[] = [
    {
      layer_key: 'obtained',
      layer_order: 4,
      payload: {
        summary: collectSentences(payload.raw_input, ['funding', 'scholarship', 'salary', 'degree', 'equity', 'compensation', 'award']),
      },
    },
    {
      layer_key: 'terms',
      layer_order: 5,
      payload: {
        summary: collectSentences(payload.raw_input, ['equity', 'remote', 'hybrid', 'location', 'residency', 'ip', 'reporting', 'full-time']),
      },
    },
    {
      layer_key: 'requirements',
      layer_order: 6,
      payload: {
        summary: collectSentences(payload.raw_input, ['gpa', 'citizenship', 'revenue', 'team', 'experience', 'eligible', 'qualification', 'credential']),
      },
    },
  ]

  return {
    entity,
    application,
    layers,
    questions: extractQuestions(payload.raw_input),
  }
}

export const CHECKPOINT_ORDER: IntakeCheckpoint[] = [
  'entity_checkpoint',
  'application_checkpoint',
  'structured_layers_checkpoint',
  'questions_checkpoint',
  'finalized',
]

export function nextCheckpoint(checkpoint: IntakeCheckpoint): IntakeCheckpoint {
  const index = CHECKPOINT_ORDER.indexOf(checkpoint)
  if (index === -1 || index === CHECKPOINT_ORDER.length - 1) return 'finalized'
  return CHECKPOINT_ORDER[index + 1]
}
