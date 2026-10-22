// Minimal application extraction for `import-application` (txt, md, json,
// html). Question wording is kept EXACTLY as written (only the list marker
// is removed). Richer parsers (PDF, DOCX, portal captures) plug in here
// later: each returns the same { title, org, cycle_year, deadline,
// questions[] } shape.
//
// Imported text is data. Nothing here interprets it as instructions.

import path from 'node:path'

export const MAX_INPUT_BYTES = 5 * 1024 * 1024
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.json', '.html', '.htm']

export class ExtractError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ExtractError'
  }
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' }

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

/** HTML -> text lines (block elements become line breaks). */
/**
 * Remove comments and script/style/noscript/template blocks with a linear
 * scan (regexes with lazy quantifiers go quadratic on unclosed tags).
 * An unclosed block drops the rest of the document.
 */
export function stripBlocks(html) {
  const lower = html.toLowerCase()
  const out = []
  let i = 0
  const BLOCKS = ['script', 'style', 'noscript', 'template']
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) {
      out.push(html.slice(i))
      break
    }
    out.push(html.slice(i, lt))
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4)
      if (end < 0) break
      i = end + 3
      continue
    }
    const name = BLOCKS.find((b) => lower.startsWith(`<${b}`, lt) && !/[a-z0-9-]/.test(lower[lt + 1 + b.length] ?? ''))
    if (name) {
      const close = lower.indexOf(`</${name}`, lt + 1)
      if (close < 0) break
      const gt = lower.indexOf('>', close)
      if (gt < 0) break
      i = gt + 1
      continue
    }
    out.push('<')
    i = lt + 1
  }
  return out.join('')
}

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'label', 'section', 'article', 'legend', 'dt', 'dd', 'blockquote', 'textarea', 'option', 'br', 'hr', 'ul', 'ol', 'table', 'form', 'fieldset'])

/**
 * Linear tag walk: yields text and tags. A '<' with no closing '>' is text.
 * Returns [{ text } | { tag, closing, inner }].
 */
function tokens(html) {
  const out = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) {
      out.push({ text: html.slice(i) })
      break
    }
    if (lt > i) out.push({ text: html.slice(i, lt) })
    const gt = html.indexOf('>', lt + 1)
    if (gt < 0) {
      out.push({ text: html.slice(lt) })
      break
    }
    const inner = html.slice(lt + 1, gt)
    const m = /^\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(inner)
    if (m) out.push({ tag: m[2].toLowerCase(), closing: m[1] === '/', inner })
    else out.push({ text: '' })
    i = gt + 1
  }
  return out
}

/** HTML -> text lines (block elements become line breaks). Linear time. */
export function htmlToText(html) {
  const parts = []
  for (const t of tokens(stripBlocks(html))) {
    if (t.text !== undefined) parts.push(t.text)
    else if (t.tag === 'li' && !t.closing) parts.push('\n- ')
    else if (BLOCK_TAGS.has(t.tag)) parts.push('\n')
  }
  return decodeEntities(parts.join(''))
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
}

/** Text content of the first <name>...</name> element (linear). */
function firstElementText(html, name) {
  const lower = html.toLowerCase()
  const open = lower.indexOf(`<${name}`)
  if (open < 0) return null
  const gt = lower.indexOf('>', open)
  const close = gt < 0 ? -1 : lower.indexOf(`</${name}`, gt)
  if (close < 0) return null
  const text = tokens(html.slice(gt + 1, close)).map((t) => t.text ?? '').join('')
  return decodeEntities(text).replace(/\s+/g, ' ').trim() || null
}

const LIMIT_WORDS = /(\d{1,6})\s*(?:-\s*)?words?\b/i
const LIMIT_CHARS = /(\d{1,6})\s*(?:-\s*)?(?:characters?|chars?)\b/i

export function detectLimits(text) {
  const w = text.match(LIMIT_WORDS)
  const c = text.match(LIMIT_CHARS)
  const word_limit = w ? Number(w[1]) : null
  const char_limit = c ? Number(c[1]) : null
  return { word_limit: word_limit > 0 ? word_limit : null, char_limit: char_limit > 0 ? char_limit : null }
}

function detectRequired(text) {
  return /\(required\)|\brequired\b\s*[:)]|\*\s*$/i.test(text)
}

/** True when a line ends with '?', optionally followed by one "(...)" note and/or '*' (linear). */
export function endsAsQuestion(line) {
  let end = line.length
  while (end > 0 && (line[end - 1] === '*' || /\s/.test(line[end - 1]))) end--
  let t = line.slice(0, end)
  if (t.endsWith(')')) {
    const open = t.lastIndexOf('(')
    if (open >= 0) t = t.slice(0, open).trimEnd()
  }
  return t.endsWith('?')
}

/** Text/markdown question detection. Returns { title, org, questions }. */
export function extractFromText(text, { markdown = false } = {}) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let title = null
  let org = null
  const questions = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const orgMatch = line.match(/^(?:\*\*)?(?:organization|organisation|org|program|funder)(?:\*\*)?\s*:\s*(.+)$/i)
    if (orgMatch && !org) {
      org = orgMatch[1].replace(/\*\*/g, '').trim()
      continue
    }
    if (markdown && /^#\s+/.test(line) && !title) {
      title = line.replace(/^#\s+/, '').trim()
      continue
    }
    let q = null
    const numbered = line.match(/^(?:#{2,6}\s+)?(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.):-]\s+(.+)$/i)
    const bullet = line.match(/^[-*+]\s+(.+)$/)
    const heading = markdown ? line.match(/^#{2,6}\s+(.+)$/) : null
    if (numbered) q = numbered[1]
    else if (bullet && /\?|\(\s*\d+\s*(words?|characters?|chars?)/i.test(bullet[1])) q = bullet[1]
    else if (heading && endsAsQuestion(heading[1])) q = heading[1]
    else if (endsAsQuestion(line) && line.length >= 8) q = line
    if (q) {
      questions.push({ text: q.trim(), ...detectLimits(q), required: detectRequired(q) })
    } else if (!title && !markdown) {
      title = line
    } else if (!title && markdown && !/^#/.test(line)) {
      title = line
    }
  }
  return { title, org, questions }
}

function num(v) {
  return Number.isInteger(v) && v > 0 ? v : null
}

/** JSON: a LocalAppTemplate-like object, or { questions: [...] }. */
export function extractFromJson(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new ExtractError('the JSON file could not be parsed')
  }
  if (Array.isArray(obj)) obj = { questions: obj }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.questions)) {
    throw new ExtractError('JSON must be an object with a "questions" array (or an array of questions)')
  }
  const questions = obj.questions.map((q, i) => {
    if (typeof q === 'string') return { text: q, ...detectLimits(q), required: false }
    if (!q || typeof q !== 'object') throw new ExtractError(`questions[${i}] must be a string or an object`)
    const t = q.text ?? q.question ?? q.prompt ?? q.label
    if (typeof t !== 'string' || !t.trim()) throw new ExtractError(`questions[${i}] has no text`)
    return {
      text: t,
      word_limit: num(q.word_limit ?? q.max_words ?? q.words) ?? detectLimits(t).word_limit,
      char_limit: num(q.char_limit ?? q.max_chars ?? q.max_characters ?? q.characters) ?? detectLimits(t).char_limit,
      required: q.required === true,
      section_id: typeof q.section_id === 'string' ? q.section_id : null,
    }
  })
  return {
    title: typeof obj.title === 'string' ? obj.title : typeof obj.name === 'string' ? obj.name : null,
    org: typeof obj.org === 'string' ? obj.org : typeof obj.organization === 'string' ? obj.organization : null,
    cycle_year: Number.isInteger(obj.cycle_year) ? obj.cycle_year : null,
    deadline: typeof obj.deadline === 'string' ? obj.deadline : null,
    questions,
  }
}

export function extractFromHtml(html) {
  const stripped = stripBlocks(html)
  const title = firstElementText(stripped, 'h1') ?? firstElementText(stripped, 'title')
  const r = extractFromText(htmlToText(html), { markdown: false })
  // the text pass may have taken the h1 line as a title; never as a question
  return { title: title ?? r.title, org: r.org, questions: r.questions.filter((q) => q.text !== title) }
}

/**
 * Extract an application template from a file's text. Returns
 * { title, org, cycle_year, deadline, questions, media_type }.
 */
export function extractApplication(fileName, text, overrides = {}) {
  const ext = path.extname(fileName).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ExtractError(`unsupported file type ${ext || '(none)'}; supported now: ${SUPPORTED_EXTENSIONS.join(', ')}`)
  }
  let r
  let media_type
  if (ext === '.json') {
    r = extractFromJson(text)
    media_type = 'application/json'
  } else if (ext === '.html' || ext === '.htm') {
    r = extractFromHtml(text)
    media_type = 'text/html'
  } else {
    const markdown = ext !== '.txt'
    r = extractFromText(text, { markdown })
    media_type = markdown ? 'text/markdown' : 'text/plain'
  }
  const title = overrides.title ?? r.title ?? path.basename(fileName, ext)
  if (!r.questions.length) {
    throw new ExtractError(
      'no questions were found. Number the questions (1. ...), end them with "?", or provide JSON with a "questions" array.',
    )
  }
  return {
    title,
    org: overrides.org ?? r.org ?? '',
    cycle_year: overrides.cycle_year ?? r.cycle_year ?? null,
    deadline: overrides.deadline ?? r.deadline ?? null,
    questions: r.questions,
    media_type,
  }
}
