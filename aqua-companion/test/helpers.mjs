// Shared test helpers. All filesystem work happens in fresh scratch folders
// under SCRATCH_BASE (never in a home folder). All fixture content is
// synthetic.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { main } from '../src/cli.mjs'

// Local runs use /private/tmp/claude-501 (macOS); CI (Linux) uses the OS temp dir.
export const SCRATCH_BASE = process.env.AQUA_COMPANION_TEST_DIR ??
  (fs.existsSync('/private/tmp') ? '/private/tmp/claude-501/aqua-companion-tests' : path.join(os.tmpdir(), 'aqua-companion-tests'))
export const PASS = 'synthetic-workspace-pass-7Q4x'
export const VAULT = 'synthetic-vault-secret-9Z2k'
export const MARK = 'ZQX-SYNTHETIC-PRIVATE-MARKER'
export const ACCOUNT = 'synthetic-user-0001@example.invalid'

export function scratch(label = 't') {
  fs.mkdirSync(SCRATCH_BASE, { recursive: true })
  return fs.realpathSync(fs.mkdtempSync(path.join(SCRATCH_BASE, `${label}-`)))
}

function sink() {
  let buf = ''
  return { write: (s) => { buf += s; return true }, get text() { return buf } }
}

/** Run the CLI in-process. stdin is never a TTY here (consent needs --yes). */
export async function run(argv, { env = {}, cwd = SCRATCH_BASE } = {}) {
  const stdout = sink()
  const stderr = sink()
  const code = await main(argv, {
    env: { AQUA_PASSPHRASE: PASS, AQUA_VAULT_SECRET: VAULT, AQUA_CATALOG_OFFLINE: '1', ...env }, // tests never reach aquaidp.xyz
    cwd,
    stdin: { isTTY: false },
    stdout,
    stderr,
  })
  return { code, out: stdout.text, err: stderr.text }
}

export async function initWorkspace(dir, extraEnv = {}) {
  const r = await run(['init', '--path', dir, '--yes'], { env: extraEnv })
  if (r.code !== 0) throw new Error(`init failed: ${r.err}`)
  return path.join(dir, 'AQUA')
}

export function readManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'workspace.json'), 'utf8'))
}

/** Every byte of every file under dir, concatenated (for leak checks). */
export function allBytes(dir) {
  const chunks = []
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) visit(p)
      else if (e.isFile()) chunks.push(fs.readFileSync(p))
    }
  }
  visit(dir)
  return Buffer.concat(chunks)
}

export function writeFile(dir, name, content) {
  const p = path.join(dir, name)
  fs.writeFileSync(p, content)
  return p
}

// ---------------------------------------------------------------------------
// The app's real vault modules, loaded with Node type stripping.
// ---------------------------------------------------------------------------
const APP = new URL('../../app/lib/aqua-local/', import.meta.url)
let appCache = null
export async function loadApp() {
  if (appCache) return appCache
  const mods = await Promise.all(
    ['vault', 'repo', 'backup', 'crypto', 'instances', 'knowledge', 'review-ledger', 'packets', 'signoff', 'catalog', 'status']
      .map((m) => import(new URL(`${m}.ts`, APP).href)),
  )
  appCache = Object.assign({}, ...mods)
  return appCache
}

/**
 * Build a synthetic browser vault with every v5 store populated, an approved
 * version, and a frozen + signed-off packet. Returns ids and the exported
 * backup envelope text.
 */
export async function buildVault() {
  const app = await loadApp()
  const s = app.createMemoryStorage()
  const inst = await app.createAppInstance(s, VAULT, {
    source: { kind: 'paste', ref: 'synthetic-form.txt' },
    local_template: {
      title: 'Synthetic Fellowship',
      org: 'Example Org',
      questions: [
        { text: 'What are you building? (150 words)', word_limit: 150, required: true },
        { text: 'Why now?', required: false },
      ],
    },
  })
  const tpl = JSON.parse(await app.decryptField(VAULT, inst.local_template_enc))
  const q1 = tpl.questions[0].question_occurrence_id
  const q2 = tpl.questions[1].question_occurrence_id
  const answer = await app.createAnswer(s, { application_id: inst.application_id, question_occurrence_id: q1 })
  const version = await app.createVersion(s, VAULT, { answer_id: answer.id, title: 'Synthetic answer', body: `We build a synthetic widget. ${MARK}`, method: 'manual' })
  const approval = await app.recordHumanApproval(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: 'u-test', via: 'review_ui' })
  const evidence = await app.addEvidence(s, VAULT, { kind: 'note', title: `Synthetic note ${MARK}`, excerpt: 'Synthetic excerpt', links: [{ target_kind: 'version', target_id: version.id }] })
  const comment = await app.addComment(s, VAULT, { version_id: version.id, body: `Synthetic comment ${MARK}`, actor_class: 'human', actor_id: 'u-test' })
  await app.recordReviewDecision(s, VAULT, { version_id: version.id, expected_sha256: version.sha256, decision: 'help_requested', rationale: 'synthetic', actor_class: 'human', actor_id: 'u-test' })
  await app.recordSuggestion(s, VAULT, { question_occurrence_id: q1, kind: 'recommendation', candidate_version_id: version.id, explanation: 'synthetic suggestion' })
  await app.createFact(s, VAULT, { kind: 'organization', key: 'org.name', value: 'Example Org' })
  const { packet, record } = await app.freezeApplicationPacket(s, VAULT, {
    application_id: inst.application_id,
    selections: [{ question_occurrence_id: q1, version_id: version.id, question_text_snapshot: 'What are you building?' }],
  })
  const signoff = await app.attestPacket(s, { packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true, manifest_sha256: record.manifest_sha256 })
  await app.putCatalog(s, 'program:synthetic-1', { name: 'Synthetic Program', public: true })
  await app.putCatalog(s, 'question:synthetic-q1', { text: 'What are you building?' })
  await app.putCatalog(s, 'misc:unknown-shape', { note: 'unclassified cache entry' })
  const envelope = await app.exportVault(s, VAULT)
  return { app, storage: s, inst, q1, q2, answer, version, approval, evidence, comment, packet, signoff, envelope }
}

/** Decrypt an envelope with the app, mutate its payload, re-encrypt with the app. */
export async function mutateEnvelope(envelopeText, fn) {
  const app = await loadApp()
  const env = JSON.parse(envelopeText)
  const payload = JSON.parse(await app.decryptText(VAULT, env))
  fn(payload)
  const blob = await app.encryptText(VAULT, app.canonicalJson(payload))
  return JSON.stringify({ format: 'aqua-local-backup', ...blob })
}
