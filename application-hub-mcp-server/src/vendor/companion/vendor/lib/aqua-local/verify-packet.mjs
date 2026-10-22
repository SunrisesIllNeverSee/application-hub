// VENDORED from aqua-companion/vendor/lib/aqua-local/verify-packet.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/verify-packet.mjs
// source-sha256: e2fad28ab964276b157372ecb2bb06704b5dff980cf079890ca3fbc99a75ee10
// body-sha256: 62c680e4b299e7858fad6b4460913fa05945cfec3a0ca705aae8cbfd519f4fd6
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// LF-22 — standalone packet verifier. Stdlib Node only (no imports from the
// app): recomputes the canonical manifest, per-answer sha256, packet_id, and
// the ECDSA P-256 signature against the embedded pubkey.
//
// Usage:
//   node verify-packet.mjs <packet-export.json>
//   cat packet-export.json | node verify-packet.mjs -
//
// Exit 0 = all checks PASS. Exit 1 = any check FAIL. Per-check report on stdout.
//
// M09 W8: the checks live in `verifyPacketText(raw)` (pure: no I/O, no
// exit) so the local companion's agent interface can vendor and reuse the
// exact same logic. The CLI below only reads input, prints and exits.

import { readFileSync, realpathSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const subtle = webcrypto.subtle
const te = new TextEncoder()

// --- canonical JSON: object keys sorted recursively, no whitespace ---------
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
  return `{${parts.join(',')}}`
}

async function sha256Hex(text) {
  const digest = await subtle.digest('SHA-256', te.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64decode(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

/**
 * Run every check on a packet export's text. Returns
 * { ok, checks: [{ name, pass, detail }] }. Never throws for bad input.
 */
export async function verifyPacketText(raw) {
  const results = []
  const check = (name, pass, detail = '') => results.push({ name, pass, detail })
  const done = () => ({ ok: results.length > 0 && results.every((r) => r.pass), checks: results })

  // --- check 1: file parses as JSON ---
  let doc
  try {
    doc = JSON.parse(raw)
  } catch (e) {
    check('parse JSON', false, e.message)
    return done()
  }
  check('parse JSON', true)

  // --- check 2: export format ---
  check(
    'export format',
    doc?.format === 'aqua-local-packet',
    `format=${JSON.stringify(doc?.format)}`,
  )

  const packet = doc?.packet
  if (!packet || typeof packet !== 'object') {
    check('packet object present', false)
    return done()
  }
  check('packet object present', true)

  // --- check 3: unreachable-state sentinel ---
  // LF-23: submitted_external_observed is declared but unreachable — if an
  // export claims it (in packet.state or doc.state), that is a FAIL signal.
  const claimedState = packet.state ?? doc.state ?? null
  check(
    'no unreachable external-submission claim',
    claimedState !== 'submitted_external_observed',
    claimedState ? `state=${claimedState}` : 'no state claim in export',
  )

  // --- check 4: canonical manifest recompute ---
  // manifest = canonical JSON of packet minus {packet_id, signoff}
  const { packet_id: pid, signoff, ...manifestContent } = packet
  const recomputedManifest = canonicalJson(manifestContent)
  check(
    'manifest canonical match',
    recomputedManifest === doc.manifest_json,
    recomputedManifest === doc.manifest_json ? '' : 'embedded manifest_json differs from recomputed',
  )
  const recomputedSha = await sha256Hex(recomputedManifest)
  check(
    'manifest_sha256',
    recomputedSha === doc.manifest_sha256,
    `recomputed=${recomputedSha} embedded=${doc.manifest_sha256}`,
  )

  // --- check 5: packet_id derivation ---
  const expectedPid = `PK-${recomputedSha.slice(0, 16)}`
  check('packet_id derivation', pid === expectedPid, `expected=${expectedPid} found=${pid}`)

  // --- check 6: per-answer sha256 ---
  const questions = Array.isArray(packet.questions) ? packet.questions : []
  let allAnswersOk = questions.length > 0
  let skipsOk = true
  for (const q of questions) {
    if (q.skipped === true) {
      // A skip is an explanation, never a hidden answer: no version, body,
      // title or hash, not approved, and a non-blank reason.
      const ok = q.approved === false && q.version_id == null && q.answer_body == null &&
        q.answer_title == null && q.answer_sha256 == null &&
        typeof q.skip_reason === 'string' && q.skip_reason.trim() !== ''
      if (!ok) skipsOk = false
      continue
    }
    if (q.skipped !== false && q.skipped !== undefined) { allAnswersOk = false; continue }
    const expected = await sha256Hex(canonicalJson({ title: q.answer_title, body: q.answer_body }))
    if (expected !== q.answer_sha256 || q.approved !== true || !q.version_id) {
      allAnswersOk = false
    }
  }
  check(
    'per-answer sha256',
    allAnswersOk,
    `${questions.filter((q) => q.skipped !== true).length} answer(s) hashed`,
  )
  check(
    'skipped entries are explained and carry no answer',
    skipsOk,
    `${questions.filter((q) => q.skipped === true).length} skip(s)`,
  )

  // --- check 7: provenance declared-vs-observed honesty ---
  const provenance = Array.isArray(packet.provenance) ? packet.provenance : []
  const provenanceOk = provenance.every(
    (p) => Array.isArray(p.observed) && p.observed.every((c) => typeof c === 'string'),
  )
  check('provenance receipts well-formed', provenanceOk, `${provenance.length} receipt(s)`)

  // --- check 8: signature (optional-but-honest) ---
  if (signoff && signoff.signature_b64) {
    if (!signoff.pubkey_b64) {
      check('signature present but pubkey missing', false)
    } else {
      try {
        const key = await subtle.importKey(
          'spki',
          b64decode(signoff.pubkey_b64),
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify'],
        )
        const ok = await subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          b64decode(signoff.signature_b64),
          te.encode(doc.manifest_sha256),
        )
        check('signoff signature', ok, `signer_class=${signoff.signer_class}`)
      } catch (e) {
        check('signoff signature', false, e.message)
      }
    }
  } else {
    // Truthful unsigned: manifest hash only. Reported, not failed.
    check('signoff signature', true, 'unsigned packet — manifest hash only (truthful no-signature state)')
  }

  return done()
}

// --- CLI ---------------------------------------------------------------------

function print(r) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
}

function finish(results) {
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${failed.length === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('usage: node verify-packet.mjs <packet-export.json> | -')
    process.exit(2)
  }
  let raw
  try {
    raw = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8')
  } catch (e) {
    const r = { name: 'read input', pass: false, detail: e.message }
    print(r)
    return finish([r])
  }
  const { checks } = await verifyPacketText(raw)
  for (const r of checks) print(r)
  finish(checks)
}

function isMain() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) {
  main().catch((e) => {
    console.error(`FAIL — verifier error: ${e.message}`)
    process.exit(1)
  })
}
