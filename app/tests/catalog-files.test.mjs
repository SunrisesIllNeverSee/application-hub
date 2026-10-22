// M09 W2 — browser-safe local file parsing. The .docx fixture is BUILT IN
// THE TEST (minimal ZIP writer, stored + deflate-raw entries); synthetic text.
// Run: node --test tests/catalog-files.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseUserFile, extractFromFile, readDocx, readZipDirectory, parseCsv } from '../lib/catalog/files.ts'

// ── tiny ZIP writer ──
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
async function deflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}
async function zip(entries) {
  const enc = new TextEncoder()
  const locals = []; const centrals = []; let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const raw = typeof e.data === 'string' ? enc.encode(e.data) : e.data
    const data = e.method === 8 ? await deflateRaw(raw) : raw
    const crc = crc32(raw)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, e.method, true)
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, e.method, true)
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true)
    locals.push(new Uint8Array(lh.buffer), name, data)
    centrals.push(new Uint8Array(ch.buffer), name)
    offset += 30 + name.length + data.length
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0)
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true)
  const parts = [...locals, ...centrals, new Uint8Array(eocd.buffer)]
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0)); let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

const p = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
const DOC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${p('Synthetic Grant Application 2027', 'Title')}
${p('Section A', 'Heading1')}
${p('1. What problem are you solving? (Maximum 250 words)')}
${p('2. Describe your team &amp; why you are suited to this work (500 characters max)')}
<w:p><w:r><w:t>3. Who are your</w:t></w:r><w:r><w:t xml:space="preserve"> users?</w:t></w:r></w:p>
<w:p><w:del><w:r><w:delText>deleted text</w:delText></w:r></w:del><w:r><w:t>4. What is your budget?</w:t></w:r></w:p>
</w:body></w:document>`
const CT = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'

for (const method of [0, 8]) {
  test(`docx (${method === 8 ? 'deflate' : 'stored'}): headings and paragraphs → questions with limits`, async () => {
    const bytes = await zip([{ name: '[Content_Types].xml', data: CT, method }, { name: 'word/document.xml', data: DOC_XML, method }])
    assert.deepEqual(readZipDirectory(bytes).map((e) => e.name), ['[Content_Types].xml', 'word/document.xml'])
    const { markdown, paragraphs } = await readDocx(bytes)
    assert.equal(paragraphs[0].heading_level, 1)
    assert.ok(markdown.startsWith('# Synthetic Grant Application 2027'))
    assert.ok(!markdown.includes('deleted text'))
    const { file, extraction } = await extractFromFile({ name: 'application.docx', bytes })
    assert.equal(file.ok, true)
    assert.equal(file.format, 'docx')
    assert.deepEqual(extraction.occurrences.map((o) => o.asked_as), [
      'What problem are you solving? (Maximum 250 words)',
      'Describe your team & why you are suited to this work (500 characters max)',
      'Who are your users?',
      'What is your budget?',
    ])
    assert.equal(extraction.occurrences[0].requirements.word_limit, 250)
    assert.equal(extraction.occurrences[1].requirements.char_limit, 500)
    assert.equal(extraction.occurrences[0].section, 'Section A')
    assert.equal(extraction.program.title, 'Synthetic Grant Application 2027')
  })
}

test('docx without word/document.xml → parse_failed', async () => {
  const bytes = await zip([{ name: 'other.xml', data: '<x/>', method: 0 }])
  const r = await parseUserFile({ name: 'x.docx', bytes })
  assert.equal(r.ok, false)
  assert.equal(r.error, 'parse_failed')
})

test('PDF (by extension or magic bytes) → explicit unsupported_format', async () => {
  const r1 = await parseUserFile({ name: 'form.pdf', bytes: new TextEncoder().encode('%PDF-1.7 ...') })
  assert.equal(r1.ok, false)
  assert.equal(r1.error, 'unsupported_format')
  assert.match(r1.message, /PDF/)
  const r2 = await parseUserFile({ name: 'form.txt', bytes: new TextEncoder().encode('%PDF-1.4') })
  assert.equal(r2.error, 'unsupported_format')
  const r3 = await parseUserFile({ name: 'sheet.xlsx', bytes: new Uint8Array([1, 2, 3]) })
  assert.equal(r3.error, 'unsupported_format')
  assert.match(r3.message, /csv/i)
})

test('size limit and empty files', async () => {
  const r = await parseUserFile({ name: 'big.txt', bytes: new Uint8Array(2048) }, { maxBytes: 1024 })
  assert.equal(r.error, 'too_large')
  const r2 = await parseUserFile({ name: 'big.txt', size: 10_000_000, arrayBuffer: async () => new ArrayBuffer(0) })
  assert.equal(r2.error, 'too_large')
  const e = await parseUserFile({ name: 'e.txt', bytes: new Uint8Array(0) })
  assert.equal(e.error, 'empty')
})

test('txt / md / html files feed extraction (Blob-like input works)', async () => {
  const enc = new TextEncoder()
  const txt = await extractFromFile({ name: 'q.txt', arrayBuffer: async () => enc.encode('1. What are you building?\n2. Why now?\n').buffer })
  assert.deepEqual(txt.extraction.occurrences.map((o) => o.asked_as), ['What are you building?', 'Why now?'])
  const md = await extractFromFile({ name: 'q.md', bytes: enc.encode('# Program\n## Team\n### Who is on your team?\n') })
  assert.equal(md.extraction.occurrences[0].section, 'Team')
  const html = await extractFromFile({ name: 'q.html', bytes: enc.encode('<label for=a>What is your mission?</label><textarea id=a maxlength=300></textarea>') })
  assert.equal(html.extraction.occurrences[0].requirements.char_limit, 300)
})

test('csv with question/limit/section/answer columns → records (answer kept private)', async () => {
  const csv = 'Question,Word limit,Section,Required,Answer\n"What problem are you solving?",250,Company,yes,"We help, with commas"\nWho are your users?,,Market,no,\n'
  assert.deepEqual(parseCsv(csv)[1], ['What problem are you solving?', '250', 'Company', 'yes', 'We help, with commas'])
  const { file, extraction } = await extractFromFile({ name: 'qs.csv', bytes: new TextEncoder().encode(csv) })
  assert.equal(file.ok, true)
  assert.equal(file.records.length, 2)
  const [a, b] = extraction.occurrences
  assert.equal(a.requirements.word_limit, 250)
  assert.equal(a.requirements.required, true)
  assert.equal(a.section, 'Company')
  assert.equal(a.following_text, 'We help, with commas')
  assert.equal(b.requirements.required, false)
})

test('json: array of strings, {questions:[…]} objects, and generic fallback', async () => {
  const enc = new TextEncoder()
  const a = await extractFromFile({ name: 'a.json', bytes: enc.encode(JSON.stringify(['What is your mission?', 'Who are your users?'])) })
  assert.equal(a.extraction.occurrences.length, 2)
  const b = await extractFromFile({ name: 'b.json', bytes: enc.encode(JSON.stringify({ questions: [{ prompt: 'Describe your traction', char_limit: 500 }] })) })
  assert.equal(b.extraction.occurrences[0].requirements.char_limit, 500)
  const bad = await parseUserFile({ name: 'c.json', bytes: enc.encode('{nope') })
  assert.equal(bad.error, 'parse_failed')
})

test('UTF-8 BOM and UTF-16 text decode', async () => {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Why now?')])
  const r = await parseUserFile({ name: 'b.txt', bytes: bom })
  assert.equal(r.content, 'Why now?')
  const u16 = new Uint8Array([0xff, 0xfe, ...[...'Why?'].flatMap((c) => [c.charCodeAt(0), 0])])
  const r2 = await parseUserFile({ name: 'u.txt', bytes: u16 })
  assert.equal(r2.content, 'Why?')
})
