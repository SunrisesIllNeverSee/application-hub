// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/classify.ts
// source-sha256: 660553c6a8677e16522b2086ea2d46c6e01fb50973f34f4429e0dfaf5b1d8d4e
// body-sha256: d5f2b5e4819e6677a8fa82852ddbe0ae0788af9dd5e6813b072d9fe6b0976995
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — public / private / uncertain classification. PURE module.
//
// M09 §12: an imported document is never a catalog contribution as a whole.
//   potentially public  program identity, public requirements, normalized
//                       questions, published deadlines, source references
//   private             answers / answer-like prose, filled values, PII,
//                       secrets, private links
//   uncertain           anything whose publication status or provenance is
//                       not established — stays PRIVATE by default
//
// buildPublicCandidate() emits ONLY potentially-public fields and throws if
// any private/uncertain marker would leak. A candidate is a proposal for an
// authorized curator; it is never approval (Candidate → … → Approved →
// Published happens elsewhere, by a human).

import { normalizeQuestion, foldText,                   } from './normalize.mjs'
                                                                                       

                                                           

// ─── secret / sensitive-link detection ────────────────────────────────────────

                        
                                                                                
                                                                                      

                                                                                                                                             

const SECRET_PATTERNS                              = [
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}/g],
  ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/gi],
  ['api_key', /\b(?:sk-(?:ant-|proj-|live-)?[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|pk_(?:live|test)_[A-Za-z0-9]{16,}|rk_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sbp_[A-Za-z0-9]{30,}|sb_secret_[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/g],
  ['credential_assignment', /\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|pwd)\s*[:=]\s*["']?[^\s"',;]{8,}/gi],
]

const TOKEN_PARAM_RE = /^(?:token|access_token|refresh_token|id_token|auth|authorization|key|api_key|apikey|api-key|sig|signature|x-amz-signature|x-amz-credential|x-amz-security-token|x-goog-signature|x-goog-credential|code|secret|client_secret|session|sessionid|session_id|sid|password|pwd|jwt|otp|magic|invite|invite_code|ticket|hash)$/i
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+/gi

function redact(s        )         {
  if (s.length <= 8) return '***'
  return `${s.slice(0, 4)}…[${s.length} chars]`
}

function ipv4Private(host        )          {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [+m[1], +m[2]]
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

/** Classify one URL's sensitivity (no network). Returns the reasons it is NOT shareable. */
export function urlSensitivity(raw        )               {
  let u     
  try { u = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw) } catch { return [] }
  const out               = []
  if (u.username || u.password) out.push('url_credentials')
  for (const k of u.searchParams.keys()) if (TOKEN_PARAM_RE.test(k)) { out.push('url_token_param'); break }
  if (/(?:^|[#&])(?:access_token|id_token|token|code)=/i.test(u.hash)) out.push('url_token_param')
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home.arpa') || ipv4Private(host) || host === '::1' || /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host) || host === '::') out.push('private_network_url')
  if (host === 'docs.google.com' && /\/(?:document|spreadsheets|presentation|forms|drawings)\/(?:u\/\d+\/)?d\/[^/]+\/(?:edit|copy|preview|htmlview|export)/i.test(u.pathname)) out.push('private_doc_link')
  if (host === 'docs.google.com' && /\/forms\/(?:u\/\d+\/)?d\/(?!e\/)[^/]+\/edit/i.test(u.pathname)) { if (!out.includes('private_doc_link')) out.push('private_doc_link') }
  if (host === 'drive.google.com' && /\/(?:file|drive|open|folders|uc)\b/i.test(u.pathname + u.search)) out.push('private_doc_link')
  if (/(?:^|\.)(?:dropbox\.com|dropboxusercontent\.com|box\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|notion\.site|notion\.so)$/.test(host) && /(?:\/s\/|\/scl\/|\/personal\/|\/:[a-z]:\/|[?&](?:rlkey|e|share|authkey)=)/i.test(u.pathname + u.search)) out.push('private_doc_link')
  return [...new Set(out)]
}

/** Find secrets, tokens and private links in free text. */
export function detectSecrets(text        )                  {
  const out                  = []
  const src = String(text ?? '')
  for (const [kind, re] of SECRET_PATTERNS) {
    for (const m of src.matchAll(re)) out.push({ kind, index: m.index ?? 0, length: m[0].length, preview: redact(m[0]) })
  }
  for (const m of src.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?]+$/, '')
    for (const kind of urlSensitivity(url)) out.push({ kind, index: m.index ?? 0, length: url.length, preview: redact(url) })
  }
  return out.sort((a, b) => a.index - b.index)
}

// ─── PII detection ────────────────────────────────────────────────────────────

                                                                                                                
                                                                                             

const PII_PATTERNS                           = [
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  ['phone', /(?<![\w\/.-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)\s?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}(?![\w\/-])/g],
  ['phone', /(?<![\w\/.-])\+\d{7,14}(?!\w)/g],
  ['street_address', /\b\d{1,6}\s+(?:[A-Z][A-Za-z'.-]*\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Square|Sq)\b\.?(?:,?\s+(?:Apt|Suite|Ste|Unit|#)\s*[\w-]+)?/g],
  ['street_address', /\bP\.?\s?O\.?\s+Box\s+\d+\b/gi],
  ['government_id', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['date_of_birth', /\b(?:date of birth|dob|born on)\s*[:\-]?\s*\S+/gi],
  ['personal_name', /\b(?:my name is|i am|i'm|this is|signed|sincerely|regards|best|cheers|thanks)[,:]?\s+([A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,2})\b/g],
  ['personal_name', /\b(?:name|full name|first name|last name|founder|ceo|applicant)\s*[:\-]\s*([A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,2})\b/g],
]

export function detectPII(text        )               {
  const out               = []
  const src = String(text ?? '')
  for (const [kind, re] of PII_PATTERNS) {
    for (const m of src.matchAll(re)) {
      if (kind === 'personal_name' && /^(?:excited|happy|writing|applying|interested|looking|building|working|the|a|an|here|currently|not|so|very|from|our|we|tell|describe|what|why|how|who|list|please|enter|provide|share|required|optional|yes|no|n)$/i.test(m[1].split(/[ -]/)[0])) continue
      if (out.some((f) => f.index === (m.index ?? 0) && f.kind === kind)) continue
      out.push({ kind, index: m.index ?? 0, length: m[0].length, preview: redact(m[0]) })
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

// ─── classification ───────────────────────────────────────────────────────────

                                                         
                                                        

                                
                        
                                                     
               
                    
                     
                         
 

                                 
                                                                                                    
              
                                                          
                           
               
                        
                   
 

                                 
                     
                  
                    
                        
                                                                                                                                                                      
                    
                    
 

                                 
           
                                                                                                  
                             
                               
                                                                                                   
   
                           
                             
                                                                         
                         
                       
 

const FIRST_PERSON_RE = /\b(?:I|I'm|I've|I'd|I'll|me|my|mine|myself)\b/
const ANSWERISH_RE = /\b(?:we (?:are|have|built|launched|raised|grew|help)|our (?:company|startup|team|product|customers|revenue)|our mission)\b/i

function sensitiveReasons(text        )           {
  const reasons           = []
  const s = detectSecrets(text)
  if (s.length) reasons.push(...[...new Set(s.map((f) => `secret:${f.kind}`))])
  const p = detectPII(text)
  if (p.length) reasons.push(...[...new Set(p.map((f) => `pii:${f.kind}`))])
  return reasons
}

/** Remove token/credential query params and fragments from a public source reference. Returns null if the URL itself is private. */
export function sanitizeSourceUrl(raw        )                {
  let u     
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const sens = urlSensitivity(raw).filter((k) => k !== 'url_token_param')
  if (sens.length) return null
  u.username = ''; u.password = ''; u.hash = ''
  for (const k of [...u.searchParams.keys()]) if (TOKEN_PARAM_RE.test(k) || /^utm_/i.test(k)) u.searchParams.delete(k)
  return u.toString()
}

/** Split an extraction into potentially-public / private / uncertain. Uncertain stays private. */
export function classifyExtraction(extraction                  , source                = { provenance: 'local_import' })                 {
  const items                   = []
  const reuse        = source.reuse ?? (source.provenance === 'public_source' ? 'unknown' : 'unknown')
  // provenance gate: only a public source whose reuse is not disallowed can yield public items
  const provenanceBlock           = []
  if (source.provenance !== 'public_source') provenanceBlock.push('provenance not established (local import)')
  if (reuse === 'disallowed') provenanceBlock.push('source disallows reuse (robots/noindex/noai)')

  const decide = (kind        , value        , extraReasons           = [], occurrence_index         , forcePrivate = false)                 => {
    const sens = sensitiveReasons(value)
    let visibility             = 'public'
    const reasons = [...extraReasons]
    if (forcePrivate) visibility = 'private'
    if (sens.length) { visibility = 'private'; reasons.push(...sens) }
    if (visibility === 'public' && reasons.some((r) => r.startsWith('uncertain:'))) visibility = 'uncertain'
    if (visibility === 'public' && provenanceBlock.length) { visibility = 'uncertain'; reasons.push(...provenanceBlock.map((r) => `uncertain:${r}`)) }
    const item                 = { kind, value, visibility, reasons }
    if (occurrence_index !== undefined) item.occurrence_index = occurrence_index
    items.push(item)
    return item
  }

  const pub                           = { program: { apply_urls: [] }, deadlines: [], questions: [], source_refs: [] }
  const prog = extraction.program ?? { deadlines: [], apply_urls: [] }

  if (prog.title) { const it = decide('program.title', prog.title); if (it.visibility === 'public') pub.program.title = prog.title }
  if (prog.organization) { const it = decide('program.organization', prog.organization); if (it.visibility === 'public') pub.program.organization = prog.organization }
  if (prog.description) {
    const fp = FIRST_PERSON_RE.test(prog.description) ? ['uncertain:first-person description'] : []
    const it = decide('program.description', prog.description, fp)
    if (it.visibility === 'public') pub.program.description = prog.description
  }
  for (const d of prog.deadlines ?? []) {
    const it = decide('deadline', d.text)
    if (it.visibility === 'public') pub.deadlines.push(d)
  }
  for (const url of prog.apply_urls ?? []) {
    const sens = urlSensitivity(url)
    const it = decide('apply_url', url, sens.map((k) => `secret:${k}`), undefined, sens.length > 0)
    if (it.visibility === 'public') pub.program.apply_urls.push(url)
  }

  extraction.occurrences.forEach((occ                     , i        ) => {
    const extra           = []
    if (occ.asked_as.length > 500) extra.push('uncertain:prompt unusually long — may contain answer text')
    if (FIRST_PERSON_RE.test(occ.asked_as)) extra.push('uncertain:first-person wording — may be answer text')
    if (ANSWERISH_RE.test(occ.asked_as) && !/\?\s*\**\s*$/.test(occ.asked_as)) extra.push('uncertain:reads like an answer, not a prompt')
    const it = decide('question', occ.asked_as, extra, i)
    if (occ.section) {
      const s = decide('section', occ.section, [], i)
      if (s.visibility !== 'public' && it.visibility === 'public') { it.visibility = 'uncertain'; it.reasons.push('uncertain:section label not shareable') }
    }
    let description                    
    if (occ.description) {
      const fp = FIRST_PERSON_RE.test(occ.description) ? ['uncertain:first-person helper text'] : []
      const d = decide('description', occ.description, fp, i)
      if (d.visibility === 'public') description = occ.description
    }
    if (occ.following_text) decide('following_text', occ.following_text, ['answer-like prose following the question'], i, true)
    if (occ.filled_value) decide('filled_value', occ.filled_value, ['value already filled in'], i, true)
    void description
    if (it.visibility === 'public') {
      const n = normalizeQuestion(occ.asked_as)
      const r = occ.requirements
      const q                 = {
        order_index: occ.order_index,
        asked_as: occ.asked_as,
        normalized: n.normalized,
        section: occ.section && items.find((x) => x.kind === 'section' && x.occurrence_index === i)?.visibility === 'public' ? occ.section : null,
        requirements: {
          word_limit: r.word_limit, word_min: r.word_min, char_limit: r.char_limit, char_min: r.char_min,
          sentence_limit: r.sentence_limit, required: r.required, optional: r.optional,
          time_context: [...r.time_context], qualifiers: [...r.qualifiers],
        },
        field_kind: occ.field.kind,
      }
      if (occ.field.options?.length && occ.field.kind !== 'text') {
        const safe = occ.field.options.filter((o) => sensitiveReasons(o).length === 0)
        if (safe.length) q.options = safe
      }
      pub.questions.push(q)
    }
  })

  if (source.final_url) {
    const clean = sanitizeSourceUrl(source.final_url)
    const it = decide('source_ref', clean ?? source.final_url, clean ? [] : ['secret:private source url'], undefined, !clean)
    if (it.visibility === 'public' && clean) pub.source_refs.push({ url: clean, fetched_at: source.fetched_at, content_sha256: source.content_sha256, reuse })
  }

  return {
    public: pub,
    private: items.filter((x) => x.visibility === 'private'),
    uncertain: items.filter((x) => x.visibility === 'uncertain'),
    items,
    source: { ...source, reuse },
  }
}

// ─── public candidate ─────────────────────────────────────────────────────────

                                  
                                       
            
                                                                                                                
                     
                               
                                                                                                
                           
                             
                                                                                                 
                              
 

export class PublicCandidateLeakError extends Error {
           reasons          
  constructor(reasons          ) {
    super(`public candidate refused: ${reasons.join('; ')}`)
    this.name = 'PublicCandidateLeakError'
    this.reasons = reasons
  }
}

function strings(v         , out           = [])           {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

/**
 * Build a catalog candidate from ONLY the potentially-public fields.
 * Throws PublicCandidateLeakError if any string in the result carries a
 * secret / PII marker, or overlaps a private or uncertain item.
 */
export function buildPublicCandidate(classification                )                  {
  const p = classification.public
  const reuse = classification.source.reuse ?? 'unknown'
  const notes           = []
  if (reuse === 'unknown') notes.push('reuse permission unknown — verify the source terms before approval')
  if (classification.uncertain.length) notes.push(`${classification.uncertain.length} uncertain item(s) withheld (kept private)`)
  if (classification.private.length) notes.push(`${classification.private.length} private item(s) excluded`)
  if (p.deadlines.some((d) => d.ambiguous)) notes.push('a deadline date format is ambiguous — verify against the source')
  if (p.deadlines.some((d) => d.date && !d.timezone)) notes.push('a deadline has no time zone — verify against the source')

  const candidate                  = {
    kind: 'aqua.public_catalog_candidate',
    version: 1,
    status: 'candidate',
    requires_human_approval: true,
    program: {
      ...(p.program.title ? { title: p.program.title } : {}),
      ...(p.program.organization ? { organization: p.program.organization } : {}),
      ...(p.program.description ? { description: p.program.description } : {}),
      apply_urls: [...p.program.apply_urls],
    },
    deadlines: p.deadlines.map((d) => ({ ...d })),
    questions: p.questions.map((q) => ({ ...q, requirements: { ...q.requirements, time_context: [...q.requirements.time_context], qualifiers: [...q.requirements.qualifiers] }, ...(q.options ? { options: [...q.options] } : {}) })),
    source_refs: p.source_refs.map((s) => ({ ...s })),
    verification_notes: notes,
  }

  // ── leak gate ──
  const reasons           = []
  if (classification.source.provenance !== 'public_source') reasons.push('source provenance is not a public source')
  if (reuse === 'disallowed') reasons.push('source disallows reuse')
  const all = strings({ ...candidate, verification_notes: [] })
  for (const s of all) {
    for (const r of sensitiveReasons(s)) if (!reasons.includes(r)) reasons.push(r)
  }
  const withheld = [...classification.private, ...classification.uncertain]
  const foldedAll = all.map(foldText)
  for (const item of withheld) {
    const f = foldText(item.value)
    if (f.length < 8) continue
    if (foldedAll.some((s) => s === f || (f.length >= 24 && s.includes(f)) || (s.length >= 24 && f.includes(s) && s.length / f.length > 0.6))) {
      const r = `withheld ${item.visibility} ${item.kind} would leak`
      if (!reasons.includes(r)) reasons.push(r)
    }
  }
  if (reasons.length) throw new PublicCandidateLeakError(reasons)
  return candidate
}
