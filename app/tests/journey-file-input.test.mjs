// M09 W6 — regression: a browser File/Blob exposes a bytes() METHOD
// (Blob.prototype.bytes). parseUserFile must read it via arrayBuffer(), not
// treat the method as data (which made every upload read as empty).
// Synthetic data only. Run: node --test tests/journey-file-input.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFromFile, parseUserFile } from '../lib/catalog/files.ts'
import { docxBytes } from './fixtures/journey-fixtures.mjs'

test('Blob with a bytes() method is read through arrayBuffer()', async () => {
  const blob = new Blob(['1. What problem are you solving? (Maximum 150 words)\n'], { type: 'text/plain' })
  const file = Object.assign(blob, { name: 'questions.txt' })
  assert.equal(typeof file.bytes, 'function', 'runtime Blob has bytes()')
  const r = await parseUserFile(file)
  assert.equal(r.ok, true, r.message)
  assert.match(r.content, /What problem/)
})

test('PDF blob → explicit unsupported message; docx blob extracts questions', async () => {
  const pdf = Object.assign(new Blob(['%PDF-1.4 synthetic']), { name: 'form.pdf' })
  const p = await parseUserFile(pdf)
  assert.equal(p.ok, false)
  assert.equal(p.error, 'unsupported_format')
  assert.match(p.message, /PDF import is not supported yet/)
  const docx = Object.assign(new Blob([docxBytes()]), { name: 'grant.docx' })
  const { file, extraction } = await extractFromFile(docx)
  assert.equal(file.ok, true)
  assert.equal(extraction.occurrences.length, 3)
})
