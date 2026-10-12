// SP021 — shared coaching prompt construction.
// The legacy /api/draft route and the local-first consent-gated generation
// path BOTH build the same opportunity-specific prompt through this module —
// one prompt contract, two transports (server-hosted legacy, browser BYOK).

export type OpportunityKind =
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

export type CoachProfile = {
  voice: string
  audience: string
  tone_guidance: string
}

export const KIND_COACH_PROFILE: Record<OpportunityKind, CoachProfile> = {
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

export function resolveKind(raw: string | null | undefined): OpportunityKind {
  if (raw && raw in KIND_COACH_PROFILE) {
    return raw as OpportunityKind
  }
  return 'accelerator'
}

export interface DraftPromptInput {
  kind: OpportunityKind
  questionText: string
  theme?: string | null
  wordLimit?: number | null
  /** Optional program DNA theme weightings, e.g. "leadership (40%)" */
  dnaContext?: string
  /** Optional prior-answer context — private content; only the caller's
      explicit consent path may include it. */
  existingAnswerContext?: string
  profileContext?: string
}

export function buildDraftPrompt(input: DraftPromptInput): {
  systemPrompt: string
  userPrompt: string
  wordLimit: number
  targetWords: number
} {
  const wordLimit = input.wordLimit ?? 300
  const targetWords = Math.round(wordLimit * 0.85)
  const coach = KIND_COACH_PROFILE[input.kind]

  const systemPrompt = `You are an ${coach.voice}. You draft compelling, specific application answers that read well to ${coach.audience}.

${coach.tone_guidance}

Your drafts are:
- Concrete and evidence-driven (not vague or generic)
- Tailored to what this specific opportunity cares about
- Exactly within word limits (target ${targetWords} words, hard max ${wordLimit})

Never use filler phrases like "In conclusion", "I am excited to", or "innovative solution". Cut straight to substance.`

  const userPrompt = `Draft a strong application answer for this question:

**Question**: ${input.questionText}
**Theme**: ${input.theme ?? 'general'}
**Word limit**: ${wordLimit} words (target ~${targetWords} words)${input.dnaContext ?? ''}${input.profileContext ?? ''}${input.existingAnswerContext ?? ''}

Write the draft answer only — no preamble, no explanation, no word count at the end. Just the answer text.`

  return { systemPrompt, userPrompt, wordLimit, targetWords }
}
