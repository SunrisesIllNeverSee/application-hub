// VENDORED from application-hub-mcp-server/src/vendor/companion/vendor/lib/catalog/html.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/vendor/lib/catalog/html.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/html.ts
// source-sha256: 99a75336db46d81f4ecb735eea73f421135186e72e586f33bfb1fa0642fd5737
// body-sha256: ecb8c8ae7d39bef0be13a200122072105a34578fca5d42944e503343d69b2464
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — minimal, dependency-free HTML tree parser. PURE module.
//
// Purpose-built for application-form extraction: tolerant of malformed
// markup, never executes anything, drops <script>/<style>/<template>
// contents, keeps <textarea>/<title> as raw text. Not a full HTML5 parser.

                           
             
                               
                   
                         
                                                                                
                     
 
                                     

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const DROP_CONTENT = new Set(['script', 'style', 'template', 'noscript', 'svg', 'math', 'iframe', 'object'])
const RAW_TEXT = new Set(['textarea', 'title'])
const SELF_CLOSING_SIBLINGS                           = {
  li: ['li'], option: ['option', 'optgroup'], optgroup: ['optgroup'], dt: ['dt', 'dd'], dd: ['dt', 'dd'],
  tr: ['tr'], td: ['td', 'th'], th: ['td', 'th'], p: ['p'],
}
const P_CLOSERS = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'])

const NAMED_ENTITIES                         = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·',
  le: '≤', ge: '≥', times: '×', laquo: '«', raquo: '»', euro: '€', pound: '£', dollar: '$', colon: ':',
}

export function decodeEntities(s        )         {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (m, body        ) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m
      try { return String.fromCodePoint(code) } catch { return m }
    }
    const v = NAMED_ENTITIES[body.toLowerCase()]
    return v ?? m
  })
}

const ATTR_NAME_END = new Set([' ', '\t', '\n', '\r', '\f', '/', '>', '='])
const isWs = (c        ) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'
const isAsciiAlpha = (c        ) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
const isNameChar = (c        ) => isAsciiAlpha(c) || (c >= '0' && c <= '9') || c === '_' || c === ':' || c === '-'

/**
 * Hard bounds on the work one parse may do. The parser is a single forward
 * scan (every input character is visited a bounded number of times), and
 * these caps bound the size of the tree it hands to downstream walkers.
 * Hitting any cap sets `root.truncated`; the rest of the input is ignored
 * (elements/text) or flattened (depth).
 */
export const HTML_LIMITS = Object.freeze({
  /** Characters of input considered at all. */
  maxInputChars: 3_000_000,
  /** Elements created; parsing stops at the cap. */
  maxElements: 40_000,
  /** Open-element nesting; deeper elements are attached but not entered. */
  maxDepth: 256,
  /** Total characters of text kept across all text nodes. */
  maxTextChars: 1_000_000,
  /** Attributes kept per element. */
  maxAttrs: 64,
})
                                                                    

                                                                                                  

/**
 * Scan a start tag at `i` (src[i] === '<', src[i+1] is an ASCII letter).
 * Never backtracks: attribute syntax is HTML5-tolerant, so the only failure
 * is reaching end of input inside the tag (returns null).
 */
function scanStartTag(src        , i        , maxAttrs        )                  {
  const n = src.length
  let j = i + 1
  while (j < n && isNameChar(src[j])) j++
  const tag = src.slice(i + 1, j).toLowerCase()
  const attrs                         = {}
  let count = 0
  for (;;) {
    while (j < n && isWs(src[j])) j++
    if (j >= n) return null
    const c = src[j]
    if (c === '>') return { tag, attrs, selfClose: false, end: j + 1 }
    if (c === '/') {
      if (src[j + 1] === '>') return { tag, attrs, selfClose: true, end: j + 2 }
      j++
      continue
    }
    const nameStart = j
    j++ // first char may be '=' (HTML5 treats it as part of the name)
    while (j < n && !ATTR_NAME_END.has(src[j])) j++
    const name = src.slice(nameStart, j).toLowerCase()
    let k = j
    while (k < n && isWs(src[k])) k++
    let value = ''
    if (src[k] === '=') {
      k++
      while (k < n && isWs(src[k])) k++
      if (k >= n) return null
      const q = src[k]
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, k + 1)
        if (close < 0) return null
        value = src.slice(k + 1, close)
        k = close + 1
      } else {
        const vs = k
        while (k < n && !isWs(src[k]) && src[k] !== '>') k++
        value = src.slice(vs, k)
      }
      j = k
    }
    if (!(name in attrs) && count < maxAttrs) { attrs[name] = decodeEntities(value); count++ }
  }
}

const endTagRes = new Map                ()
function endTagRe(tag        )         {
  let re = endTagRes.get(tag)
  if (!re) { re = new RegExp(`</\\s*${tag}\\s*>`, 'ig'); endTagRes.set(tag, re) }
  return re
}

/**
 * Parse HTML into a tolerant element tree rooted at a synthetic #document
 * element. Linear in the input: a single forward scan, O(1) open-tag lookups
 * (per-tag open counts instead of walking the ancestor chain), and every
 * element is opened and closed at most once. Output is bounded by
 * HTML_LIMITS; `root.truncated` is set when a cap was hit.
 */
export function parseHtml(html        , limits                      = {})           {
  const L             = { ...HTML_LIMITS, ...limits }
  const root           = { tag: '#document', attrs: {}, children: [], parent: null }
  let src = html ?? ''
  if (src.length > L.maxInputChars) { src = src.slice(0, L.maxInputChars); root.truncated = true }
  const n = src.length
  let cur           = root
  let depth = 0
  let elements = 0
  let textBudget = L.maxTextChars
  const open = new Map                ()
  let noGtFrom = Infinity // no '>' exists at or after this index

  const pushText = (to          , t        ) => {
    if (!t || textBudget <= 0) { if (t) root.truncated = true; return }
    if (t.length > textBudget) { t = t.slice(0, textBudget); root.truncated = true }
    textBudget -= t.length
    to.children.push(decodeEntities(t))
  }
  const enter = (el          ) => { cur = el; depth++; open.set(el.tag, (open.get(el.tag) ?? 0) + 1) }
  const pop = () => {
    if (cur === root) return
    open.set(cur.tag, (open.get(cur.tag) ?? 1) - 1)
    depth--
    cur = cur.parent ?? root
  }
  const nextGt = (from        )         => {
    if (from >= noGtFrom) return -1
    const k = src.indexOf('>', from)
    if (k < 0) noGtFrom = from
    return k
  }

  let i = 0
  let textStart = 0
  scan: while (i < n) {
    const lt = src.indexOf('<', i)
    if (lt < 0) break
    i = lt
    const c1 = src[i + 1]
    let tokenEnd = -1

    if (c1 === '!') {
      if (src.startsWith('<!--', i)) {
        const k = src.indexOf('-->', i + 4)
        tokenEnd = k < 0 ? n : k + 3
      } else {
        const k = src.startsWith('<![CDATA[', i) ? src.indexOf(']]>', i + 9) : -1
        if (k >= 0) tokenEnd = k + 3
        else { const g = nextGt(i + 2); if (g >= 0) tokenEnd = g + 1 }
      }
      if (tokenEnd < 0) { i++; continue }
      pushText(cur, src.slice(textStart, i))
      i = textStart = tokenEnd
      continue
    }
    if (c1 === '?') {
      const g = nextGt(i + 2)
      if (g < 0) { i++; continue }
      pushText(cur, src.slice(textStart, i))
      i = textStart = g + 1
      continue
    }
    if (c1 === '/') {
      let j = i + 2
      while (j < n && isWs(src[j])) j++
      if (j < n && isAsciiAlpha(src[j])) {
        const ns = j
        while (j < n && isNameChar(src[j])) j++
        const tag = src.slice(ns, j).toLowerCase()
        while (j < n && isWs(src[j])) j++
        if (src[j] === '>') {
          pushText(cur, src.slice(textStart, i))
          i = textStart = j + 1
          if ((open.get(tag) ?? 0) > 0) { while (cur !== root && cur.tag !== tag) pop(); pop() }
          continue
        }
      }
      i++
      continue
    }
    if (!c1 || !isAsciiAlpha(c1)) { i++; continue }

    const st = scanStartTag(src, i, L.maxAttrs)
    if (!st) break // unterminated tag at end of input: the remainder is text
    pushText(cur, src.slice(textStart, i))
    i = textStart = st.end
    const { tag, attrs, selfClose } = st

    if (DROP_CONTENT.has(tag)) {
      if (!selfClose) {
        const re = endTagRe(tag)
        re.lastIndex = i
        const end = re.exec(src)
        i = textStart = end ? re.lastIndex : n
      }
      continue
    }
    if (elements >= L.maxElements) { root.truncated = true; textStart = n; break scan }
    elements++
    // implicit closes
    const sib = SELF_CLOSING_SIBLINGS[tag]
    if (sib && sib.includes(cur.tag)) pop()
    if (P_CLOSERS.has(tag) && cur.tag === 'p') pop()

    const el           = { tag, attrs, children: [], parent: cur }
    cur.children.push(el)
    if (RAW_TEXT.has(tag) && !selfClose) {
      const re = endTagRe(tag)
      re.lastIndex = i
      const end = re.exec(src)
      pushText(el, src.slice(i, end ? end.index : n))
      i = textStart = end ? re.lastIndex : n
      continue
    }
    if (!VOID.has(tag) && !selfClose) {
      if (depth >= L.maxDepth) root.truncated = true // attached, not entered: content flattens into the parent
      else enter(el)
    }
  }
  pushText(cur, src.slice(textStart))
  return root
}

export function isElement(n       )                { return typeof n !== 'string' }

export function walk(node          , fn                                  )       {
  for (const c of node.children) {
    if (!isElement(c)) continue
    if (fn(c) === false) continue
    walk(c, fn)
  }
}

export function findAll(node          , pred                           )             {
  const out             = []
  walk(node, (el) => { if (pred(el)) out.push(el) })
  return out
}

/** Concatenated text, whitespace-collapsed. `skip` prunes subtrees. */
export function textOf(node       , skip                            )         {
  const parts           = []
  const rec = (n       ) => {
    if (!isElement(n)) { parts.push(n); return }
    if (skip?.(n)) return
    if (n.tag === 'br') { parts.push(' '); return }
    for (const c of n.children) rec(c)
    if (BLOCK.has(n.tag)) parts.push(' ')
  }
  rec(node)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
  'section', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'ul', 'legend', 'caption', 'html', 'head', 'details', 'summary',
])

/** Plain-text rendering with block boundaries as newlines (innerText-like). */
export function htmlToText(input                   )         {
  const root = typeof input === 'string' ? parseHtml(input) : input
  const lines           = []
  let buf = ''
  const flush = () => { const t = buf.replace(/[ \t\f\v\r\n]+/g, ' ').trim(); if (t) lines.push(t); buf = '' }
  const rec = (n       ) => {
    if (!isElement(n)) { buf += n; return }
    if (n.tag === 'head' || n.tag === 'title' || n.tag === 'select' || n.tag === 'textarea') return
    if (n.tag === 'br') { flush(); return }
    const block = BLOCK.has(n.tag)
    if (block) flush()
    for (const c of n.children) rec(c)
    if (block) flush()
  }
  rec(root)
  flush()
  return lines.join('\n')
}
