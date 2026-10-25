// VENDORED from application-hub-mcp-server/src/vendor/companion/vendor/lib/catalog/normalize.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/vendor/lib/catalog/normalize.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/normalize.ts
// source-sha256: 46a4d9ad293b82e95d4b312ee70f83f5e3a187d0885c3006976bfa05f30907ea
// body-sha256: 2015c0bc06e02060d4e70c152162482df52456ccc1e3b195af4c36a1689bab41
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — QU normalization + requirement parsing. PURE module.
//
// No Next/Supabase/Node imports: importable from node --test (type
// stripping), from server routes, and from browser code.
//
// Two representations are kept apart on purpose (M09 §4):
//   - the OCCURRENCE wording (exact, never rewritten), and
//   - a normalized matching key derived from it.
// normalizeQuestion() strips limit / required markers for matching but
// RETURNS them separately so an occurrence's word limit, time context and
// qualifying clauses are never discarded.

// ─── Folding ──────────────────────────────────────────────────────────────────

const QUOTE_MAP                         = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '…': '...', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‌': '', '‍': '', '﻿': '',
}

/** Unicode-normalize, unify quotes/dashes/spaces, collapse whitespace. Case kept. */
export function cleanText(s        )         {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚‛′“”„‟″‐-―−…   ​-‍﻿]/g, (c) => QUOTE_MAP[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Whitespace / case / punctuation folding used by the `exact` tier.
 * Punctuation becomes a separator, so "Team?" and "team" fold equal, but
 * every word (including limit clauses) is kept.
 */
export function foldText(s        )         {
  return cleanText(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1') // 1,000 -> 1000
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const CONTRACTIONS                          = [
  [/\bwhat's\b/g, 'what is'], [/\bwho's\b/g, 'who is'], [/\bhow's\b/g, 'how is'],
  [/\bwhere's\b/g, 'where is'], [/\bthat's\b/g, 'that is'], [/\bit's\b/g, 'it is'],
  [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'], [/\bthey're\b/g, 'they are'],
  [/\byou've\b/g, 'you have'], [/\bwe've\b/g, 'we have'], [/\bi'm\b/g, 'i am'],
  [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'], [/\bhaven't\b/g, 'have not'], [/\bhasn't\b/g, 'has not'],
]

const LEADING_MARKER_RE = /^\s*(?:(?:q(?:uestion)?\s*\d*\s*[:.)\-]\s*)|(?:\(?\d{1,3}[.)]\s+)|(?:\(?[a-z][.)]\s+)|(?:[-*•]\s+)|(?:#{1,6}\s+))+/i
const FILLER_RE = /^(?:please\s+|kindly\s+)/

// ─── Requirements ─────────────────────────────────────────────────────────────

                               
                     
                   
                     
                   
                         
                                                                                    
                    
                    
                                                                                                      
                        
                                                                                     
                      
                                                                                        
                         
 

const NUMBER_WORDS                         = {
  one: 1, a: 1, single: 1, 'a single': 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|a single|single|a)`
const WORD_UNIT = String.raw`(?:words?)`
const CHAR_UNIT = String.raw`(?:characters?|chars?\.?)`
const SENT_UNIT = String.raw`(?:sentences?)`
const PREFIX = String.raw`(?:(?:in|use|using|with|answer\s+in)\s+)?(?:max(?:imum)?\.?(?:\s*of)?|up\s*to|no\s*more\s*than|not\s*(?:to\s*)?exceed(?:ing)?|limit(?:ed)?\s*(?:to|of)?|at\s*most|under|fewer\s*than|less\s*than|within|≤|<=|=<|in|use|using)`
const SUFFIX = String.raw`(?:max(?:imum)?\.?|limit|or\s*(?:less|fewer)|at\s*most|tops)`

function toNumber(raw        )                     {
  const k = raw.trim().toLowerCase()
  if (k in NUMBER_WORDS) return NUMBER_WORDS[k]
  const n = Number(k.replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

                                        
                                                                                         

function unitPatterns(unit      )           {
  const U = unit === 'word' ? WORD_UNIT : unit === 'char' ? CHAR_UNIT : SENT_UNIT
  const label = unit === 'word' ? 'word' : unit === 'char' ? '(?:character|char)' : 'sentence'
  return [
    // range: "150-250 words", "between 150 and 250 words"
    new RegExp(String.raw`(?:${PREFIX}\s*:?\s*)?(?:between\s+)?${NUM}\s*(?:-|to|and)\s*${NUM}\s*-?\s*${U}(?:\s*${SUFFIX})?`, 'gi'),
    // "Maximum 250 words", "up to 3 sentences", "≤ 200 words", "max 1,000 chars"
    new RegExp(String.raw`${PREFIX}\s*:?\s*${NUM}\s*-?\s*${U}(?:\s*${SUFFIX})?`, 'gi'),
    // "250 words max", "500 characters maximum", "300 words or less"
    new RegExp(String.raw`${NUM}\s*-?\s*${U}\s*${SUFFIX}`, 'gi'),
    // "250-word limit", "500-character response"
    new RegExp(String.raw`${NUM}\s*-\s*${label}s?\s*(?:limit|max(?:imum)?|response|answer|essay|statement|summary|description)`, 'gi'),
    // "Word limit: 250", "character limit 500", "word count: 300"
    new RegExp(String.raw`${label}\s*(?:limit|count|max(?:imum)?)\s*(?:of\s*)?[:=\-]?\s*${NUM}(?:\s*${U})?`, 'gi'),
    // bare in brackets: "(250 words)", "[500 characters]"
    new RegExp(String.raw`[(\[]\s*${NUM}\s*${U}\s*[)\]]`, 'gi'),
  ]
}

function findLimits(text        )             {
  const hits             = []
  const taken = (s        , e        ) => hits.some((h) => s < h.end && e > h.start)
  for (const unit of ['word', 'char', 'sentence']          ) {
    const pats = unitPatterns(unit)
    pats.forEach((re, idx) => {
      for (const m of text.matchAll(re)) {
        const start = m.index ?? 0
        const end = start + m[0].length
        if (taken(start, end)) continue
        if (idx === 0) {
          const a = toNumber(m[1]); const b = toNumber(m[2])
          if (a === undefined || b === undefined) continue
          hits.push({ unit, min: Math.min(a, b), max: Math.max(a, b), start, end })
        } else {
          const n = toNumber(m[1])
          if (n === undefined) continue
          // "a word" / "in a sentence" style only make sense for sentences
          if (unit !== 'sentence' && /^(?:a|single|a single)$/i.test(m[1])) continue
          // bare "in 2026 words" nonsense guard: in-prefix only with sentence/word counts
          hits.push({ unit, max: n, start, end })
        }
      }
    })
  }
  return hits.sort((a, b) => a.start - b.start)
}

                                                                                 

const REQUIRED_PATTERNS                                           = [
  [/\*\s*required\b/gi, 'required'],
  [/[(\[]\s*required\s*[)\]]/gi, 'required'],
  [/(?:[,:|]|\s[-–—]|^)\s*required\s*[.:!]?\s*$/gi, 'required'],
  [/^\s*required\s*[:\-–—]\s*/gi, 'required'],
  [/[(\[]\s*optional\s*[)\]]/gi, 'optional'],
  [/(?:[,:|]|\s[-–—]|^)\s*optional\s*[.:!]?\s*$/gi, 'optional'],
  [/^\s*optional\s*[:\-–—]\s*/gi, 'optional'],
  [/\s*\*+\s*$/g, 'required'],
]

function findMarkers(text        )              {
  const out              = []
  for (const [re, kind] of REQUIRED_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      const end = start + m[0].length
      if (out.some((h) => start < h.end && end > h.start)) continue
      out.push({ kind, start, end })
    }
  }
  return out
}

const TIME_PATTERNS           = [
  /\b(?:in|over|during|within|for)\s+the\s+(?:last|past|next|coming|previous|upcoming)\s+(?:\d+|one|two|three|four|five|six|twelve|eighteen|twenty-four)?\s*(?:days?|weeks?|months?|quarters?|years?)\b/gi,
  /\b(?:last|past|next|previous|coming)\s+(?:\d+|one|two|three|four|five|six|twelve|eighteen)\s+(?:days?|weeks?|months?|quarters?|years?)\b/gi,
  /\b(?:this|last|next|the\s+current|current|the\s+past|past)\s+(?:year|quarter|month|week|semester|fiscal\s+year|academic\s+year|cycle|batch|cohort)\b/gi,
  /\b(?:to\s+date|so\s+far|year[-\s]to[-\s]date|ytd|currently|right\s+now|today|at\s+present)\b/gi,
  /\bsince\s+(?:(?:19|20)\d{2}|launch|founding|inception|you\s+(?:started|launched|founded))\b/gi,
  /\b(?:by|before|after|in|during|for)\s+(?:(?:q[1-4]|h[12])\s+)?(?:19|20)\d{2}\b/gi,
  /\b(?:FY|fiscal\s+)(?:19|20)?\d{2}\b/g,
  /\b(?:19|20)\d{2}\b/g,
]

const QUALIFIER_PATTERNS           = [
  /\b(?:and\s+)?why\s+now\b/gi,
  /\b(?:and\s+)?why\s+(?:is\s+(?:it|this)\s+)?(?:important|urgent|relevant|timely)(?:\s+now)?\b/gi,
  /\bwith\s+(?:supporting\s+)?(?:evidence|examples?|data|metrics|specifics|numbers|citations|links|proof)\b/gi,
  /\b(?:and\s+)?what\s+evidence\s+[^,;?.]*/gi,
  /\b(?:please\s+)?(?:be\s+specific|include\s+(?:specific\s+)?(?:examples?|metrics|data|numbers|evidence|links)|give\s+(?:an?\s+)?examples?|cite\s+[^,;?.]*)/gi,
  /\b(?:if\s+(?:applicable|any|so|relevant|yes|not)|where\s+applicable|when\s+applicable)\b/gi,
  /\b(?:in\s+(?:plain|simple)\s+(?:english|language|terms))\b/gi,
  /\b(?:for\s+(?:a\s+)?(?:non-?technical|general|lay)\s+(?:audience|reader|person))\b/gi,
]

// Interrogative clauses appended after a comma/semicolon/"and" — the
// directive's example "What problem are you solving, why is it important
// now, and what evidence supports your assessment?".
const PROMPT_WORD_RE = /\b(?:what|why|how|who|when|where|which|describe|tell|explain|list|share|provide|outline|summari[sz]e|discuss|give|is|are|do|does|did|have|has|can|will|would)\b/i
const APPENDED_CLAUSE_RE = /(?:,|;|\s-\s|\band\b)\s*((?:and\s+)?(?:why|how|what|when|where|which|who)\b[^,;?.()]{3,})/gi

function uniqPush(arr          , v        ) {
  const k = foldText(v)
  if (!k) return
  if (!arr.some((x) => foldText(x) === k)) arr.push(v)
}

function trimClause(s        )         {
  return cleanText(s).replace(/^[\s,;:\-–—(\[]+|[\s,;:\-–—)\].?!]+$/g, '').trim()
}

function parseInternal(text        )                                          {
  const src = cleanText(text)
  const req               = { time_context: [], qualifiers: [], limit_clauses: [] }

  const limits = findLimits(src)
  for (const h of limits) {
    if (h.unit === 'word') { if (req.word_limit === undefined) { req.word_limit = h.max; if (h.min !== undefined) req.word_min = h.min } }
    else if (h.unit === 'char') { if (req.char_limit === undefined) { req.char_limit = h.max; if (h.min !== undefined) req.char_min = h.min } }
    else if (req.sentence_limit === undefined) req.sentence_limit = h.max
  }

  // Remove limit spans first, then markers on the remainder.
  let stripped = ''
  let cursor = 0
  for (const h of limits) {
    req.limit_clauses.push(trimClause(src.slice(h.start, h.end)))
    stripped += src.slice(cursor, h.start) + ' '
    cursor = h.end
  }
  stripped += src.slice(cursor)
  stripped = tidy(stripped)

  // Markers may be revealed only after limit removal (e.g. "(max 250 words) *").
  for (let pass = 0; pass < 3; pass++) {
    const markers = findMarkers(stripped)
    if (markers.length === 0) break
    let out = ''
    let c = 0
    for (const m of markers.sort((a, b) => a.start - b.start)) {
      if (m.kind === 'required') { req.required = true }
      else { req.optional = true; if (req.required !== true) req.required = false }
      req.limit_clauses.push(trimClause(stripped.slice(m.start, m.end)) || '*')
      out += stripped.slice(c, m.start) + ' '
      c = m.end
    }
    out += stripped.slice(c)
    stripped = tidy(out)
  }

  for (const re of TIME_PATTERNS) {
    for (const m of stripped.matchAll(re)) {
      const v = trimClause(m[0])
      // skip a bare year already covered by a longer phrase
      if (req.time_context.some((t) => foldText(t).includes(foldText(v)))) continue
      uniqPush(req.time_context, v)
    }
  }
  for (const re of QUALIFIER_PATTERNS) {
    for (const m of stripped.matchAll(re)) {
      // a clause at the very start IS the question, not a qualifier on it
      if (!stripped.slice(0, m.index ?? 0).trim()) continue
      uniqPush(req.qualifiers, trimClause(m[0]))
    }
  }
  for (const m of stripped.matchAll(APPENDED_CLAUSE_RE)) {
    const clause = trimClause(m[1])
    // only a clause appended to an already-posed request counts
    if (!PROMPT_WORD_RE.test(stripped.slice(0, m.index ?? 0))) continue
    if (clause.split(' ').length < 2) continue
    if (req.qualifiers.some((q) => foldText(clause).includes(foldText(q)) || foldText(q).includes(foldText(clause)))) continue
    uniqPush(req.qualifiers, clause)
  }
  return { req, stripped }
}

function tidy(s        )         {
  return s
    .replace(/[(\[]\s*[)\]]/g, ' ')        // empty brackets left behind
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/([,;:])(?=\s*[?.!]?\s*$)/g, '')
    .replace(/\s*[-–—|]\s*$/g, '')
    .replace(/^\s*[-–—|:]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse every requirement carried in a prompt's text. */
export function parseRequirements(text        )               {
  return parseInternal(text).req
}

                                     
                                                                         
                  
                                                                                         
              
                                               
                    
                  
                            
 

/** Normalize a prompt for matching. Limit clauses are stripped from the key and returned in `requirements`. */
export function normalizeQuestion(text        )                     {
  const original = cleanText(text)
  const { req, stripped } = parseInternal(original)
  const core = tidy(stripped.replace(LEADING_MARKER_RE, '')) || original
  let key = core.toLowerCase()
  for (const [re, rep] of CONTRACTIONS) key = key.replace(re, rep)
  key = foldText(key).replace(FILLER_RE, '').trim()
  return { original, core, normalized: key, tokens: key ? key.split(' ') : [], requirements: req }
}

// ─── Token similarity (deterministic fallback for the semantic tier) ──────────

const STOP = new Set(
  ('a an the and or but of to in for on with at by from as is are was were be been being ' +
    'your you yours we our us i my me it its this that these those there their they them ' +
    'do does did can could should would will shall may might please tell describe explain ' +
    'share provide give briefly detail details any some about into than then so if')
    .split(' '),
)

export function contentTokens(text        )           {
  const out           = []
  for (const t of foldText(text).split(' ')) {
    if (!t || STOP.has(t)) continue
    // light stemming so "solving"/"solve", "customers"/"customer" meet
    const s = t.length > 5 ? t.replace(/(?:ing|ed|es|s)$/, '') : t.replace(/s$/, '')
    out.push(s)
  }
  return out
}

/**
 * Deterministic similarity in [0,1]: max(Jaccard, mean(Jaccard, recall of the
 * shorter side)). Honest text overlap — NOT a semantic judgement.
 */
export function tokenSimilarity(a        , b        )         {
  const A = new Set(contentTokens(a))
  const B = new Set(contentTokens(b))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const jaccard = inter / (A.size + B.size - inter)
  const recall = inter / Math.min(A.size, B.size)
  return Math.max(jaccard, (jaccard + recall) / 2)
}
