// VENDORED from aqua-companion/vendor/lib/catalog/files.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/files.ts
// source-sha256: c4c74f7b771fac9cd9c4cfde1d12a848a06c79fd6d51b25713515c8d8f86f26b
// body-sha256: 80f69ac820b67a166beadcf601afaf3fb78ef34c5590fc9114e0a277b6a4d405
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — local file parsing for application import. BROWSER-SAFE.
//
// No Node APIs: uses only TextDecoder, DecompressionStream('deflate-raw')
// and Blob/ArrayBuffer, so it runs in the browser (and in Node ≥ 22 for
// tests). Files are parsed on the user's device; nothing is uploaded.
//
// Supported: .txt .md .markdown .html .htm .csv .json .docx
// PDF and everything else → { ok:false, error:'unsupported_format' }.
// Output feeds extract.ts (extractApplication / extractFromRecords).

import { extractApplication,                                            } from './extract.mjs'

export const DEFAULT_FILE_MAX_BYTES = 5 * 1024 * 1024
const DOCX_MAX_XML_BYTES = 20 * 1024 * 1024

                                                                               

                        
     
            
                
                      
                 
                                    
                   
                                                
                                                                      
                              
                      
   
     
             
                
                                                                        
                   
                   
   

                                                                                           
                                                                                                   

const EXT                             = {
  txt: 'text', text: 'text', md: 'markdown', markdown: 'markdown', html: 'html', htm: 'html', xhtml: 'html',
  csv: 'csv', json: 'json', docx: 'docx',
}
const KNOWN_UNSUPPORTED                         = {
  pdf: 'PDF import is not supported yet. Open the PDF, copy the questions, and paste them as text — or export the form as .docx or .html.',
  doc: 'Legacy .doc files are not supported. Save the document as .docx and try again.',
  pages: 'Apple Pages files are not supported. Export as .docx or plain text.',
  odt: 'OpenDocument files are not supported yet. Export as .docx or plain text.',
  rtf: 'RTF files are not supported yet. Save as .docx or plain text.',
  xlsx: 'Spreadsheets are not supported directly. Export the sheet as .csv.',
  xls: 'Spreadsheets are not supported directly. Export the sheet as .csv.',
  pptx: 'Slide decks are not supported. Copy the questions into a text file.',
}

function toBytes(b                          )             { return b instanceof Uint8Array ? b : new Uint8Array(b) }

function decodeText(bytes            )         {
  // BOM-aware: UTF-16 LE/BE, UTF-8
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  return new TextDecoder('utf-8').decode(bytes.subarray(start))
}

// ─── ZIP (central-directory reader, stored + deflate) ─────────────────────────

                                                                                                              

function u16(b            , o        ) { return b[o] | (b[o + 1] << 8) }
function u32(b            , o        ) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 }

export function readZipDirectory(bytes            )             {
  const minEocd = 22
  if (bytes.length < minEocd) throw new Error('not a zip archive')
  let eocd = -1
  for (let i = bytes.length - minEocd; i >= Math.max(0, bytes.length - minEocd - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip end-of-central-directory not found')
  const count = u16(bytes, eocd + 10)
  const cdSize = u32(bytes, eocd + 12)
  const cdOffset = u32(bytes, eocd + 16)
  if (cdOffset === 0xffffffff || count === 0xffff) throw new Error('zip64 archives are not supported')
  if (cdOffset + cdSize > bytes.length) throw new Error('zip central directory out of range')
  const entries             = []
  let p = cdOffset
  const dec = new TextDecoder('utf-8')
  for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error('bad zip central directory entry')
    const method = u16(bytes, p + 10)
    const compressedSize = u32(bytes, p + 20)
    const size = u32(bytes, p + 24)
    const nameLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const commentLen = u16(bytes, p + 32)
    const localOffset = u32(bytes, p + 42)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.push({ name, method, compressedSize, size, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateRaw(data            , maxOut        )                      {
  const DS = (globalThis                                                                                        ).DecompressionStream
  if (!DS) throw new Error('DecompressionStream is not available in this environment')
  const stream = new Blob([data            ]).stream().pipeThrough(new DS('deflate-raw'))
  const reader = stream.getReader()
  const chunks               = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxOut) { await reader.cancel(); throw new Error('decompressed entry exceeds size limit') }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.byteLength }
  return out
}

export async function readZipEntry(bytes            , entry          , maxOut = DOCX_MAX_XML_BYTES)                      {
  const p = entry.localOffset
  if (u32(bytes, p) !== 0x04034b50) throw new Error('bad zip local header')
  const nameLen = u16(bytes, p + 26)
  const extraLen = u16(bytes, p + 28)
  const start = p + 30 + nameLen + extraLen
  const data = bytes.subarray(start, start + entry.compressedSize)
  if (data.length !== entry.compressedSize) throw new Error('zip entry truncated')
  if (entry.method === 0) { if (data.length > maxOut) throw new Error('entry exceeds size limit'); return data }
  if (entry.method === 8) return inflateRaw(data, maxOut)
  throw new Error(`zip compression method ${entry.method} is not supported`)
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

function xmlDecode(s        )         {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e        ) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n) } catch { return '' } }
    return ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }                          )[e.toLowerCase()] ?? ''
  })
}

                                                                                                       

/** Paragraphs (with heading levels) from word/document.xml. */
export function parseDocumentXml(xml        )                  {
  const out                  = []
  const body = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '') // tracked deletions are not document text
  for (const pm of body.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const inner = pm[1] ?? ''
    const style = inner.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1]
    let text = ''
    for (const tm of inner.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) {
      if (tm[2] === 'tab') text += '\t'
      else if (tm[2]) text += '\n'
      else text += xmlDecode(tm[1])
    }
    text = text.replace(/[ \t]+/g, ' ').trim()
    if (!text) continue
    const para                = { text }
    if (style) {
      para.style = style
      const h = style.match(/^(?:Heading|heading|berschrift|Titre)\s?(\d)$/)
      if (h) para.heading_level = Math.min(6, +h[1])
      else if (/^Title$/i.test(style)) para.heading_level = 1
      else if (/^Subtitle$/i.test(style)) para.heading_level = 2
    }
    if (/<w:numPr\b/.test(inner) || (style && /List/i.test(style))) para.list = true
    out.push(para)
  }
  return out
}

/** Read a .docx and render it as Markdown (headings → #, paragraphs as lines). */
export async function readDocx(bytes            )                                                             {
  const entries = readZipDirectory(bytes)
  const doc = entries.find((e) => e.name === 'word/document.xml')
  if (!doc) throw new Error('word/document.xml not found — not a Word document')
  if (doc.size > DOCX_MAX_XML_BYTES) throw new Error('document.xml exceeds size limit')
  const xml = new TextDecoder('utf-8').decode(await readZipEntry(bytes, doc))
  const paragraphs = parseDocumentXml(xml)
  const lines           = []
  for (const p of paragraphs) {
    if (p.heading_level) lines.push(`${'#'.repeat(p.heading_level)} ${p.text.replace(/\n/g, ' ')}`)
    else lines.push(p.text)
    lines.push('')
  }
  return { markdown: lines.join('\n').trim() + '\n', paragraphs }
}

// ─── CSV / JSON ───────────────────────────────────────────────────────────────

export function parseCsv(text        )             {
  const rows             = []
  let row           = []
  let field = ''
  let q = false
  const delim = (() => { const first = text.split(/\r?\n/, 1)[0] ?? ''; const c = (first.match(/,/g) ?? []).length; const s = (first.match(/;/g) ?? []).length; const t = (first.match(/\t/g) ?? []).length; return t > c && t > s ? '\t' : s > c ? ';' : ',' })()
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
      continue
    }
    if (ch === '"' && field === '') { q = true; continue }
    if (ch === delim) { row.push(field); field = ''; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

const Q_COL = /^(?:question(?:[_ ]?text)?|prompt|asked[_ ]?as|text|label|field|item)$/i
const SEC_COL = /^(?:section|category|group|part|page)$/i
const WL_COL = /^(?:word[_ ]?limit|max[_ ]?words|words)$/i
const CL_COL = /^(?:char(?:acter)?[_ ]?limit|max[_ ]?(?:chars|characters)|characters)$/i
const REQ_COL = /^(?:required|is[_ ]?required|mandatory)$/i
const ANS_COL = /^(?:answer(?:[_ ]?text)?|response|value|reply)$/i

function toBool(v         )                 {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').trim().toLowerCase()
  if (['true', 'yes', 'y', '1', 'required', 'x'].includes(s)) return true
  if (['false', 'no', 'n', '0', 'optional', ''].includes(s)) return s === '' ? null : false
  return null
}

function recordsFromObjects(rows                                )                          {
  if (!rows.length) return null
  const keys = Object.keys(rows[0] ?? {})
  const qk = keys.find((k) => Q_COL.test(k.trim()))
  if (!qk) return null
  const find = (re        ) => keys.find((k) => re.test(k.trim()))
  const sk = find(SEC_COL); const wk = find(WL_COL); const ck = find(CL_COL); const rk = find(REQ_COL); const ak = find(ANS_COL)
  const out                   = []
  for (const r of rows) {
    const q = String(r[qk] ?? '').trim()
    if (!q) continue
    const rec                 = { question: q }
    if (sk && r[sk] != null && String(r[sk]).trim()) rec.section = String(r[sk]).trim()
    if (wk && Number(r[wk]) > 0) rec.word_limit = Number(r[wk])
    if (ck && Number(r[ck]) > 0) rec.char_limit = Number(r[ck])
    if (rk) { const b = toBool(r[rk]); if (b !== null) rec.required = b }
    if (ak && r[ak] != null && String(r[ak]).trim()) rec.answer = String(r[ak])
    out.push(rec)
  }
  return out
}

function jsonToInput(value         )                                               {
  const arr = Array.isArray(value) ? value
    : value && typeof value === 'object'
      ? (['questions', 'items', 'fields', 'data'].map((k) => (value                           )[k]).find(Array.isArray)                         )
      : undefined
  if (arr) {
    if (arr.every((x) => typeof x === 'string')) {
      return { records: (arr            ).filter((s) => s.trim()).map((s) => ({ question: s })), text: (arr            ).join('\n\n') }
    }
    const objs = arr.filter((x)                               => !!x && typeof x === 'object' && !Array.isArray(x))
    const recs = recordsFromObjects(objs)
    if (recs) return { records: recs, text: recs.map((r) => r.question).join('\n\n') }
  }
  const strings           = []
  const rec = (v         ) => {
    if (typeof v === 'string') { if (v.trim()) strings.push(v.trim()) }
    else if (Array.isArray(v)) v.forEach(rec)
    else if (v && typeof v === 'object') Object.values(v).forEach(rec)
  }
  rec(value)
  return { text: strings.join('\n\n') }
}

// ─── entry points ─────────────────────────────────────────────────────────────

function extOf(name        )         { const m = name.toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : '' }

/** Parse a user file locally. Never throws; failures are explicit results. */
export async function parseUserFile(input                      , opts                        = {})                      {
  const name = input.name || 'file'
  const maxBytes = opts.maxBytes ?? DEFAULT_FILE_MAX_BYTES
  const declaredSize = 'size' in input && typeof input.size === 'number' ? input.size : undefined
  if (declaredSize !== undefined && declaredSize > maxBytes) return { ok: false, name, error: 'too_large', message: `File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` }
  let bytes            
  // M09 W6: a real browser File/Blob now has a `bytes()` METHOD (Blob.prototype.bytes),
  // so `'bytes' in input` alone misreads every upload as empty — only a
  // FileInput carries bytes as data.
  const raw = (input             ).bytes           
  try { bytes = raw instanceof Uint8Array || raw instanceof ArrayBuffer ? toBytes(raw) : new Uint8Array(await (input            ).arrayBuffer()) } catch {
    return { ok: false, name, error: 'parse_failed', message: 'The file could not be read.' }
  }
  if (bytes.byteLength > maxBytes) return { ok: false, name, error: 'too_large', message: `File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` }
  if (bytes.byteLength === 0) return { ok: false, name, error: 'empty', message: 'The file is empty.' }

  const ext = extOf(name)
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
  if (isPdf || ext === 'pdf') return { ok: false, name, error: 'unsupported_format', format: 'pdf', message: KNOWN_UNSUPPORTED.pdf }
  const format = EXT[ext] ?? (input.type === 'text/html' ? 'html' : input.type === 'text/markdown' ? 'markdown' : input.type === 'text/plain' ? 'text' : undefined)
  if (!format) {
    return { ok: false, name, error: 'unsupported_format', format: ext || input.type || 'unknown', message: KNOWN_UNSUPPORTED[ext] ?? `Unsupported file type${ext ? ` .${ext}` : ''}. Supported: .txt, .md, .html, .csv, .json, .docx.` }
  }
  const warnings           = []
  try {
    if (format === 'docx') {
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
      if (!isZip) return { ok: false, name, error: 'parse_failed', format, message: 'This .docx file is not a valid Word document.' }
      const { markdown } = await readDocx(bytes)
      if (!markdown.trim()) return { ok: false, name, error: 'empty', format, message: 'The document has no text.' }
      return { ok: true, name, format, bytes: bytes.byteLength, content: markdown, extract_format: 'markdown', warnings }
    }
    const text = decodeText(bytes)
    if (!text.trim()) return { ok: false, name, error: 'empty', format, message: 'The file has no text.' }
    if (format === 'csv') {
      const rows = parseCsv(text)
      const [header, ...body] = rows
      const objs = (body ?? []).map((r) => Object.fromEntries((header ?? []).map((h, i) => [h.trim(), r[i] ?? ''])))
      const records = header && header.some((h) => Q_COL.test(h.trim())) ? recordsFromObjects(objs) : null
      if (records && records.length) return { ok: true, name, format, bytes: bytes.byteLength, content: records.map((r) => r.question).join('\n\n'), extract_format: 'text', records, warnings }
      warnings.push('no question column found — each cell is treated as text')
      return { ok: true, name, format, bytes: bytes.byteLength, content: rows.map((r) => r.filter((c) => c.trim()).join('\n')).join('\n\n'), extract_format: 'text', warnings }
    }
    if (format === 'json') {
      let parsed         
      try { parsed = JSON.parse(text) } catch { return { ok: false, name, error: 'parse_failed', format, message: 'The JSON file is not valid JSON.' } }
      const { records, text: t } = jsonToInput(parsed)
      return { ok: true, name, format, bytes: bytes.byteLength, content: t, extract_format: 'text', ...(records && records.length ? { records } : {}), warnings }
    }
    return { ok: true, name, format, bytes: bytes.byteLength, content: text, extract_format: format === 'html' ? 'html' : format === 'markdown' ? 'markdown' : 'text', warnings }
  } catch (err) {
    return { ok: false, name, error: 'parse_failed', format, message: err instanceof Error ? `The file could not be parsed: ${err.message}` : 'The file could not be parsed.' }
  }
}

/** Parse a user file and extract question occurrences from it, all on-device. */
export async function extractFromFile(input                      , opts                        = {})                                                                     {
  const file = await parseUserFile(input, opts)
  if (!file.ok) return { file, extraction: null }
  return { file, extraction: extractApplication({ content: file.content, format: file.extract_format, records: file.records }) }
}
