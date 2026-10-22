// M09b — history parser regressions found in AT23 (synthetic fixtures built here).
//   (a) a plain .docx: the second question and its answer were merged into the first answer;
//   (b) a .md with a "Submitted:" line: the answer was read as the question;
//   (c) the program name came from the file name instead of the document title.
// Every pair carries parse_confidence; low confidence is reported per record.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHistoryFile, segmentAnswered } from '../src/history-parse.mjs'
import { initWorkspace, readManifest, scratch } from './helpers.mjs'
import { inbox, startServer, syntheticDocx, zipStored } from './mcp-helpers.mjs'

const enc = (s) => new TextEncoder().encode(s)
const qa = (r) => r.pairs.map((p) => [p.question, p.answer])

/** A .docx whose paragraphs may carry a paragraph style (Title, Heading2, ListParagraph …). */
function styledDocx(paras) {
  const p = ([style, t]) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.map(p).join('')}</w:body></w:document>`
  const ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  return zipStored([{ name: '[Content_Types].xml', data: ct }, { name: 'word/document.xml', data: xml }])
}

test('(a) plain .docx: each question gets its own answer; program from the first line, not the file name', async () => {
  const bytes = syntheticDocx([
    'Synthetic Harbor Community Grant',
    'Who is on your team?',
    'Two synthetic founders: one builds hardware, one builds dashboards. (ref S-1)',
    'How will you use the grant funds?',
    '60 percent synthetic buoys, 25 percent a field technician, 15 percent testing. (ref S-2)',
  ])
  const r = await parseHistoryFile({ name: '2024-09-10-synthetic-harbor-grant.docx', bytes })
  assert.equal(r.ok, true)
  assert.deepEqual(qa(r), [
    ['Who is on your team?', 'Two synthetic founders: one builds hardware, one builds dashboards. (ref S-1)'],
    ['How will you use the grant funds?', '60 percent synthetic buoys, 25 percent a field technician, 15 percent testing. (ref S-2)'],
  ])
  assert.equal(r.program, 'Synthetic Harbor Community Grant')
  assert.equal(r.program_source, 'document')
  assert.equal(r.flags.includes('program_from_filename'), false)
  assert.equal(r.submitted_at, '2024-09-10')
  for (const p of r.pairs) assert.ok(['high', 'medium'].includes(p.parse_confidence), p.parse_confidence)
})

test('(a) .docx with paragraph styles: Title + Heading prompts, multi-paragraph answers stay whole, a "?" sentence inside an answer does not split it', async () => {
  const bytes = styledDocx([
    ['Title', 'Synthetic Styled Fellowship'],
    ['Heading2', 'What problem are you solving?'],
    [null, 'Synthetic clinics lose hours to phone scheduling.'],
    [null, 'Why does that matter? Because staff time is the scarcest resource. (ref S-3)'],
    ['Heading2', 'What have you shipped?'],
    [null, 'A synthetic booking pilot in three clinics. (ref S-4)'],
  ])
  const r = await parseHistoryFile({ name: 'styled.docx', bytes })
  assert.equal(r.program, 'Synthetic Styled Fellowship')
  assert.deepEqual(qa(r), [
    ['What problem are you solving?', 'Synthetic clinics lose hours to phone scheduling.\n\nWhy does that matter? Because staff time is the scarcest resource. (ref S-3)'],
    ['What have you shipped?', 'A synthetic booking pilot in three clinics. (ref S-4)'],
  ])
  assert.equal(r.pairs[1].parse_confidence, 'high')
})

test('(b) .md with a Submitted: line and ## question: question and answer are not swapped', async () => {
  const md = '# Synthetic Coastal Fellowship\n\nSubmitted: May 20, 2024\n\n## What is the biggest risk to your project?\n\nOur biggest risk is synthetic sensor fouling: barnacles coat the probes within weeks. (ref S-5)\n'
  const r = await parseHistoryFile({ name: 'coastal-synthetic-2024.md', bytes: enc(md) })
  assert.deepEqual(qa(r), [['What is the biggest risk to your project?', 'Our biggest risk is synthetic sensor fouling: barnacles coat the probes within weeks. (ref S-5)']])
  assert.deepEqual(r.unanswered, [])
  assert.equal(r.submitted_at, '2024-05-20')
  assert.equal(r.date_source, 'metadata')
  assert.equal(r.program, 'Synthetic Coastal Fellowship')
  assert.equal(r.pairs[0].parse_confidence, 'high')
})

test('(c) program name: frontmatter > document title > file name (flagged)', async () => {
  const fm = await parseHistoryFile({ name: 'x.md', bytes: enc('---\ntitle: Synthetic Frontmatter Fund\n---\n# Other Heading\n\n## Why now?\n\nBecause. (synthetic)\n') })
  assert.deepEqual([fm.program, fm.program_source], ['Synthetic Frontmatter Fund', 'frontmatter'])
  const doc = await parseHistoryFile({ name: 'y.md', bytes: enc('# Synthetic Heading Fund\n\n## Why now?\n\nBecause. (synthetic)\n') })
  assert.deepEqual([doc.program, doc.program_source], ['Synthetic Heading Fund', 'document'])
  const file = await parseHistoryFile({ name: 'synthetic_file-name.md', bytes: enc('## Why now?\n\nBecause. (synthetic)\n') })
  assert.deepEqual([file.program, file.program_source], ['synthetic file name', 'filename'])
  assert.ok(file.flags.includes('program_from_filename'))
})

test('numbered prompts and Q:/A: pairs; list items inside an answer do not start a question', async () => {
  const seg = segmentAnswered('Synthetic Numbered Grant\n\n1. What is your mission?\nTo make synthetic data useful:\n\n1. collect\n2. clean\n\n2. What is your budget? (50 words)\n\nForty synthetic dollars.\n')
  assert.equal(seg.title, 'Synthetic Numbered Grant')
  assert.deepEqual(seg.pairs.map((p) => [p.question, p.answer]), [
    ['What is your mission?', 'To make synthetic data useful:\n\n1. collect\n2. clean'],
    ['What is your budget? (50 words)', 'Forty synthetic dollars.'],
  ])
  const qaSeg = segmentAnswered('Q: Describe your mission.\nA: To make synthetic data useful.\n\nQ: What is your budget?\nA: Forty synthetic dollars.\n')
  assert.deepEqual(qaSeg.pairs.map((p) => [p.question, p.answer]), [['Describe your mission.', 'To make synthetic data useful.'], ['What is your budget?', 'Forty synthetic dollars.']])
})

test('low confidence: an explicit prompt whose answer holds a standalone question line is flagged, with the reason', async () => {
  const r = await parseHistoryFile({ name: 'mixed.md', bytes: enc('## Tell us about your team.\n\nTwo synthetic founders.\n\nHow will you use the funds?\n\nSynthetic buoys.\n') })
  assert.equal(r.pairs.length, 1)
  assert.equal(r.pairs[0].parse_confidence, 'low')
  assert.ok(r.pairs[0].parse_notes.includes('answer_contains_question_line'))
  assert.equal(r.parse_confidence, 'low')
})

test('import_history reports parse_confidence per record and counts low-confidence answers; the vault record carries it', async () => {
  const dir = scratch('m09b-hist-confidence')
  const root = await initWorkspace(dir)
  inbox(root, 'history/2024-09-10-synthetic-plain.docx', syntheticDocx(['Synthetic Plain Grant', 'Who is on your team?', 'Two synthetic founders.', 'How will you use the funds?', 'Synthetic buoys.']))
  inbox(root, 'history/mixed.md', '## Tell us about your team.\n\nTwo synthetic founders.\n\nHow will you use the funds?\n\nSynthetic buoys.\n')
  const c = startServer(root)
  try {
    await c.initialize()
    const r = await c.call('import_history', { folder: 'history', date: '2024-01-01' })
    assert.equal(r.status, 'ok', JSON.stringify(r))
    assert.equal(r.counts.answers, 3)
    assert.equal(r.counts.low_confidence, 1)
    const docx = r.files.find((f) => f.file.endsWith('.docx'))
    assert.deepEqual(docx.records.map((x) => x.parse_confidence), ['medium', 'medium'])
    const mixed = r.files.find((f) => f.file.endsWith('mixed.md'))
    assert.deepEqual(mixed.records.map((x) => x.parse_confidence), ['low'])
    assert.ok(mixed.records[0].parse_notes.includes('answer_contains_question_line'))
    assert.equal(mixed.low_confidence, 1)
    assert.ok(r.next_steps.some((s) => /parse_confidence "low"/.test(s)))
    assert.equal(Object.values(readManifest(root).records).filter((e) => e.kind === 'version' && e.history).length, 3)
  } finally {
    await c.close()
  }
})
