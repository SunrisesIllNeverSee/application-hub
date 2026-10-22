// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/extract.ts
// source-sha256: d0b58c7e9163318ade0ae7f62aca7a811fbcf9777c25ff8510b0109e13fc2baf
// body-sha256: cf4c83f283d1775b34190b935fafce9057bbc19ded671bcce2a8fb11c5265956
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — deterministic application-question extraction. PURE module.
//
// Extracts question OCCURRENCES (exact wording, order, section, limits)
// from plain text / Markdown, HTML forms, and structured records (CSV/JSON
// rows from files.ts), plus program identity hints (title, organization,
// deadlines with time zone, apply URLs).
//
// Text after a question (answer-like prose) and values already filled into
// a form are captured separately as `following_text` / `filled_value` so
// classify.ts can keep them PRIVATE. Nothing here decides publication.
//
// Line grammar for text reuses lib/intake-extract-shared.ts
// (classifyQALine), the same rules as the deterministic Q/A importer.

import { classifyQALine } from '../intake-extract-shared.mjs'
import { parseRequirements,                   } from './normalize.mjs'
import { parseHtml, textOf, htmlToText, findAll, isElement, BLOCK,                           } from './html.mjs'

                                                                    
                                                                                                          

                                 
                 
               
             
                     
                    
                         
                    
 

                                      
                     
                                                                                  
                  
                        
                            
                       
                                                                                  
                      
                                                             
                         
                                                               
                       
                                                                   
                        
 

                               
              
                                  
               
                                 
               
                                              
                   
                                                                 
                     
 

                               
                
                       
                      
                           
                      
 

                                   
                       
                                    
                       
                    
 

                                 
                  
                         
                            
                            
                           
                                                          
                        
 

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Whitespace-only cleanup: wording (quotes, dashes, case) is preserved exactly. */
function ws(s        )         {
  return String(s ?? '').normalize('NFC').replace(/[\s\u00a0\u200b\ufeff]+/g, ' ').trim()
}

const PROMPT_START_RE = /^(?:what|why|how|who|whom|whose|when|where|which|describe|tell|explain|list|share|provide|outline|summari[sz]e|discuss|give|please|briefly|upload|attach|include|walk us|in (?:one|a|\d+)|is|are|do|does|did|have|has|can|will|would|should|if you|name|enter|select|choose)\b/i
const HINT_KEY_RE = /^(?:application\s+)?(?:deadline|due(?:\s+date)?|closes?|closing(?:\s+date)?|apply\s+by|submit\s+by|submission\s+deadline|applications?\s+(?:close|due|deadline)|last\s+day(?:\s+to\s+apply)?|program|program\s+name|organi[sz]ation|organi[sz]er|hosted\s+by|website|apply\s+(?:at|here|url|link)|application\s+(?:url|link|form)|cycle|batch|cohort)\b/i
const DEADLINE_KW_RE = /\b(?:deadline|due|closes?|closing|apply\s+by|submit(?:ted)?\s+by|applications?\s+(?:are\s+)?(?:open|close|due)|last\s+day|until)\b/i
const APPLY_URL_HINT_RE = /apply|application|applications|submit|form|typeform|airtable\.com|forms\.gle|docs\.google\.com\/forms|jotform|tally\.so|fillout|paperform|smapply|submittable|f6s\.com/i
const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi

function promptScore(t        )         {
  const s = t.trim()
  if (!s) return 0
  let score = 0
  if (/\?\s*(?:\*|\(?(?:required|optional)\)?)?\s*$/i.test(s) || /\?\s*[(\[][^)\]]*[)\]]\s*\*?\s*$/.test(s)) score += 3
  if (PROMPT_START_RE.test(s)) score += 2
  const req = parseRequirements(s)
  if (req.word_limit || req.char_limit || req.sentence_limit) score += 2
  if (s.length > 400) score -= 3
  if (s.split(/\s+/).length <= 10 && s.length <= 90) score += 1
  return score
}

function mergeRequirements(base              , extra               )               {
  if (!extra) return base
  const out               = { ...base, time_context: [...base.time_context], qualifiers: [...base.qualifiers], limit_clauses: [...base.limit_clauses] }
  for (const k of ['word_limit', 'word_min', 'char_limit', 'char_min', 'sentence_limit']         ) {
    if (out[k] === undefined && extra[k] !== undefined) out[k] = extra[k]
  }
  if (out.required === undefined && extra.required !== undefined) out.required = extra.required
  if (out.optional === undefined && extra.optional !== undefined) out.optional = extra.optional
  for (const c of extra.limit_clauses) if (!out.limit_clauses.includes(c)) out.limit_clauses.push(c)
  for (const t of extra.time_context) if (!out.time_context.includes(t)) out.time_context.push(t)
  return out
}

const MONTHS                         = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const TZ_RE = /\b(?:(?:UTC|GMT)\s*[+-]\s*\d{1,2}(?::?\d{2})?|UTC|GMT|PT|PST|PDT|ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|BST|CET|CEST|EET|EEST|IST|JST|KST|SGT|AEST|AEDT|AoE|Anywhere on Earth|Pacific(?:\s+Time)?|Eastern(?:\s+Time)?|Central(?:\s+Time)?|Mountain(?:\s+Time)?)\b|(?<=\d)\s*[+-]\d{2}:\d{2}\b|(?<=\d)Z\b/i

const pad = (n        ) => String(n).padStart(2, '0')

/** Parse one deadline-like phrase. Exported for tests and other workstreams. */
export function parseDeadline(text        )                      {
  const t = ws(text)
  let date                    
  let ambiguous = false
  let m                         
  let dateEnd = -1
  if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/))) {
    date = `${m[1]}-${m[2]}-${m[3]}`
    dateEnd = (m.index ?? 0) + m[0].length
    if (m[4]) return finish(t, date, `${m[4]}:${m[5]}`, false, dateEnd)
  } else if ((m = t.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'i')))) {
    date = `${m[3]}-${pad(MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)] ?? MONTHS[m[1].toLowerCase()])}-${pad(+m[2])}`
    dateEnd = (m.index ?? 0) + m[0].length
  } else if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`, 'i')))) {
    const mon = MONTHS[m[2].toLowerCase()] ?? MONTHS[m[2].toLowerCase().slice(0, 3)]
    date = `${m[3]}-${pad(mon)}-${pad(+m[1])}`
    dateEnd = (m.index ?? 0) + m[0].length
  } else if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/))) {
    const a = +m[1]; const b = +m[2]
    ambiguous = a <= 12 && b <= 12 && a !== b
    // US month/day unless the first part cannot be a month
    date = a > 12 ? `${m[3]}-${pad(b)}-${pad(a)}` : `${m[3]}-${pad(a)}-${pad(b)}`
    dateEnd = (m.index ?? 0) + m[0].length
  }
  if (!date) return null
  return finish(t, date, undefined, ambiguous, dateEnd)
}

function finish(t        , date        , time                    , ambiguous         , dateEnd        )               {
  const after = t.slice(Math.max(0, dateEnd))
  const scan = after.length ? after : t
  let tm = time
  if (!tm) {
    const m12 = scan.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i) ?? t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i)
    const m24 = scan.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
    if (m12) {
      let h = +m12[1] % 12
      if (/p/i.test(m12[3])) h += 12
      tm = `${pad(h)}:${m12[2] ?? '00'}`
    } else if (m24) tm = `${pad(+m24[1])}:${m24[2]}`
    else if (/\bmidnight\b/i.test(t)) tm = '23:59'
    else if (/\bnoon\b/i.test(t)) tm = '12:00'
  }
  const tz = scan.match(TZ_RE) ?? t.match(TZ_RE)
  const out               = { text: t.slice(0, 200), date }
  if (tm) out.time = tm
  if (tz) out.timezone = tz[0].trim()
  if (ambiguous) out.ambiguous = true
  return out
}

function collectDeadlines(lines          )                 {
  const out                 = []
  for (const line of lines) {
    if (!DEADLINE_KW_RE.test(line)) continue
    const d = parseDeadline(line)
    if (d && !out.some((x) => x.date === d.date && x.time === d.time)) out.push(d)
  }
  return out
}

function collectApplyUrls(text        , base         )           {
  const out           = []
  for (const m of text.matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;:!?]+$/, '')
    if (APPLY_URL_HINT_RE.test(u)) pushUrl(out, u, base)
  }
  return out
}

function pushUrl(out          , raw        , base         ) {
  try {
    const u = new URL(raw, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return
    u.hash = ''
    const s = u.toString()
    if (!out.includes(s)) out.push(s)
  } catch { /* ignore unparseable */ }
}

function blankRequirements()               { return { time_context: [], qualifiers: [], limit_clauses: [] } }

// ─── plain text / markdown ────────────────────────────────────────────────────

/** Extract occurrences from plain text or Markdown. */
export function extractFromText(text        , opts                                   = {})                   {
  const src = (text ?? '').replace(/\r\n?/g, '\n')
  const lines = src.split('\n')
  const isMd = opts.format === 'markdown' || (opts.format === undefined && /^\s{0,3}#{1,6}\s+\S/m.test(src))
  const occurrences                        = []
  const warnings           = []
  const program               = { deadlines: [], apply_urls: [] }
  let section                = null
  let current                             = null
  let follow           = []
  let answerMode = false
  const preamble           = []

  const closeCurrent = () => {
    if (current) {
      const ft = follow.join('\n').replace(/\n{3,}/g, '\n\n').trim()
      if (ft) current.following_text = ft
    }
    current = null
    follow = []
    answerMode = false
  }
  const open = (asked        , lineNo        , kind           , filled         ) => {
    closeCurrent()
    const askedClean = ws(asked.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^__(.+)__$/, '$1'))
    const occ                      = {
      order_index: occurrences.length,
      asked_as: askedClean,
      section,
      requirements: parseRequirements(askedClean),
      field: { kind },
      source_locator: `line ${lineNo}`,
    }
    if (filled) occ.filled_value = filled
    occurrences.push(occ)
    current = filled ? null : occ
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    const lineNo = i + 1
    if (!line) { if (answerMode) follow.push(''); continue }

    const h = isMd ? line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/) : null
    if (h) {
      const htext = ws(h[2].replace(/^\*\*(.+)\*\*$/, '$1'))
      if (/\?\s*\**\s*$/.test(htext) || (promptScore(htext) >= 4)) { open(htext, lineNo, 'text'); continue }
      closeCurrent()
      if (h[1].length === 1 && !program.title) program.title = htext
      else section = htext
      if (h[1].length === 1 && program.title === htext) section = null
      continue
    }
    const sec = line.match(/^(?:section|part|step)\s+(?:\d+|[ivx]+|[a-z])\s*[:.\-–—]\s*(.+)$/i)
    if (sec && !line.endsWith('?')) { closeCurrent(); section = ws(sec[1]); continue }

    const cls = classifyQALine(line)
    if (cls.kind === 'answer_label') {
      if (current) { answerMode = true; if (cls.text) follow.push(cls.text) }
      continue
    }
    if (cls.kind === 'question' && (!answerMode || cls.explicit_marker)) {
      if (cls.text.length >= 3) { open(cls.text, lineNo, 'text'); continue }
    }

    // "Label: value" and "Label:" field lines
    const kv = line.match(/^([A-Z][^:]{1,60}?)\s*(\*)?\s*:\s*(.*)$/)
    if (kv && !answerMode && kv[1].split(/\s+/).length <= 8 && !/https?$/i.test(kv[1])) {
      const label = kv[1].trim() + (kv[2] ? ' *' : '')
      const value = kv[3].trim()
      if (HINT_KEY_RE.test(kv[1].trim())) {
        closeCurrent()
        preamble.push(line)
        if (/^(?:program(?:\s+name)?)$/i.test(kv[1].trim()) && value && !program.title) program.title = value
        if (/^(?:organi[sz]ation|organi[sz]er|hosted\s+by)$/i.test(kv[1].trim()) && value) program.organization = value
        continue
      }
      if (!value) { open(label, lineNo, 'label'); continue }
      if (!/[.!?]$/.test(kv[1]) && value.length <= 300) { open(label, lineNo, 'label', value); continue }
    }

    // explicitly marked or limit-bearing imperative prompt
    const stripped = line.replace(/^(?:\d{1,3}[.)]|[-*•])\s+/, '')
    const score = promptScore(stripped)
    const marked = stripped !== line
    if ((!answerMode && score >= 4) || (marked && score >= 4) || (marked && score >= 3 && !answerMode) || (marked && /\?\s*$/.test(stripped))) {
      open(stripped, lineNo, 'text')
      continue
    }

    if (current) { answerMode = true; follow.push(line); continue }
    preamble.push(line)
    if (occurrences.length === 0 && !program.title && line.length <= 120 && !DEADLINE_KW_RE.test(line) && !isMd && /^[A-Z0-9]/.test(line) && !/[.?!:]$/.test(line)) {
      program.title = ws(line)
    }
  }
  closeCurrent()

  program.deadlines = collectDeadlines([...preamble, ...lines.filter((l) => DEADLINE_KW_RE.test(l))])
  program.apply_urls = collectApplyUrls(src)
  if (occurrences.length === 0) warnings.push('no question occurrences detected')
  return { format: isMd ? 'markdown' : 'text', occurrences, program, warnings }
}

// ─── HTML forms ───────────────────────────────────────────────────────────────

                
                                                                  
                                                       
                                     
                                                              
                                               

const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search'])
const CONTROL_TAGS = new Set(['input', 'textarea', 'select'])

function isControl(el          )          {
  if (!CONTROL_TAGS.has(el.tag)) return el.attrs.role === 'textbox' || el.attrs.contenteditable === 'true'
  if (el.tag === 'input') return !SKIP_INPUT_TYPES.has((el.attrs.type ?? 'text').toLowerCase())
  return true
}

function containsControl(el          )                  {
  let found                  = null
  const rec = (n          ) => { for (const c of n.children) { if (found) return; if (isElement(c)) { if (isControl(c)) { found = c; return } rec(c) } } }
  rec(el)
  return found
}

/** Extract occurrences + program hints from an HTML page or form. */
export function extractFromHtml(html        , opts                       = {})                   {
  const root = parseHtml(html ?? '')
  const warnings           = []
  const byId = new Map                  ()
  const labelFor = new Map                  ()
  walk(root, (el) => {
    if (el.attrs.id && !byId.has(el.attrs.id)) byId.set(el.attrs.id, el)
    if (el.tag === 'label' && el.attrs.for) labelFor.set(el.attrs.for, el)
  })
  const labelNodes = new Set          ()
  for (const [id, lab] of labelFor) if (byId.has(id) && isControl(byId.get(id) )) labelNodes.add(lab)
  walk(root, (el) => {
    if (!isControl(el)) return
    for (const id of (el.attrs['aria-labelledby'] ?? '').split(/\s+/).filter(Boolean)) { const t = byId.get(id); if (t) labelNodes.add(t) }
    for (const id of (el.attrs['aria-describedby'] ?? '').split(/\s+/).filter(Boolean)) { const t = byId.get(id); if (t) labelNodes.add(t) }
  })
  // radiogroup labelledby targets are prompts for the group
  walk(root, (el) => {
    if (el.attrs.role === 'radiogroup' || el.attrs.role === 'group') {
      for (const id of (el.attrs['aria-labelledby'] ?? '').split(/\s+/).filter(Boolean)) { const t = byId.get(id); if (t) labelNodes.add(t) }
    }
  })

  // ── linearize ──
  const events              = []
  let buf = ''
  let bufEl                  = null
  const flush = () => { const t = ws(buf); if (t) events.push({ type: 'text', text: t, el: bufEl }); buf = ''; bufEl = null }
  const rec = (n       , parent          ) => {
    if (!isElement(n)) { if (!buf.trim()) bufEl = parent; buf += n; return }
    const el = n
    if (el.tag === 'head') { return }
    if (el.attrs.hidden !== undefined || el.attrs['aria-hidden'] === 'true' && !/^\s*\*\s*$/.test(textOf(el))) { return }
    if (labelNodes.has(el) || (el.tag === 'label' && containsControl(el) && !el.attrs.for)) {
      // label text belongs to its control; still descend to find wrapped controls
      flush()
      const ctl = el.tag === 'label' ? containsControl(el) : null
      if (ctl) events.push({ type: 'control', el: ctl })
      return
    }
    if (/^h[1-6]$/.test(el.tag)) { flush(); events.push({ type: 'heading', level: +el.tag[1], text: textOf(el), el }); return }
    if (el.attrs.role === 'heading') { flush(); events.push({ type: 'text', text: textOf(el), el }); return }
    if (el.tag === 'fieldset') {
      flush()
      const legend = el.children.find((c)                => isElement(c) && c.tag === 'legend')
      if (legend) events.push({ type: 'section_push', text: textOf(legend), fieldset: el })
      for (const c of el.children) { if (c !== legend) rec(c, el) }
      flush()
      if (legend) events.push({ type: 'section_pop', fieldset: el })
      return
    }
    if (isControl(el)) { flush(); events.push({ type: 'control', el }); return }
    if (el.tag === 'option' || el.tag === 'button') return
    if (el.tag === 'br') { flush(); return }
    const block = BLOCK.has(el.tag)
    if (block) flush()
    for (const c of el.children) rec(c, el)
    if (block) flush()
  }
  for (const c of root.children) rec(c, root)
  flush()

  // ── interpret ──
  const program               = { deadlines: [], apply_urls: [] }
  const occurrences                        = []
  let section                = null
  const sectionStack                       = []
  let pending                                               = []
  let lastStandalone                                                        = null
  const groups = new Map                             ()
  const promptFieldsets = new Map                  () // fieldset → legend used as a group prompt

  const fieldsetIsSingleGroup = (fs          )          => {
    const ctls = findAll(fs, isControl)
    if (ctls.length === 0) return false
    const names = new Set(ctls.map((c) => c.attrs.name ?? c.attrs.id ?? Math.random().toString()))
    return names.size === 1
  }

  const closeStandalone = () => {
    if (lastStandalone) {
      const ft = lastStandalone.follow.join('\n').trim()
      if (ft) lastStandalone.occ.following_text = ft
    }
    lastStandalone = null
  }
  const pushOcc = (asked        , field                , locator        , extraReq               , description         , filled         ) => {
    const askedClean = ws(asked)
    let req = parseRequirements(askedClean)
    if (description) req = mergeRequirements(req, parseRequirements(description))
    if (extraReq) req = mergeRequirements(req, extraReq)
    if (field.maxlength && req.char_limit === undefined) req.char_limit = field.maxlength
    if (field.required_attr && req.required === undefined) req.required = true
    const occ                      = { order_index: occurrences.length, asked_as: askedClean, section, requirements: req, field, source_locator: locator }
    if (description) occ.description = description
    if (filled) occ.filled_value = filled
    occurrences.push(occ)
    return occ
  }
  const flushPendingAsStandalone = () => {
    for (const p of pending) {
      if (promptScore(p.text) >= 3) {
        closeStandalone()
        const occ = pushOcc(p.text, { kind: 'text' }, 'html:text')
        lastStandalone = { occ, follow: [] }
      } else if (lastStandalone && p.text.length >= 1) {
        lastStandalone.follow.push(p.text)
      }
    }
    pending = []
  }

  const labelText = (el          )         => {
    const skip = (n          ) => isControl(n) || n.tag === 'select' || n.tag === 'option'
    if (el.attrs['aria-label']) return ws(el.attrs['aria-label'])
    const lb = (el.attrs['aria-labelledby'] ?? '').split(/\s+/).filter(Boolean).map((id) => byId.get(id)).filter(Boolean)              
    if (lb.length) return ws(lb.map((n) => textOf(n, skip)).join(' '))
    if (el.attrs.id && labelFor.has(el.attrs.id)) return textOf(labelFor.get(el.attrs.id) , skip)
    for (let p = el.parent; p; p = p.parent) if (p.tag === 'label') return textOf(p, skip)
    return ''
  }
  const describedBy = (el          )                     => {
    const ids = (el.attrs['aria-describedby'] ?? '').split(/\s+/).filter(Boolean)
    const t = ids.map((id) => byId.get(id)).filter(Boolean).map((n) => textOf(n )).join(' ').trim()
    return t || undefined
  }
  const groupPrompt = (el          )         => {
    for (let p = el.parent; p; p = p.parent) {
      if ((p.attrs.role === 'radiogroup' || p.attrs.role === 'group') && (p.attrs['aria-labelledby'] || p.attrs['aria-label'])) {
        if (p.attrs['aria-label']) return ws(p.attrs['aria-label'])
        return ws(p.attrs['aria-labelledby'].split(/\s+/).map((id) => byId.get(id)).filter(Boolean).map((n) => textOf(n )).join(' '))
      }
      if (p.tag === 'fieldset' && promptFieldsets.has(p)) return promptFieldsets.get(p) 
    }
    return ''
  }

  for (const ev of events) {
    if (ev.type === 'heading') {
      flushPendingAsStandalone()
      if (/\?\s*\**\s*$/.test(ev.text)) { pending.push({ text: ev.text, el: ev.el }); continue }
      closeStandalone()
      if (ev.level === 1 && !program.title) program.title = ev.text
      section = ev.level === 1 && program.title === ev.text ? section : ev.text
      continue
    }
    if (ev.type === 'section_push') {
      flushPendingAsStandalone(); closeStandalone()
      sectionStack.push(section)
      if (fieldsetIsSingleGroup(ev.fieldset)) promptFieldsets.set(ev.fieldset, ev.text)
      else section = ev.text
      continue
    }
    if (ev.type === 'section_pop') { flushPendingAsStandalone(); closeStandalone(); section = sectionStack.pop() ?? null; continue }
    if (ev.type === 'text') { pending.push({ text: ev.text, el: ev.el }); continue }

    // control
    const el = ev.el
    const tag = el.tag
    const type = (el.attrs.type ?? (tag === 'input' ? 'text' : '')).toLowerCase()
    const kind            = tag === 'textarea' || el.attrs.role === 'textbox' ? 'textarea'
      : tag === 'select' ? 'select'
        : type === 'radio' ? 'radio' : type === 'checkbox' ? 'checkbox' : type === 'file' ? 'file' : 'input'
    const name = el.attrs.name
    const own = labelText(el)

    if ((kind === 'radio' || kind === 'checkbox') && name) {
      const existing = groups.get(name)
      const gp = groupPrompt(el)
      if (existing) {
        if (own) existing.field.options = [...(existing.field.options ?? []), own]
        if (el.attrs.checked !== undefined) existing.filled_value = [existing.filled_value, own || el.attrs.value].filter(Boolean).join('; ')
        continue
      }
      let prompt = gp
      if (!prompt) {
        const best = choosePrompt(pending)
        if (best) { prompt = best.text; consumePending(best.idx) }
      }
      if (!prompt) {
        // a lone checkbox ("I agree …") is its own prompt
        if (own) prompt = own
        else { warnings.push(`unlabelled ${kind} group "${name}" skipped`); continue }
      }
      closeStandalone()
      const occ = pushOcc(prompt, { kind, name, required_attr: el.attrs.required !== undefined || el.attrs['aria-required'] === 'true', options: own && prompt !== own ? [own] : [] }, `html:${kind}[name=${name}]`, undefined, describedBy(el))
      if (el.attrs.checked !== undefined) occ.filled_value = own || el.attrs.value
      groups.set(name, occ)
      continue
    }

    let prompt = own
    let description = describedBy(el)
    if (!prompt) {
      const best = choosePrompt(pending)
      if (best) {
        prompt = best.text
        const after = pending.slice(best.idx + 1).map((p) => p.text).join(' ').trim()
        if (after && !description) description = after
        consumePending(best.idx, true)
      }
    } else {
      // helper text between label and control, if any (last low-score block)
      const low = pending.filter((p) => promptScore(p.text) < 3)
      const after = low.length ? low[low.length - 1].text : ''
      pending = pending.filter((p) => promptScore(p.text) >= 3)
      flushPendingAsStandalone()
      if (after && !description && after.length <= 300) description = after
    }
    if (!prompt) prompt = ws(el.attrs.placeholder ?? el.attrs.title ?? '')
    if (!prompt) { warnings.push(`unlabelled ${kind}${name ? ` "${name}"` : ''} skipped`); continue }
    closeStandalone()
    const maxlength = el.attrs.maxlength && /^\d+$/.test(el.attrs.maxlength) ? +el.attrs.maxlength : undefined
    const field                 = { kind, input_type: tag === 'input' ? type : undefined, required_attr: el.attrs.required !== undefined || el.attrs['aria-required'] === 'true' }
    if (name) field.name = name
    if (el.attrs.id) field.id = el.attrs.id
    if (maxlength) field.maxlength = maxlength
    let filled                    
    if (tag === 'textarea') filled = ws(textOf(el)) || undefined
    else if (tag === 'select') {
      const opts = findAll(el, (o) => o.tag === 'option')
      field.options = opts.map((o) => textOf(o)).filter((t) => t && !/^(?:select|choose|--|please select)/i.test(t))
      const sel = opts.find((o) => o.attrs.selected !== undefined && (o.attrs.value ?? textOf(o)))
      if (sel && !/^(?:select|choose|--)/i.test(textOf(sel))) filled = textOf(sel)
    } else if (kind !== 'file' && el.attrs.value) filled = ws(el.attrs.value)
    const locator = `html:${tag}${el.attrs.id ? `#${el.attrs.id}` : name ? `[name=${name}]` : ''}`
    pushOcc(prompt, field, locator, undefined, description, filled)
  }
  flushPendingAsStandalone()
  closeStandalone()

  function choosePrompt(list                         )                                       {
    let best                                                      = null
    list.forEach((p, idx) => {
      const s = promptScore(p.text)
      if (s <= 0) return
      if (!best || s > best.score) best = { text: p.text, idx, score: s }
    })
    return best
  }
  function consumePending(idx        , dropAfter = false) {
    const before = pending.slice(0, idx)
    const after = pending.slice(idx + 1)
    pending = before
    flushPendingAsStandalone()
    if (!dropAfter) pending = after
  }

  // ── program hints ──
  const metas = findAll(root, (e) => e.tag === 'meta')
  const meta = (key        ) => metas.find((m) => (m.attrs.property ?? m.attrs.name ?? '').toLowerCase() === key)?.attrs.content?.trim()
  const titleEl = findAll(root, (e) => e.tag === 'title')[0]
  const h1 = findAll(root, (e) => e.tag === 'h1')[0]
  program.title = ws(meta('og:title') ?? (titleEl ? textOf(titleEl) : '') ?? '') || (h1 ? textOf(h1) : undefined) || program.title
  if (!program.title) delete program.title
  const org = meta('og:site_name') ?? meta('application-name') ?? meta('author')
  if (org) program.organization = ws(org)
  const desc = meta('description') ?? meta('og:description')
  if (desc) program.description = ws(desc).slice(0, 500)
  const pageText = htmlToText(root)
  const timeHints = findAll(root, (e) => e.tag === 'time' && !!e.attrs.datetime).map((e) => `${textOf(e.parent ?? e)} ${e.attrs.datetime}`)
  program.deadlines = collectDeadlines([...pageText.split('\n'), ...timeHints])
  for (const a of findAll(root, (e) => e.tag === 'a' && !!e.attrs.href)) {
    const label = textOf(a)
    if (APPLY_URL_HINT_RE.test(a.attrs.href) || /\bapply\b|\bapplication\b/i.test(label)) pushUrl(program.apply_urls, a.attrs.href, opts.baseUrl)
  }
  for (const f of findAll(root, (e) => e.tag === 'form' && !!e.attrs.action)) pushUrl(program.apply_urls, f.attrs.action, opts.baseUrl)
  if (occurrences.length === 0) warnings.push('no question occurrences detected')
  return { format: 'html', occurrences, program, warnings }
}

function walk(node          , fn                        ) {
  for (const c of node.children) if (isElement(c)) { fn(c); walk(c, fn) }
}

/** Robots directives declared in the page (<meta name="robots"|"googlebot"|…>). Lower-cased. */
export function readRobotsMeta(html        )           {
  const root = parseHtml(html ?? '')
  const out           = []
  for (const m of findAll(root, (e) => e.tag === 'meta')) {
    const name = (m.attrs.name ?? '').toLowerCase()
    if (!/^(?:robots|googlebot|bingbot|ai|ai-crawler|gptbot|ccbot|claudebot|anthropic-ai)$/.test(name)) continue
    for (const d of (m.attrs.content ?? '').toLowerCase().split(/[,\s]+/)) if (d && !out.includes(d)) out.push(d)
  }
  return out
}

// ─── structured records (CSV / JSON rows) ─────────────────────────────────────

export function extractFromRecords(records                  )                   {
  const occurrences                        = []
  records.forEach((r, i) => {
    const q = ws(String(r.question ?? ''))
    if (!q) return
    let req = parseRequirements(q)
    if (r.word_limit && req.word_limit === undefined) req = { ...req, word_limit: Number(r.word_limit) || undefined }
    if (r.char_limit && req.char_limit === undefined) req = { ...req, char_limit: Number(r.char_limit) || undefined }
    if (typeof r.required === 'boolean' && req.required === undefined) req = { ...req, required: r.required }
    const occ                      = {
      order_index: occurrences.length, asked_as: q, section: r.section ? ws(String(r.section)) : null,
      requirements: req, field: { kind: 'text' }, source_locator: `row ${i + 1}`,
    }
    if (r.answer && String(r.answer).trim()) occ.following_text = String(r.answer).trim()
    occurrences.push(occ)
  })
  return { format: 'records', occurrences, program: { deadlines: [], apply_urls: [] }, warnings: occurrences.length ? [] : ['no question occurrences detected'] }
}

// ─── dispatcher ───────────────────────────────────────────────────────────────

export function detectFormat(content        )                               {
  const head = content.slice(0, 4000)
  if (/<(?:!doctype\s+html|html|body|form|textarea|input|label|div|p)\b/i.test(head)) return 'html'
  if (/^\s{0,3}#{1,6}\s+\S/m.test(content) || /^\s*[-*]\s+\S/m.test(head) && /\*\*[^*]+\*\*/.test(head)) return 'markdown'
  return 'text'
}

export function extractApplication(input                                                                                                          )                   {
  if (input.records && input.records.length) return extractFromRecords(input.records)
  const format = input.format ?? detectFormat(input.content ?? '')
  if (format === 'html') return extractFromHtml(input.content, { baseUrl: input.baseUrl })
  return extractFromText(input.content, { format })
}
