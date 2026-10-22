// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/html.ts
// source-sha256: e98930726c9590a6891b862e680fc418c30b6da7d1d90e7ed7333299a089e11d
// body-sha256: 848809e9bc44ff27ccd5dde79ba82fbd016543937be39b7991f5b3c54c1c8ee1
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

const TOKEN_RE = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<\/\s*([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttrs(raw        )                         {
  const out                         = {}
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase()
    if (name in out) continue
    out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

/** Parse HTML into a tolerant element tree rooted at a synthetic #document element. */
export function parseHtml(html        )           {
  const root           = { tag: '#document', attrs: {}, children: [], parent: null }
  let cur           = root
  let last = 0
  const src = html
  TOKEN_RE.lastIndex = 0
  let m                        
  const pushText = (t        ) => { if (t) cur.children.push(decodeEntities(t)) }
  const stackHas = (tag        ) => { for (let e                  = cur; e; e = e.parent) if (e.tag === tag) return true; return false }
  const closeTo = (tag        ) => { for (let e                  = cur; e && e !== root; e = e.parent) { if (e.tag === tag) { cur = e.parent ?? root; return } } }

  while ((m = TOKEN_RE.exec(src)) !== null) {
    pushText(src.slice(last, m.index))
    last = TOKEN_RE.lastIndex
    if (m[1]) { // close tag
      const tag = m[1].toLowerCase()
      if (stackHas(tag)) closeTo(tag)
      continue
    }
    if (!m[2]) continue // comment / doctype / cdata / PI
    const tag = m[2].toLowerCase()
    const attrs = parseAttrs(m[3] ?? '')
    const selfClose = m[4] === '/'

    if (DROP_CONTENT.has(tag)) {
      if (!selfClose) {
        const endRe = new RegExp(`</\\s*${tag}\\s*>`, 'ig')
        endRe.lastIndex = last
        const end = endRe.exec(src)
        last = end ? endRe.lastIndex : src.length
        TOKEN_RE.lastIndex = last
      }
      continue
    }
    // implicit closes
    const sib = SELF_CLOSING_SIBLINGS[tag]
    if (sib && sib.includes(cur.tag)) cur = cur.parent ?? root
    if (P_CLOSERS.has(tag) && cur.tag === 'p') cur = cur.parent ?? root

    const el           = { tag, attrs, children: [], parent: cur }
    cur.children.push(el)
    if (RAW_TEXT.has(tag) && !selfClose) {
      const endRe = new RegExp(`</\\s*${tag}\\s*>`, 'ig')
      endRe.lastIndex = last
      const end = endRe.exec(src)
      const rawEnd = end ? end.index : src.length
      const text = src.slice(last, rawEnd)
      if (text) el.children.push(decodeEntities(text))
      last = end ? endRe.lastIndex : src.length
      TOKEN_RE.lastIndex = last
      continue
    }
    if (!VOID.has(tag) && !selfClose) cur = el
  }
  pushText(src.slice(last))
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
