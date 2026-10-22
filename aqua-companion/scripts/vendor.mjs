#!/usr/bin/env node
// Vendor the pure app modules the companion's agent interface needs into
// aqua-companion/vendor/, so the companion runs without the repository.
//
//   node aqua-companion/scripts/vendor.mjs           regenerate what is out of date
//   node aqua-companion/scripts/vendor.mjs --check   report drift, write nothing (exit 1 on drift)
//
// Each vendored file is the source with TypeScript types stripped
// (node:module stripTypeScriptTypes, strip mode: types become whitespace,
// nothing is transformed) and `.ts` import specifiers rewritten to `.mjs`.
// The header records the source path and the source sha256, plus the sha256
// of the generated body. A file whose source and body hashes still match is
// left untouched, so re-running is byte-stable on any Node version; CI runs
// this script and then `git diff --exit-code aqua-companion/vendor`.
//
// The module set is the closure of VALUE imports from ROOTS. Anything that
// would pull in a bare package, a non-allowlisted node: builtin, or a file
// outside app/lib fails the run: vendored code must stay pure.

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as nodeModule from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const COMPANION = path.resolve(HERE, '..')
const REPO = path.resolve(COMPANION, '..')
const LIB = path.join(REPO, 'app', 'lib')
const VENDOR = path.join(COMPANION, 'vendor')
const OUT_LIB = path.join(VENDOR, 'lib')

export const ROOTS = [
  'catalog/normalize.ts',
  'catalog/match.ts',
  'catalog/extract.ts',
  'catalog/classify.ts',
  'catalog/files.ts',
  'catalog/html.ts',
  'catalog/proposal.ts',
  'canonical-catalog.ts',
  'aqua-local/status.ts',
  'aqua-local/history.ts',
  'aqua-local/classify.ts',
  'aqua-local/match.ts',
  'aqua-local/verify-packet.mjs',
  'review-ui/view-model.ts',
  'review-ui/html-export.ts',
  'review-ui/decision-file.ts',
]

/** node: builtins vendored code may use (verify-packet.mjs: CLI file read + WebCrypto). */
const ALLOWED_BUILTINS = new Set(['node:fs', 'node:crypto', 'node:url'])

// stripTypeScriptTypes is flagged experimental on some Node versions; keep the output clean.
const emitWarning = process.emitWarning
process.emitWarning = function (warning, ...rest) {
  if (String(warning).includes('stripTypeScriptTypes')) return
  return emitWarning.call(process, warning, ...rest)
}

/** Bump when the transformation changes: forces regeneration of every file. */
export const GENERATOR_VERSION = 2

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

function stripTypes(code, rel) {
  if (rel.endsWith('.mjs') || rel.endsWith('.js')) return code
  if (typeof nodeModule.stripTypeScriptTypes !== 'function') {
    throw new Error('this Node.js has no module.stripTypeScriptTypes (needs 22.13+); cannot regenerate vendor/')
  }
  return nodeModule.stripTypeScriptTypes(code, { mode: 'strip' })
}

const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g

/** Value-import specifiers of already-stripped code. */
function specifiers(code) {
  const out = new Set()
  for (const m of code.matchAll(IMPORT_RE)) out.add(m[3])
  return [...out]
}

function outRelOf(rel) {
  return rel.replace(/\.ts$/, '.mjs')
}

function rewrite(code) {
  // a shebang is only valid on line 1; the header goes first
  return code.replace(/^#![^\n]*\n/, '').replace(IMPORT_RE, (all, pre, q, spec) => (spec.startsWith('.') && spec.endsWith('.ts') ? `${pre}${q}${spec.slice(0, -3)}.mjs${q}` : all))
}

function header(rel, sourceSha, bodySha) {
  return [
    '// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs',
    `// source: app/lib/${rel}`,
    `// source-sha256: ${sourceSha}`,
    `// body-sha256: ${bodySha}`,
    `// generator: v${GENERATOR_VERSION}; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.`,
    '',
  ].join('\n')
}

export function parseHeader(text) {
  const src = /^\/\/ source: app\/lib\/(.+)$/m.exec(text)
  const s = /^\/\/ source-sha256: ([0-9a-f]{64})$/m.exec(text)
  const b = /^\/\/ body-sha256: ([0-9a-f]{64})$/m.exec(text)
  const g = /^\/\/ generator: v(\d+);/m.exec(text)
  if (!src || !s || !b || !g) return null
  const lines = text.split('\n')
  const body = lines.slice(5).join('\n')
  return { source: src[1], sourceSha: s[1], bodySha: b[1], generator: Number(g[1]), body }
}

/** Compute the closure and what each vendored file should be. */
export function plan() {
  const files = new Map() // rel -> { sourceSha, code }
  const queue = [...ROOTS]
  while (queue.length) {
    const rel = queue.shift()
    if (files.has(rel)) continue
    const abs = path.join(LIB, rel)
    if (!abs.startsWith(LIB + path.sep)) throw new Error(`refusing to vendor outside app/lib: ${rel}`)
    const source = fs.readFileSync(abs, 'utf8')
    const stripped = stripTypes(source, rel)
    for (const spec of specifiers(stripped)) {
      if (spec.startsWith('node:')) {
        if (!ALLOWED_BUILTINS.has(spec)) throw new Error(`${rel} imports ${spec}; vendored code may only use ${[...ALLOWED_BUILTINS].join(', ')}`)
        continue
      }
      if (!spec.startsWith('.')) throw new Error(`${rel} imports package "${spec}"; vendored code must be dependency-free`)
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec))
      if (target.startsWith('..')) throw new Error(`${rel} imports ${spec}, outside app/lib`)
      queue.push(target)
    }
    files.set(rel, { sourceSha: sha256(source), code: rewrite(stripped) })
  }
  return files
}

function listVendored() {
  const out = []
  const visit = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) visit(p)
      else out.push(path.relative(OUT_LIB, p).split(path.sep).join('/'))
    }
  }
  visit(OUT_LIB)
  return out.sort()
}

export function run({ check = false } = {}) {
  const files = plan()
  const wanted = new Set([...files.keys()].map(outRelOf))
  const drift = []
  const manifest = { format: 'aqua-companion-vendor', version: 1, generator: 'aqua-companion/scripts/vendor.mjs', files: [] }
  for (const [rel, { sourceSha, code }] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const outRel = outRelOf(rel)
    const outAbs = path.join(OUT_LIB, outRel)
    const existing = fs.existsSync(outAbs) ? parseHeader(fs.readFileSync(outAbs, 'utf8')) : null
    const intact = existing && existing.source === rel && existing.sourceSha === sourceSha && existing.generator === GENERATOR_VERSION && sha256(existing.body) === existing.bodySha
    let bodySha
    if (intact) {
      bodySha = existing.bodySha // up to date: keep the bytes (stable across Node versions)
    } else {
      bodySha = sha256(code)
      drift.push(`${outRel}: ${existing ? (existing.sourceSha !== sourceSha ? 'source changed' : existing.generator !== GENERATOR_VERSION ? 'generator changed' : 'edited by hand') : 'missing'}`)
      if (!check) {
        fs.mkdirSync(path.dirname(outAbs), { recursive: true })
        fs.writeFileSync(outAbs, header(rel, sourceSha, bodySha) + code)
      }
    }
    manifest.files.push({ path: `lib/${outRel}`, source: `app/lib/${rel}`, source_sha256: sourceSha, body_sha256: bodySha })
  }
  for (const f of listVendored()) {
    if (!wanted.has(f)) {
      drift.push(`${f}: no longer needed`)
      if (!check) fs.rmSync(path.join(OUT_LIB, f))
    }
  }
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestPath = path.join(VENDOR, 'VENDOR.json')
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== manifestText) {
    drift.push('VENDOR.json: out of date')
    if (!check) fs.writeFileSync(manifestPath, manifestText)
  }
  return { drift, files: manifest.files }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const { drift, files } = run({ check })
  if (drift.length) {
    for (const d of drift) console.log(`${check ? 'DRIFT' : 'updated'} ${d}`)
    if (check) process.exitCode = 1
  }
  console.log(`${files.length} vendored module(s) ${check ? (drift.length ? 'OUT OF SYNC' : 'in sync') : 'up to date'}.`)
}
