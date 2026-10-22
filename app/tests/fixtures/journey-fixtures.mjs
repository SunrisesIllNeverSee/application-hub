// M09 W6 — SYNTHETIC journey fixtures shared by the unit tests and the
// browser walk. The extract-url stub is produced by the SAME pure pipeline
// the real route runs in its step 3 (buildExtractionProposal), so the stub
// has the route's exact response shape — only the network fetch is faked.

import { extractFromHtml } from '../../lib/catalog/extract.ts'
import { buildExtractionProposal } from '../../lib/catalog/proposal.ts'
import { catalogMatchInputs } from '../../lib/journey/review-model.ts'
import { DEV_JOURNEY_CATALOG, DEV_URL, DEV_URL_PAGE_HTML, DEV_DOCX_PARAGRAPHS } from '../../lib/journey/dev-fixture.ts'

export const FIXED_FETCHED_AT = '2026-10-22T12:00:00.000Z'

/** The 200 body POST /api/catalog/extract-url returns for DEV_URL. */
export function extractUrlResponse({ reuse = 'allowed', html = DEV_URL_PAGE_HTML, catalog = DEV_JOURNEY_CATALOG } = {}) {
  const extraction = extractFromHtml(html, { baseUrl: DEV_URL })
  const inputs = catalogMatchInputs(catalog)
  const source = { provenance: 'public_source', reuse, final_url: DEV_URL, fetched_at: FIXED_FETCHED_AT, content_sha256: 'c'.repeat(64) }
  const { classification: _c, ...proposal } = buildExtractionProposal({ extraction, source, programs: inputs.programs, cycles: inputs.cycles, catalog: inputs.questions })
  return {
    ...proposal,
    catalog_lookup: 'ok',
    source: {
      requested_url: DEV_URL, final_url: DEV_URL, status: 200, fetched_at: FIXED_FETCHED_AT, content_type: 'text/html',
      bytes: html.length, content_sha256: 'c'.repeat(64), redirects: [], reuse, reuse_signals: reuse === 'allowed' ? ['robots: allow'] : [],
    },
  }
}

// ── tiny ZIP writer (stored entries) → a real .docx the parser reads ──
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
export function zipStored(entries) {
  const enc = new TextEncoder()
  const locals = []; const centrals = []; let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data
    const crc = crc32(data)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true)
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, 0, true)
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true)
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

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A synthetic .docx (built in-test) from DEV_DOCX_PARAGRAPHS. */
export function docxBytes(paragraphs = DEV_DOCX_PARAGRAPHS) {
  const body = paragraphs.map((p) => `<w:p>${p.style ? `<w:pPr><w:pStyle w:val="${p.style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(p.text)}</w:t></w:r></w:p>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  const ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  return zipStored([{ name: '[Content_Types].xml', data: ct }, { name: 'word/document.xml', data: xml }])
}
