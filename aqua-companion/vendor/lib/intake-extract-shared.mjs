// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/intake-extract-shared.ts
// source-sha256: 6beb1ce9d8f383280b7c942c96dcf18e8db8059250e91ac597b28d13cfe4c810
// body-sha256: f3b79ec03eb6ceedd63503e4097811bb00e8900e95dd02dc1fa6c1d2dc8cf080
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// Shared intake + extraction — PURE module (no server deps, no imports of
// the hosted-side libraries). Client- and server-safe.
//
// intake-extract.ts re-exports everything here so existing server callers
// keep one import surface; client code (local-first intake, Q&A import)
// imports THIS file directly — never intake-extract.ts, which pulls
// @anthropic-ai/sdk + server crypto.

// ─── Enums / contracts ────────────────────────────────────────────────────────

export const SOURCE_KINDS = ['accelerator', 'job', 'school', 'grant', 'other']         
                                                      

export const MODES = ['questions_only', 'qa_pairs']         
                                         

export const SPEC_THEMES = [
  'team', 'traction', 'problem', 'solution', 'market', 'vision', 'personal',
  'fit', 'leadership', 'technical', 'career_goals', 'why_this_school',
  'ethics', 'other',
]         
                                                    

export const DB_THEME_FALLBACK = new Map                ([
  ['team', 'team'],
  ['traction', 'traction'],
  ['problem', 'problem'],
  ['solution', 'solution'],
  ['market', 'market'],
  ['vision', 'vision'],
  ['personal', 'personal'],
  ['fit', 'fit'],
  ['leadership', 'team'],
  ['technical', 'technical'],
  ['career_goals', 'vision'],
  ['why_this_school', 'fit'],
  ['ethics', 'personal'],
  ['other', 'personal'],
])

export const CONFIDENCES = ['draft', 'solid', 'locked']         
                                                     

                             
                       
                     
                  
                        
                                                                             
                     
                             
 

                                
                        
                                                                      
                                                             
                              
                                 
                           
 

                                 
                       
                  
 

// ─── LLM extraction prompts ───────────────────────────────────────────────────

export const SYSTEM_PROMPT =
  'You are an expert at parsing applications — accelerator forms, job applications, school essays, grant proposals. You extract structured information from messy pasted text and return it as strict JSON.'

export function buildQAPairsPrompt(text        , sourceKind            , programName         )         {
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

export function buildQuestionsOnlyPrompt(text        , sourceKind            , programName         )         {
  return `Source: ${sourceKind}${programName ? ` — ${programName}` : ''}

Extract every distinct question from this application form. Questions may be:
- Explicitly labeled ("1.", "Q:", "Tell us...", "Why...?")
- Section headings followed by a blank space the applicant fills in
- Essay prompts or short answer prompts

For each question output an object with:
- "question_text": the question exactly as written, cleaned (no numbering, no "Q:"). Max 300 chars.
- "theme": ONE of: team, traction, problem, solution, market, vision, personal, fit, leadership, technical, career_goals, why_this_school, ethics, other

Rules:
- Return ONLY a JSON array. No prose, no markdown.
- Skip logistics questions (name, email, phone, address, company website).
- Deduplicate — if the same question appears twice, include it once.
- Empty array [] if no extractable questions found.

Application text:
"""
${text}
"""`
}

// ─── Output validation ────────────────────────────────────────────────────────

export function isExtractedPair(x         )                     {
  if (!x || typeof x !== 'object') return false
  const o = x                           
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.answer_text !== 'string' || o.answer_text.length < 10) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme             )) return false
  if (typeof o.confidence !== 'string' || !CONFIDENCES.includes(o.confidence              )) return false
  return true
}

export function isExtractedQuestion(x         )                         {
  if (!x || typeof x !== 'object') return false
  const o = x                           
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme             )) return false
  return true
}

export function stripJsonFences(raw        )         {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parsePairs(rawText        )                  {
  let parsed         
  try {
    parsed = JSON.parse(stripJsonFences(rawText))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out                  = []
  for (const item of parsed) {
    if (isExtractedPair(item)) out.push(item)
  }
  return out
}

export function parseQuestions(rawText        )                      {
  let parsed         
  try {
    parsed = JSON.parse(stripJsonFences(rawText))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out                      = []
  for (const item of parsed) {
    if (isExtractedQuestion(item)) out.push(item)
  }
  return out
}

// ─── Regex-based structured parser (no AI required) ──────────────────────────

export function parseStructuredText(text        )                  {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const pairs                  = []

  const qaRegex = /(?:^|\n)\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)\n\s*(?:\*\*)?\s*(?:A|Answer)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)(?=\n\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]|$)/gi

  let m                        
  while ((m = qaRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\s+/g, ' ')
    const a = m[2].trim()
    if (q.length > 0 && a.length >= 10) {
      pairs.push({ question_text: q, answer_text: a, theme: 'personal', confidence: 'draft' })
    }
  }
  if (pairs.length > 0) return pairs

  const mdRegex = /(?:^|\n)#{1,3}\s+(.+?)\n+([\s\S]+?)(?=\n#{1,3}\s+|$)/g
  while ((m = mdRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\?$/, '?').replace(/\s+/g, ' ')
    const a = m[2].trim()
    if (q.length > 0 && a.length >= 10) {
      pairs.push({
        question_text: q.endsWith('?') ? q : q + '?',
        answer_text: a,
        theme: 'personal',
        confidence: 'draft',
      })
    }
  }
  if (pairs.length > 0) return pairs

  const blocks = cleaned.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean)
  for (let i = 0; i < blocks.length - 1; i++) {
    const possibleQ = blocks[i].replace(/^\d+[\.\)]\s*/, '').trim()
    if (possibleQ.endsWith('?') && possibleQ.length < 500) {
      const possibleA = blocks[i + 1].replace(/^\d+[\.\)]\s*/, '').trim()
      if (possibleA.length >= 10 && !possibleA.endsWith('?')) {
        pairs.push({
          question_text: possibleQ.replace(/\s+/g, ' '),
          answer_text: possibleA,
          theme: 'personal',
          confidence: 'draft',
        })
        i++
      }
    }
  }

  return pairs
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
const EXPLICIT_MARKER_RE = /^\s*(?:q\s*[:.)]|question\s*[:.)]|#{1,4}\s*|\d+[\).]\s+|[-*•]\s*\S)/i

                                                              

/**
 * Line grammar shared by the deterministic Q/A parser and the M09 catalog
 * extractor (lib/catalog/extract.ts): classifies one line with the SAME
 * Q:/Question:/###/numbered/bullet/'?' rules used above. `text` is the
 * question wording with the marker removed (exact otherwise), or the inline
 * answer text after an A:/Answer: label.
 */
export function classifyQALine(rawLine        )                                                               {
  const line = rawLine.trim()
  const explicit = EXPLICIT_MARKER_RE.test(line)
  const a = line.match(A_RE)
  if (a) return { kind: 'answer_label', text: (a[1] ?? '').trim(), explicit_marker: true }
  const lab = line.match(QLAB_RE)
  if (lab) return { kind: 'question', text: lab[1].trim(), explicit_marker: true }
  const q = line.match(Q_RE)
  if (q) return { kind: 'question', text: q[1].trim(), explicit_marker: explicit }
  return { kind: 'other', text: line, explicit_marker: explicit }
}

export function extractQAPairsDeterministicReport(text        )                {
  const lines = text.split(/\r?\n/)
  const pairs                  = []
  let pendingQ                = null
  let answerBuf           = []
  const seen = new Set        ()
  let pendingUncertainty                       = { absorbed: 0 }
  let absorbedLines = 0
  let droppedQuestions = 0
  let uncertainBoundaries = 0

  const flush = () => {
    if (!pendingQ) { pendingUncertainty = { absorbed: 0 }; return }
    const answer = answerBuf.join('\n').trim()
    if (answer.length >= 10) {
      const key = pendingQ.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        const uncertain = pendingUncertainty.absorbed > 0
        if (uncertain) uncertainBoundaries++
        pairs.push({
          question_text: pendingQ.slice(0, 280),
          answer_text: answer,
          theme: 'other',
          confidence: 'draft',
          ...(uncertain
            ? {
                uncertain: true,
                uncertainty_reason:
                  'question-marked lines inside the answer were treated as answer text — verify the boundary',
              }
            : {}),
        })
      }
    } else {
      // a pending question whose "answer" never formed — empty OR too short
      // to be a real answer — is dropped either way; surface it so the user
      // knows a Q may have been mis-split (IR-037 review gap)
      droppedQuestions++
      uncertainBoundaries++
    }
    pendingQ = null
    answerBuf = []
    pendingUncertainty = { absorbed: 0 }
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
    // IR-037: a '?'-terminated line inside an answer that did NOT become a
    // question is a genuinely ambiguous boundary — record it.
    if (pendingQ && line && /\?\s*$/.test(line) && !isQuestion) {
      pendingUncertainty.absorbed++
      absorbedLines++
    }
    if (pendingQ && line) {
      answerBuf.push(line)
    } else if (pendingQ && !line) {
      // blank line inside an answer — keep separator, answer may continue
      if (answerBuf.length > 0) answerBuf.push('')
    }
  }
  flush()
  return { pairs, uncertain_boundaries: uncertainBoundaries, absorbed_question_lines: absorbedLines, dropped_questions: droppedQuestions }
}

export function extractQAPairsDeterministic(text        )                  {
  return extractQAPairsDeterministicReport(text).pairs
}
