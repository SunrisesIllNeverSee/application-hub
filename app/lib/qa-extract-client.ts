// Client-safe extraction helpers for local-first import.
// Pure functions only — the server module lib/intake-extract.ts carries the
// AI-provider call path; this file re-exports the shared pure pieces (the
// prompt builder + JSON parsers are identical to intake-extract's contract)
// and adds a deterministic Q/A pair parser for no-provider extraction.

export type SourceKind =
  | 'accelerator'
  | 'job'
  | 'school'
  | 'scholarship'
  | 'grant'
  | 'fellowship'
  | 'other'

export interface ExtractedPair {
  question_text: string
  answer_text: string
  theme: string
  confidence: 'draft' | 'solid' | 'locked'
}

export const SYSTEM_PROMPT =
  'You are an expert at parsing applications — accelerator forms, job applications, school essays, grant proposals. You extract structured information from messy pasted text and return it as strict JSON.'

/** Identical contract to lib/intake-extract.ts buildQAPairsPrompt. */
export function buildQAPairsPrompt(text: string, sourceKind: SourceKind, programName?: string): string {
  return `Source: ${sourceKind}${programName ? ` — ${programName}` : ''}

Find every distinct question-answer pair in the application text below. A "pair" is any place the applicant was asked something — explicitly (e.g. "Q: ...", "1. Tell us...", "Why X?") or implicitly (e.g. a labeled section like "Summary:" followed by content the applicant wrote). Include cover-letter paragraphs and resume sections as Q&A pairs where the section heading is the implicit question.

For each pair, output an object with these exact fields:

- "question_text": the question as asked, cleaned up (no "Q:" prefix, no numbering). If the question is implicit, write a natural-language version. Max 280 chars.
- "answer_text": the applicant's full answer text, verbatim. Preserve paragraph breaks. Do not summarize.
- "theme": ONE of: team, traction, problem, solution, market, vision, personal, fit, leadership, technical, career_goals, why_this_school, ethics, other. Pick the single best fit.
- "confidence": ONE of: draft, solid, locked. Default to "draft" for short or rough answers, "solid" for complete and polished answers, and "locked" only for answers that look final-form and well-edited.

Output rules:
- Return ONLY a JSON array. No prose, no markdown fences, no commentary.
- Empty array [] if there are no extractable pairs.
- Skip pairs where the answer is blank or under 10 characters.
- Skip duplicate questions; merge their answers into one pair.

Application text:
"""
${text}
"""`
}

export function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export function isExtractedPair(x: unknown): x is ExtractedPair {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  return (
    typeof p.question_text === 'string' &&
    typeof p.answer_text === 'string' &&
    typeof p.theme === 'string'
  )
}

export function parsePairs(rawText: string): ExtractedPair[] {
  try {
    const parsed = JSON.parse(stripJsonFences(rawText))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isExtractedPair)
      .map((p) => ({
        question_text: p.question_text.slice(0, 280),
        answer_text: p.answer_text,
        theme: p.theme,
        confidence: (p.confidence === 'solid' || p.confidence === 'locked' ? p.confidence : 'draft') as ExtractedPair['confidence'],
      }))
      .filter((p) => p.answer_text.trim().length >= 10)
  } catch {
    return []
  }
}

// ─── Deterministic Q/A parser (no provider needed) ────────────────────────────
//
// Parses the common pasted-application shapes the hosted pipeline accepts:
//   Q: question            Question: question       ### Question
//   A: answer              Answer: answer           Answer
//   1. question?           (numbered questions followed by unlabeled answers
//                           are treated as question-only slots)
// Deterministic output is always labeled method 'imported' with confidence
// 'draft' — no invented confidence claims.

const Q_RE = /^\s*(?:q\s*[:.)]|question\s*[:.)]|#{1,4}\s*|\d+[\).]\s+|[-*•]\s*)?\s*(.+\?)\s*$/i
const A_RE = /^\s*(?:a\s*[:.)]|answer\s*[:.)])\s*(.*)$/i
const QLAB_RE = /^\s*(?:q|question)\s*[:.)]\s*(.+)$/i

export function extractQAPairsDeterministic(text: string): ExtractedPair[] {
  const lines = text.split(/\r?\n/)
  const pairs: ExtractedPair[] = []
  let pendingQ: string | null = null
  let answerBuf: string[] = []
  const seen = new Set<string>()

  const flush = () => {
    if (!pendingQ) return
    const answer = answerBuf.join('\n').trim()
    if (answer.length >= 10) {
      const key = pendingQ.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push({
          question_text: pendingQ.slice(0, 280),
          answer_text: answer,
          theme: 'other',
          confidence: 'draft',
        })
      }
    }
    pendingQ = null
    answerBuf = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    const aMatch = line.match(A_RE)
    const qMatch = line.match(QLAB_RE) ?? (line.match(Q_RE) ? line : null)

    if (aMatch && pendingQ) {
      // Answer line — collect this and following non-question lines.
      if (aMatch[1]) answerBuf.push(aMatch[1])
      continue
    }
    // IR-032: once an answer is being collected, a bare '?'-terminated line
    // is answer TEXT, not a new question — real questions inside answers
    // carry explicit markers (Q:/Question:/###/numbered/bullet).
    const explicitMarker = /^\s*(?:q\s*[:.)]|question\s*[:.)]|#{1,4}\s*|\d+[\).]\s+|[-*•]\s*\S)/i.test(line)
    const isQuestion = qMatch && !aMatch && (answerBuf.length === 0 || explicitMarker)
    if (isQuestion) {
      flush()
      const m = line.match(Q_RE)
      const qText = (m?.[1] ?? line.replace(/^\s*(?:q\s*[:.)]|question\s*[:.)]|#{1,4}\s*|\d+[\).]\s+|[-*•]\s*)\s*/i, '')).trim()
      pendingQ = qText.length >= 8 ? qText : null
      continue
    }
    if (pendingQ && line) {
      answerBuf.push(line)
    } else if (pendingQ && !line) {
      // blank line inside an answer — keep separator, answer may continue
      if (answerBuf.length > 0) answerBuf.push('')
    }
  }
  flush()
  return pairs
}
