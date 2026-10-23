// M09b — parse ANSWERED (already submitted) applications into history pairs:
// exact question wording + the answer the user submitted, the program, the
// source file hash, and the submission date with where it came from.
//
// Rules:
//   - the question wording is kept exactly as written (numbering / "Q:"
//     markers removed, nothing else), via the vendored app extractor;
//   - the submission date comes from frontmatter, then document metadata,
//     then the file name, then the caller's --date. When none is found the
//     record is flagged `date_unknown` and submitted_at stays null: the
//     importer NEVER guesses silently. Conflicting sources are flagged
//     `date_conflict`; ambiguous numeric dates (03/04/2025) `date_ambiguous`;
//   - every answer is scanned for unfilled placeholders with the same rules
//     the vault write enforces (vendored aqua-local/history.mjs);
//   - md/txt/docx are split into question/answer pairs by an answered-document
//     segmenter (segmentAnswered): explicit prompts (headings, which a .docx
//     carries as paragraph styles; "Q:"/"Question N:"; numbered prompts; bold
//     prompts) or, in a document with none of those, standalone lines ending
//     in "?". Every pair carries a parse_confidence (high | medium | low) and
//     the reasons; a low-confidence pair must be reviewed by the user before
//     it can be confirmed as submitted.
// Pure apart from WebCrypto hashing; no file system, no network.

import { sha256Hex } from './crypto.mjs'
import { extractApplication } from '../vendor/lib/catalog/extract.mjs'
import { htmlToText } from '../vendor/lib/catalog/html.mjs'
import { parseCsv, parseUserFile, readZipDirectory, readZipEntry } from '../vendor/lib/catalog/files.mjs'
import { findPlaceholders, isCalendarDate } from '../vendor/lib/aqua-local/history.mjs'

export const HISTORY_EXTENSIONS = ['md', 'markdown', 'txt', 'text', 'docx', 'html', 'htm', 'json', 'csv']
export const MAX_HISTORY_FILE_BYTES = 5 * 1024 * 1024

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const DATE_KEYS = /^(?:submitted(?:[_ -]?(?:at|on|date))?|submission[_ -]?date|date[_ -]?submitted|sent(?:[_ -]?(?:at|on))?)$/i
const PROGRAM_KEYS = /^(?:program(?:[_ -]?name)?|application|opportunity|fund|accelerator|title)$/i
const ORG_KEYS = /^(?:organi[sz]ation|org|organi[sz]er|funder)$/i
const Q_KEY = /^(?:question(?:[_ ]?text)?|prompt|asked[_ ]?as|label|field|item|q)$/i
const A_KEY = /^(?:answer(?:[_ ]?text)?|response|value|reply|submitted[_ ]?answer|a)$/i
const META_LINE = /^\s*(submitted(?: at| on)?|submission date|date submitted|program(?: name)?|organi[sz]ation)\s*:\s*(.+?)\s*$/i

function extOf(name) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function decode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const start = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  return new TextDecoder('utf-8').decode(b.subarray(start))
}

/**
 * Parse one date value. Returns { date: 'YYYY-MM-DD' } | { ambiguous: true } | null.
 * Accepts YYYY-MM-DD (optionally with a time), "March 1, 2025", "1 March 2025".
 * Numeric day/month forms are ambiguous and never resolved by guessing.
 */
export function parseDateValue(raw, now = new Date()) {
  const s = String(raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!s) return null
  let date = null
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ][0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/)
  if (m) date = `${m[1]}-${m[2]}-${m[3]}`
  if (!date) {
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)
    const m2 = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/)
    const [mon, day, year] = m ? [m[1], m[2], m[3]] : m2 ? [m2[2], m2[1], m2[3]] : []
    if (mon) {
      const idx = MONTHS.findIndex((x) => x.startsWith(mon.toLowerCase()) && mon.length >= 3)
      if (idx >= 0) date = `${year}-${String(idx + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    }
  }
  if (!date) {
    if (/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(s)) return { ambiguous: true }
    return null
  }
  if (!isCalendarDate(date)) return null
  if (Date.parse(`${date}T00:00:00Z`) > now.getTime() + 24 * 3600 * 1000) return { future: true }
  return { date }
}

/** YYYY-MM-DD (or YYYY_MM_DD) in a file name. */
export function dateFromFilename(name, now = new Date()) {
  const m = String(name).match(/(?:^|[^0-9])(\d{4})[-_](\d{2})[-_](\d{2})(?![0-9])/)
  return m ? parseDateValue(`${m[1]}-${m[2]}-${m[3]}`, now) : null
}

/** `---\nkey: value\n---` at the very top. Returns { meta, body }. */
export function splitFrontmatter(text) {
  const m = String(text).match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return { meta: {}, body: text }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z][A-Za-z0-9 _-]{0,40})\s*:\s*(.*?)\s*$/)
    if (kv) meta[kv[1].trim()] = kv[2].replace(/^["']|["']$/g, '')
  }
  return { meta, body: text.slice(m[0].length) }
}

/** Remove "Submitted: …" / "Program: …" lines near the top; return them as metadata. */
function takeMetaLines(text) {
  const lines = String(text).split(/\r?\n/)
  const meta = {}
  const keep = []
  lines.forEach((line, i) => {
    const m = i < 40 ? line.match(META_LINE) : null
    if (m) meta[m[1].toLowerCase()] = m[2]
    else keep.push(line)
  })
  return { meta, body: keep.join('\n') }
}

function pick(meta, re) {
  for (const [k, v] of Object.entries(meta)) if (re.test(k.trim()) && typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function pairsFromOccurrences(extraction, confidence = 'medium', notes = []) {
  const pairs = []
  const unanswered = []
  for (const o of extraction.occurrences) {
    const answer = (o.following_text ?? o.filled_value ?? '').trim()
    if (answer) pairs.push({ question: o.asked_as, answer, parse_confidence: confidence, parse_notes: [...notes] })
    else unanswered.push(o.asked_as)
  }
  return { pairs, unanswered }
}

// ---------------------------------------------------------------------------
// answered-document segmenter (md / txt / docx text)
// ---------------------------------------------------------------------------

const LIMIT_TAIL = /\s*[([]\s*(?:max(?:imum)?\.?\s*)?(?:up to\s*)?\d[\d,]*\s*(?:-\s*\d[\d,]*\s*)?(?:words?|characters?|chars?)(?:\s*max(?:imum)?)?\s*[)\]]\s*$/i
const MAX_PROMPT = 300
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 }

/** Does this single line read like a question/prompt (ends in "?" or carries a word/char limit or a colon)? */
function promptEnding(t) {
  const core = t.replace(LIMIT_TAIL, '').replace(/[*_]+$/, '').trim()
  if (/\?$/.test(core)) return 'question'
  if (LIMIT_TAIL.test(t)) return 'limit'
  if (/:$/.test(core)) return 'colon'
  return null
}

/** Classify one line as a prompt. Returns { kind, text, strong, level? } or null. */
function promptOf(line) {
  const t = line.trim()
  if (!t || t.length > MAX_PROMPT + 10) return null
  let m = t.match(/^(#{1,6})\s+(.+?)\s*#*$/)
  if (m) return { kind: 'heading', level: m[1].length, text: m[2].replace(/^\*\*(.+)\*\*$/, '$1').trim(), strong: true }
  m = t.match(/^(?:Q(?:uestion)?\s*\d{0,3}\s*[:.)]|Question\s+\d{1,3}\s*[-–:.)])\s*(.+)$/i)
  if (m && m[1].trim()) return { kind: 'q_prefix', text: m[1].replace(/^\*\*(.+)\*\*$/, '$1').trim(), strong: true }
  m = t.match(/^\*\*(.+?)\*\*\s*:?$/)
  if (m && promptEnding(m[1] + (t.endsWith(':') ? ':' : ''))) return { kind: 'bold', text: m[1].trim(), strong: true }
  m = t.match(/^\d{1,2}[.)]\s+(.+)$/)
  if (m && promptEnding(m[1])) return { kind: 'numbered', text: m[1].replace(/^\*\*(.+)\*\*$/, '$1').trim(), strong: true }
  if (t.length <= MAX_PROMPT && promptEnding(t) === 'question' && !/^[-*•]\s/.test(t)) return { kind: 'qmark', text: t, strong: false }
  return null
}

/** Paragraph blocks (blank-line separated); a heading line is always its own block. */
function blocksOf(text) {
  const blocks = []
  let cur = []
  const flush = () => { if (cur.length) blocks.push(cur); cur = [] }
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { flush(); continue }
    if (/^#{1,6}\s+\S/.test(line.trim())) { flush(); blocks.push([line.trim()]); continue }
    cur.push(line)
  }
  flush()
  return blocks
}

const stripAnswerPrefix = (s) => s.replace(/^\s*(?:A|Answer|Response)\s*\d{0,3}\s*[:.)]\s*/i, '')

/**
 * Split an answered document into { title, pairs, unanswered }.
 * Explicit prompts (headings / paragraph styles, Q:, numbered and bold
 * prompts) win; standalone "?" lines are used only when a document has none.
 * Each pair: { question, answer, parse_confidence, parse_notes }.
 */
export function segmentAnswered(text) {
  const blocks = blocksOf(text)
  // A block's FIRST line may be a prompt with the answer on the next lines ("Q: …\nA: …", "1. Why?\nBecause.").
  const units = blocks.map((b) => ({ prompt: promptOf(b[0]), rest: b.slice(1).join('\n'), raw: b.join('\n') }))
  // title: a leading level-1 heading, or a leading short plain line followed by a prompt
  let title = null
  let start = 0
  const first = units[0]
  if (first?.prompt?.kind === 'heading' && first.prompt.level === 1 && !first.rest && units.some((u, i) => i > 0 && u.prompt)) {
    title = first.prompt.text
    start = 1
  } else if (first && !first.prompt && !first.raw.includes('\n') && first.raw.length <= 160 && !/[.!?:;]$/.test(first.raw.trim()) && units[1]?.prompt) {
    title = first.raw.trim()
    start = 1
  }
  const body = units.slice(start)
  const strong = body.some((u) => u.prompt?.strong)
  const isMarker = (u) => Boolean(u.prompt && (strong ? u.prompt.strong : true))
  const mode = strong ? 'explicit' : 'question_lines'
  const pairs = []
  const unanswered = []
  let q = null
  let parts = []
  const close = () => {
    if (!q) return
    const answer = stripAnswerPrefix(parts.join('\n\n')).trim()
    if (!answer) {
      unanswered.push(q.text)
    } else {
      const notes = []
      let conf = q.kind === 'qmark' ? 'medium' : 'high'
      if (q.kind === 'qmark') notes.push('split_on_question_lines')
      if (q.kind === 'heading' && !promptEnding(q.text)) { conf = 'medium'; notes.push('heading_not_phrased_as_question') }
      // an answer that itself contains a standalone question line may hide a second question
      if (answer.split('\n').some((l) => promptOf(l)?.kind === 'qmark')) { conf = 'low'; notes.push('answer_contains_question_line') }
      if (/^(?:submitted(?: at| on)?|submission date|date submitted)\s*:/im.test(answer)) { conf = 'low'; notes.push('answer_contains_metadata_line') }
      if (answer.length < 2) { conf = 'low'; notes.push('answer_too_short') }
      pairs.push({ question: q.text, answer, parse_confidence: conf, parse_notes: notes })
    }
    q = null
    parts = []
  }
  for (const u of body) {
    if (isMarker(u)) {
      close()
      q = u.prompt
      if (u.rest) parts.push(u.rest)
    } else if (q) parts.push(u.raw)
  }
  close()
  return { title, pairs, unanswered, mode }
}

/** Lowest confidence first; used for a file-level summary. */
export function lowestConfidence(pairs) {
  return pairs.reduce((lo, p) => (CONFIDENCE_RANK[p.parse_confidence] < CONFIDENCE_RANK[lo] ? p.parse_confidence : lo), 'high')
}

function pairsFromObjects(rows) {
  const pairs = []
  const unanswered = []
  for (const r of rows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const keys = Object.keys(r)
    const qk = keys.find((k) => Q_KEY.test(k.trim()))
    const ak = keys.find((k) => A_KEY.test(k.trim()))
    if (!qk) continue
    const q = String(r[qk] ?? '').trim()
    if (!q) continue
    const a = ak && r[ak] != null ? String(r[ak]).trim() : ''
    if (a) pairs.push({ question: q, answer: a, parse_confidence: 'high', parse_notes: [] })
    else unanswered.push(q)
  }
  return { pairs, unanswered }
}

async function docxMeta(bytes) {
  const meta = {}
  try {
    const entries = readZipDirectory(bytes)
    for (const name of ['docProps/custom.xml', 'docProps/core.xml']) {
      const e = entries.find((x) => x.name === name)
      if (!e || e.size > 1024 * 1024) continue
      const xml = new TextDecoder('utf-8').decode(await readZipEntry(bytes, e))
      if (name.endsWith('custom.xml')) {
        for (const m of xml.matchAll(/<property\b[^>]*\bname="([^"]{1,60})"[^>]*>\s*<vt:[a-zA-Z0-9]+>([^<]{0,200})<\/vt:/g)) meta[m[1]] = m[2]
      } else {
        const t = xml.match(/<dc:title>([^<]{1,300})<\/dc:title>/)
        if (t) meta.title = t[1]
      }
    }
  } catch {
    // metadata is optional; the document text is still parsed
  }
  return meta
}

function htmlMeta(html) {
  const meta = {}
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']{1,60})["']/i)?.[1]
    const content = tag.match(/\bcontent\s*=\s*["']([^"']{0,300})["']/i)?.[1]
    if (name && content !== undefined) meta[name.replace(/^(?:aqua|dc|dcterms)[:.]/i, '')] = content
  }
  const title = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]
  if (title && !meta.title) meta.title = title.trim()
  return meta
}

/** md / txt / docx text: the segmenter first; the form extractor only when it finds nothing (low confidence). */
function answeredPairs(text, format) {
  const seg = segmentAnswered(text)
  const ex = extractApplication({ content: text, format })
  const docTitle = seg.title ?? ex.program.title ?? null
  if (seg.pairs.length) return { pairs: seg.pairs, unanswered: seg.unanswered, extractedTitle: docTitle }
  const fb = pairsFromOccurrences(ex, 'low', ['fallback_extractor'])
  return { pairs: fb.pairs, unanswered: fb.pairs.length ? fb.unanswered : [...seg.unanswered, ...fb.unanswered.filter((u) => !seg.unanswered.includes(u))], extractedTitle: docTitle }
}

/**
 * Parse one answered application file.
 * Returns { ok:true, format, program, program_source, organization, submitted_at,
 *   date_source, flags, date_candidates,
 *   pairs:[{question, answer, placeholders, parse_confidence, parse_notes}], parse_confidence,
 *   unanswered, source_sha256, text } or { ok:false, error, message }.
 */
export async function parseHistoryFile({ name, bytes, date = null, program = null, now = new Date() }) {
  const ext = extOf(name)
  if (!HISTORY_EXTENSIONS.includes(ext)) {
    return { ok: false, error: 'unsupported_format', message: `Unsupported file type .${ext || '?'}. Supported: .md, .txt, .docx, .html, .json, .csv.` }
  }
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (!u8.byteLength) return { ok: false, error: 'empty', message: 'The file is empty.' }
  if (u8.byteLength > MAX_HISTORY_FILE_BYTES) return { ok: false, error: 'too_large', message: 'The file is larger than 5 MB.' }
  const source_sha256 = await sha256Hex(u8)
  const frontmatter = {}
  let meta = {}
  let pairs = []
  let unanswered = []
  let text = ''
  let extractedTitle = null
  let format = ext

  try {
    if (['md', 'markdown', 'txt', 'text'].includes(ext)) {
      const raw = decode(u8)
      const fm = splitFrontmatter(raw)
      Object.assign(frontmatter, fm.meta)
      const ml = takeMetaLines(fm.body)
      meta = ml.meta
      text = ml.body
      ;({ pairs, unanswered, extractedTitle } = answeredPairs(text, ext.startsWith('m') ? 'markdown' : 'text'))
    } else if (ext === 'docx') {
      const parsed = await parseUserFile({ name, bytes: u8 })
      if (!parsed.ok) return { ok: false, error: parsed.error, message: parsed.error === 'parse_failed' ? 'The Word document could not be read.' : parsed.message }
      meta = await docxMeta(u8)
      const ml = takeMetaLines(parsed.content)
      Object.assign(meta, ml.meta)
      text = ml.body
      ;({ pairs, unanswered, extractedTitle } = answeredPairs(text, 'markdown'))
    } else if (ext === 'html' || ext === 'htm') {
      const html = decode(u8)
      meta = htmlMeta(html)
      const fromForm = pairsFromOccurrences(extractApplication({ content: html, format: 'html' }))
      const plain = takeMetaLines(htmlToText(html))
      Object.assign(meta, plain.meta)
      const exText = extractApplication({ content: plain.body, format: 'text' })
      const fromText = pairsFromOccurrences(exText)
      ;({ pairs, unanswered } = fromText.pairs.length >= fromForm.pairs.length ? fromText : fromForm)
      text = plain.body
      extractedTitle = exText.program.title ?? null
    } else if (ext === 'json') {
      let value
      try {
        value = JSON.parse(decode(u8))
      } catch {
        return { ok: false, error: 'parse_failed', message: 'The JSON file is not valid JSON.' }
      }
      let rows = Array.isArray(value) ? value : null
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value)) if (typeof v === 'string' || typeof v === 'number') meta[k] = String(v)
        rows = ['answers', 'questions', 'responses', 'items', 'fields', 'data'].map((k) => value[k]).find(Array.isArray) ?? null
      }
      ;({ pairs, unanswered } = pairsFromObjects(rows ?? []))
      text = JSON.stringify(value, null, 2)
      format = 'json'
    } else if (ext === 'csv') {
      const t = decode(u8)
      const [header, ...body] = parseCsv(t)
      const objs = (body ?? []).map((r) => Object.fromEntries((header ?? []).map((h, i) => [h.trim(), r[i] ?? ''])))
      ;({ pairs, unanswered } = pairsFromObjects(objs))
      for (const key of header ?? []) {
        const k = key.trim()
        if (DATE_KEYS.test(k) || PROGRAM_KEYS.test(k) || ORG_KEYS.test(k)) {
          const vals = [...new Set(objs.map((o) => String(o[key] ?? '').trim()).filter(Boolean))]
          if (vals.length === 1) meta[k] = vals[0]
        }
      }
      text = t
    }
  } catch {
    return { ok: false, error: 'parse_failed', message: 'The file could not be parsed. Save it again as .md, .txt or .docx.' }
  }

  // --- submission date: frontmatter > metadata > filename > --date; never guessed ---
  const flags = []
  const candidates = []
  const consider = (source, raw) => {
    if (raw === null || raw === undefined || raw === '') return
    const r = parseDateValue(raw, now)
    if (r?.date) candidates.push({ source, date: r.date })
    else if (r?.ambiguous) flags.push('date_ambiguous')
    else if (r?.future) flags.push('date_in_future')
    else flags.push('date_unparseable')
  }
  consider('frontmatter', pick(frontmatter, DATE_KEYS))
  consider('metadata', pick(meta, DATE_KEYS))
  const fromName = dateFromFilename(name, now)
  if (fromName?.date) candidates.push({ source: 'filename', date: fromName.date })
  if (date) consider('flag', date)
  const chosen = candidates[0] ?? null
  if (new Set(candidates.map((c) => c.date)).size > 1) flags.push('date_conflict')
  if (!chosen) flags.push('date_unknown')

  // --- program ---
  let programName = null
  let program_source = null
  for (const [src, v] of [['flag', program], ['frontmatter', pick(frontmatter, PROGRAM_KEYS)], ['metadata', pick(meta, PROGRAM_KEYS)], ['document', extractedTitle]]) {
    if (typeof v === 'string' && v.trim()) {
      programName = v.trim().slice(0, 300)
      program_source = src
      break
    }
  }
  if (!programName) {
    programName = String(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 300) || 'Imported application'
    program_source = 'filename'
    flags.push('program_from_filename')
  }
  const organization = pick(frontmatter, ORG_KEYS) ?? pick(meta, ORG_KEYS)

  return {
    ok: true,
    format,
    program: programName,
    program_source,
    organization: organization ?? null,
    submitted_at: chosen?.date ?? null,
    date_source: chosen?.source ?? null,
    date_candidates: candidates,
    flags: [...new Set(flags)],
    pairs: pairs.map((p) => ({ parse_confidence: 'medium', parse_notes: [], ...p, placeholders: findPlaceholders(p.answer) })),
    parse_confidence: pairs.length ? lowestConfidence(pairs.map((p) => ({ parse_confidence: 'medium', ...p }))) : null,
    unanswered,
    source_sha256,
    text,
  }
}
