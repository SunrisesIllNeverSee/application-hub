// VENDORED from aqua-companion/src/history.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// M09b — `aqua-companion import-history <folder>` and the agent tool
// `import_history`: batch-stage the user's ALREADY SUBMITTED applications as
// history records for the browser's "Confirm submitted history" screen.
//
// Each answered application becomes, in the workspace (encrypted, staging):
//   - an app_instance (history: true) whose template keeps the exact question
//     wording, plus an encrypted copy of the source file;
//   - per answered question, an answer + a version (method 'imported',
//     history: true, history_meta = aqua-local/history.ts HistoryMeta).
// export-backup carries them to the browser as staged answers flagged
// `history: true` (history_meta travels encrypted as history_enc). Nothing
// here approves anything: the user confirms submitted answers in the browser,
// and the vault refuses placeholders and hash mismatches itself.

import fs from 'node:fs'
import path from 'node:path'
import { canonicalJson, newUuid, nowIso, sha256Hex } from './crypto.mjs'
import { normalizeRel, readInside, resolveInside, walkInside } from './fsafe.mjs'
import { confirmPlan, out, UsageError } from './io.mjs'
import { openUnlocked, prepareLocalApplication } from './commands.mjs'
import { rid } from './workspace.mjs'
import { HISTORY_EXTENSIONS, MAX_HISTORY_FILE_BYTES, parseHistoryFile } from './history-parse.mjs'
import { HISTORY_FORMAT } from '../vendor/lib/aqua-local/history.mjs'

export const HISTORY_IMPORTER = 'aqua-companion import-history'
const MAX_FILES = 200
const HISTORY_PROVENANCE = 'imported submitted history (aqua-companion import-history); confirm it as submitted in the browser'

export class HistoryImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'HistoryImportError'
    this.code = code
  }
}

const isHistoryFile = (name) => HISTORY_EXTENSIONS.includes(path.extname(name).slice(1).toLowerCase()) && !path.basename(name).startsWith('.')

/** Keyed (workspace MAC) marker of an imported source file: re-imports are skipped without a plaintext hash in the index. */
async function sourceMarker(ws, sha) {
  return ws.contentMac({ history_source_sha256: sha })
}

/**
 * Parse files [{ name, rel, bytes }] and build (not write) the staged records.
 * Returns { plan, files: [per-file report], lines }.
 */
export async function prepareHistoryImport(ws, files, { date = null, program = null, now = new Date() } = {}) {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HistoryImportError('invalid_date', '--date must be YYYY-MM-DD.')
  const seen = new Set(Object.values(ws.records).filter((e) => e.history_source_mac && e.status !== 'archived').map((e) => e.history_source_mac))
  const reports = []
  const plan = []
  const importedAt = nowIso()
  for (const f of files) {
    if (f.tooLarge) {
      reports.push({ file: f.rel, status: 'skipped', reason: 'too_large', message: 'The file is larger than 5 MB.' })
      continue
    }
    const parsed = await parseHistoryFile({ name: f.name, bytes: f.bytes, date, program, now })
    if (!parsed.ok) {
      reports.push({ file: f.rel, status: 'skipped', reason: parsed.error, message: parsed.message })
      continue
    }
    const marker = await sourceMarker(ws, parsed.source_sha256)
    if (seen.has(marker)) {
      reports.push({ file: f.rel, status: 'skipped', reason: 'already_imported', source_sha256: parsed.source_sha256 })
      continue
    }
    if (!parsed.pairs.length) {
      reports.push({ file: f.rel, status: 'skipped', reason: 'no_answers', message: 'No answered questions were found (questions need an answer below them, Q:/A: pairs, or question/answer columns).', source_sha256: parsed.source_sha256 })
      continue
    }
    seen.add(marker)
    const questions = [...parsed.pairs.map((p) => p.question), ...parsed.unanswered]
    const prepared = await prepareLocalApplication({
      template: { title: parsed.program, org: parsed.organization ?? '', questions: questions.map((text) => ({ text })) },
      file_name: f.name,
      media_type: `aqua/${parsed.format}`,
      bytes_sha256: parsed.source_sha256,
      text: parsed.text,
      template_extra: { history: { submitted_at: parsed.submitted_at, date_source: parsed.date_source, flags: parsed.flags, source_sha256: parsed.source_sha256 } },
      source_extra: { history: true, parser: 'aqua-companion history-parse (vendored app/lib/catalog)' },
    })
    prepared.instance.history = true
    const qrefs = prepared.instance.local_template.questions
    const items = []
    for (const [i, p] of parsed.pairs.entries()) {
      const q = qrefs[i]
      const answer = { id: newUuid(), scope: { application_id: prepared.instance.application_id, question_occurrence_id: q.question_occurrence_id }, created_at: importedAt }
      const title = `Submitted answer: ${p.question.slice(0, 80)}`
      const history_meta = {
        format: HISTORY_FORMAT, program: parsed.program, question: p.question, submitted_at: parsed.submitted_at, date_source: parsed.date_source,
        flags: parsed.flags, source_sha256: parsed.source_sha256, source_file: f.name,
        placeholder: { found: p.placeholders.length > 0, markers: p.placeholders }, imported_at: importedAt, importer: HISTORY_IMPORTER,
        parse_confidence: p.parse_confidence, parse_notes: p.parse_notes,
      }
      const version = {
        id: newUuid(), answer_id: answer.id, parent_version_id: null, title, body: p.answer,
        sha256: await sha256Hex(canonicalJson({ title, body: p.answer })), method: 'imported', provenance: HISTORY_PROVENANCE,
        created_at: importedAt, immutable: true, history: true, history_meta,
      }
      items.push({ answer, version, placeholders: p.placeholders, parse_confidence: p.parse_confidence, parse_notes: p.parse_notes })
    }
    plan.push({ file: f, parsed, prepared, items, marker })
    reports.push({
      file: f.rel, status: 'staged', instance_id: prepared.instance.instance_id, source_sha256: parsed.source_sha256,
      submitted_at: parsed.submitted_at, date_source: parsed.date_source, flags: parsed.flags, program_source: parsed.program_source,
      answered: parsed.pairs.length, unanswered: parsed.unanswered.length,
      with_placeholders: items.filter((x) => x.placeholders.length).length,
      parse_confidence: parsed.parse_confidence,
      low_confidence: items.filter((x) => x.parse_confidence === 'low').length,
      records: items.map((x) => ({ version_id: x.version.id, parse_confidence: x.parse_confidence, parse_notes: x.parse_notes, placeholders: x.placeholders.length > 0 })),
      version_ids: items.map((x) => x.version.id),
      // file-derived text: callers put this under untrusted_content
      program: parsed.program,
      questions: items.map((x) => ({ version_id: x.version.id, question: x.version.history_meta.question, placeholders: x.placeholders, parse_confidence: x.parse_confidence })),
    })
  }
  const staged = reports.filter((r) => r.status === 'staged')
  const lines = [
    `stage ${staged.length} answered application(s) with ${staged.reduce((n, r) => n + r.answered, 0)} submitted answer(s) as history records (private, encrypted)`,
    `submission dates: ${staged.filter((r) => r.submitted_at).length} known, ${staged.filter((r) => !r.submitted_at).length} UNKNOWN (flagged; never guessed)`,
    `${staged.reduce((n, r) => n + r.with_placeholders, 0)} answer(s) contain unfilled placeholders and can never be confirmed until fixed`,
    `${staged.reduce((n, r) => n + r.low_confidence, 0)} answer(s) were split with LOW confidence: check the question and answer text against what you submitted; the browser asks you to review them before they can be confirmed`,
    `${reports.length - staged.length} file(s) skipped`,
    'nothing is approved: after export-backup and Restore, you confirm submitted answers in the browser (Confirm submitted history)',
  ]
  return { plan, reports, lines }
}

export async function commitHistoryImport(ws, plan, { via = 'cli' } = {}) {
  for (const p of plan) {
    const { instance, source } = p.prepared
    ws.records[rid('app_instance', instance.instance_id)] = await ws.writeRecord({ kind: 'app_instance', key: instance.instance_id, authority: 'staging', data: instance, extra: { local_only: true, history: true, history_source_mac: p.marker } })
    ws.records[rid('source_document', source.source_id)] = await ws.writeRecord({ kind: 'source_document', key: source.source_id, authority: 'staging', data: source, extra: { history: true } })
    for (const it of p.items) {
      ws.records[rid('answer', it.answer.id)] = await ws.writeRecord({ kind: 'answer', key: it.answer.id, authority: 'staging', data: it.answer, extra: { history: true } })
      ws.records[rid('version', it.version.id)] = await ws.writeRecord({ kind: 'version', key: it.version.id, authority: 'staging', data: it.version, extra: { history: true } })
    }
  }
  await ws.saveManifest()
  await ws.audit('import_history', {
    applications: plan.length, versions: plan.reduce((n, p) => n + p.items.length, 0),
    unknown_dates: plan.filter((p) => !p.parsed.submitted_at).length,
    with_placeholders: plan.reduce((n, p) => n + p.items.filter((x) => x.placeholders.length).length, 0),
    ...(via !== 'cli' ? { via } : {}),
  })
}

/** Files of a folder inside the workspace (confined; symlinks refused). */
export function inboxFolderFiles(ws, folder) {
  let rel
  try {
    rel = normalizeRel(String(folder ?? '').replace(/\/+$/, '') || 'inbox')
  } catch (e) {
    throw new HistoryImportError('path_refused', `Path refused (${e.message}). Pass a folder inside the workspace inbox/ folder.`)
  }
  if (rel !== 'inbox' && !rel.startsWith('inbox/')) {
    if (rel.includes('/')) throw new HistoryImportError('path_refused', 'Only folders inside the workspace inbox/ folder can be imported. Ask the user to copy the submitted applications into inbox/<folder>/.')
    rel = `inbox/${rel}`
  }
  let abs
  try {
    abs = resolveInside(ws.root, rel)
  } catch (e) {
    throw new HistoryImportError('path_refused', `Path refused (${e.message}).`)
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new HistoryImportError('not_found', `No folder ${rel} in the workspace. Ask the user to place the submitted applications in it.`)
  const walked = walkInside(ws.root, rel)
  const names = walked.files.filter(isHistoryFile)
  if (names.length > MAX_FILES) throw new HistoryImportError('too_many_files', `More than ${MAX_FILES} files; import the folder in smaller batches.`)
  const files = []
  for (const r of names) {
    const bytes = readInside(ws.root, r)
    if (bytes.length > MAX_HISTORY_FILE_BYTES) {
      files.push({ name: path.posix.basename(r), rel: r, bytes: new Uint8Array(0), tooLarge: true })
      continue
    }
    files.push({ name: path.posix.basename(r), rel: r, bytes: new Uint8Array(bytes) })
  }
  return { rel, files, skipped_symlinks: walked.symlinks.length, other_files: walked.files.length - names.length }
}

/** Files of a user folder (CLI). Symlinks are skipped, not followed. */
function userFolderFiles(ctx, folder) {
  const abs = path.resolve(ctx.cwd, folder)
  let st
  try {
    st = fs.lstatSync(abs)
  } catch {
    throw new UsageError(`No folder at ${folder}.`)
  }
  if (!st.isDirectory()) throw new UsageError(`${folder} is not a folder.`)
  const files = []
  const visit = (dir, depth) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory() && depth < 3) visit(p, depth + 1)
      else if (e.isFile() && isHistoryFile(e.name)) {
        if (files.length >= MAX_FILES) throw new UsageError(`More than ${MAX_FILES} files; import the folder in smaller batches.`)
        const size = fs.statSync(p).size
        files.push({ name: e.name, rel: path.relative(abs, p).split(path.sep).join('/'), bytes: size > MAX_HISTORY_FILE_BYTES ? new Uint8Array(0) : new Uint8Array(fs.readFileSync(p)), tooLarge: size > MAX_HISTORY_FILE_BYTES })
      }
    }
  }
  visit(abs, 0)
  files.sort((a, b) => a.rel.localeCompare(b.rel))
  return files
}

export async function cmdImportHistory(ctx, folder) {
  if (!folder) throw new UsageError('Usage: aqua-companion import-history <folder> [--date YYYY-MM-DD] [--program NAME]')
  const ws = await openUnlocked(ctx)
  const files = userFolderFiles(ctx, folder)
  if (!files.length) throw new UsageError(`No .md, .txt, .docx, .html, .json or .csv files in ${folder}.`)
  let prepared
  try {
    prepared = await prepareHistoryImport(ws, files, { date: ctx.flags.date ?? null, program: ctx.flags.program ?? null })
  } catch (e) {
    if (e instanceof HistoryImportError) throw new UsageError(e.message)
    throw e
  }
  out(ctx, `Read ${files.length} file(s) from ${folder} (exact wording kept; check the extraction before you rely on it):`)
  for (const r of prepared.reports) {
    if (r.status !== 'staged') {
      out(ctx, `  - ${r.file}: skipped (${r.reason})`)
      continue
    }
    const date = r.submitted_at ? `${r.submitted_at} (from ${r.date_source})` : 'UNKNOWN (use --date YYYY-MM-DD)'
    out(ctx, `  - ${r.file}: ${r.program} | submitted ${date} | ${r.answered} answer(s)${r.with_placeholders ? `, ${r.with_placeholders} with placeholders` : ''}${r.flags.length ? ` | flags: ${r.flags.join(', ')}` : ''}`)
    for (const q of r.questions) out(ctx, `      ${q.placeholders.length ? '!' : '*'} ${q.question}${q.parse_confidence === 'low' ? '  [low parse confidence: check the text]' : ''}`)
  }
  if (!prepared.plan.length) {
    out(ctx, 'Nothing to stage.')
    return 0
  }
  if (!(await confirmPlan(ctx, 'stage submitted applications as history records', prepared.lines))) return 0
  await commitHistoryImport(ws, prepared.plan)
  out(ctx, `Staged ${prepared.plan.length} application(s). Next: "aqua-companion export-backup <file>", Restore it in the browser, then open Confirm submitted history (/history).`)
  return 0
}
