// VENDORED from application-hub-mcp-server/src/vendor/companion/src/mcp-model.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/src/mcp-model.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// In-memory model of a workspace for the agent interface: decrypts the
// records it needs (workspace key + vault secret for vault `*_enc` fields),
// normalizes projections and staged records into the vault's view shapes, and
// derives per-question rows exactly like app/lib/aqua-local-client/review.ts
// listInstanceQuestions / review-ui/load.ts loadCard, but with the vendored
// pure modules (status.ts, classify.ts, view-model.ts). Read-only: nothing
// here writes. Decrypted text lives only in this process's memory.

import { decryptField, sha256Hex, canonicalJson } from './crypto.mjs'
import { normalizeVaultRecord } from './vault.mjs'
import { splitRid } from './workspace.mjs'
import { approvalGate, deriveQuestionStatus } from '../vendor/lib/aqua-local/status.mjs'
import { classifyReuse } from '../vendor/lib/aqua-local/classify.mjs'
import { buildCardViewModel } from '../vendor/lib/review-ui/view-model.mjs'

const DEAD = new Set(['archived', 'missing', 'tombstoned'])

/** Per-process cache of vault-field plaintext keyed by ciphertext (PBKDF2 per field is slow). */
const fieldCache = new Map()

async function field(secret, enc) {
  if (typeof enc !== 'string') return null
  const k = `${secret.length}:${enc}`
  if (fieldCache.has(k)) return fieldCache.get(k)
  const v = await decryptField(secret, enc)
  if (fieldCache.size > 5000) fieldCache.clear()
  fieldCache.set(k, v)
  return v
}

function sortVersions(vs) {
  return [...vs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/**
 * Load every live record the agent tools need. Returns the model; records
 * that cannot be decrypted (for example under another vault secret) are
 * counted in `undecryptable`, never guessed.
 */
export async function loadModel(ws, vaultSecret) {
  const m = {
    instances: new Map(), answers: [], versions: [], approvals: [], reviews: [], review_notes: {}, suggestions: [],
    evidence: [], facts: [], comments: [], provenance: {}, packets: [], packet_states: {}, sources: new Map(),
    observations: [], evidence_requests: [], undecryptable: 0,
    links: [], question_marks: [], question_notes: [], question_adds: [], assembles: [],
    last_import: ws.manifest.imports.at(-1) ?? null,
  }
  const factRows = []
  for (const [r, e] of Object.entries(ws.records)) {
    if (DEAD.has(e.status) || r.includes('#')) continue
    const kind = e.kind
    if (!['app_instance', 'answer', 'version', 'approval', 'review', 'suggestion', 'evidence', 'fact', 'comment', 'provenance', 'packet', 'packet_state', 'source_document', 'evidence_request', 'submission_observation', 'link', 'question_mark', 'question_note', 'question_add', 'assemble'].includes(kind)) continue
    let data
    try {
      data = (await ws.decodeEntry(r)).data
    } catch {
      m.undecryptable++
      continue
    }
    const proj = e.authority === 'projection'
    const meta = { rid: r, authority: e.authority, record_status: e.status }
    try {
      switch (kind) {
        case 'app_instance': {
          const n = proj ? await normalizeVaultRecord('app_instance', data, vaultSecret) : data
          m.instances.set(n.instance_id, { ...meta, instance_id: n.instance_id, application_id: n.application_id, program_id: n.program_id ?? null, cycle_id: n.cycle_id ?? null, question_refs: n.question_refs ?? [], template: n.local_template ?? null, source_kind: n.source?.kind ?? null, history: e.history === true || n.history === true || Boolean(n.local_template?.history), created_at: n.created_at })
          break
        }
        case 'answer':
          m.answers.push({ ...data, ...meta })
          break
        case 'version': {
          const n = proj ? await normalizeVaultRecord('version', data, null) : data
          m.versions.push({ ...n, ...meta })
          break
        }
        case 'approval':
          if (proj) m.approvals.push(data) // approvals only ever come from the browser vault
          break
        case 'review':
          if (!proj) break
          m.reviews.push(data)
          if (data.rationale_enc) {
            try {
              m.review_notes[data.review_id] = await field(vaultSecret, data.rationale_enc)
            } catch {
              m.review_notes[data.review_id] = null
            }
          }
          break
        case 'suggestion': {
          if (!proj) break
          const { explanation_enc, weaknesses_enc, unsupported_claims_enc, ...rest } = data
          m.suggestions.push({
            ...rest,
            explanation: (await field(vaultSecret, explanation_enc)) ?? '',
            weaknesses: weaknesses_enc ? await field(vaultSecret, weaknesses_enc) : null,
            unsupported_claims: unsupported_claims_enc ? await field(vaultSecret, unsupported_claims_enc) : null,
          })
          break
        }
        case 'evidence': {
          const n = proj ? await normalizeVaultRecord('evidence', data, vaultSecret) : data
          m.evidence.push({ excerpt: null, url: null, freshness_checked_at: null, links: [], ...n, ...meta })
          break
        }
        case 'fact':
          if (proj) factRows.push({ ...data, value: await field(vaultSecret, data.value_enc) })
          break
        case 'comment': {
          const n = proj ? await normalizeVaultRecord('comment', data, vaultSecret) : data
          m.comments.push({ seq: 0, ...n, ...meta })
          break
        }
        case 'provenance':
          m.provenance[data.version_id] = { provider: data.provider ?? null, model: data.model ?? null }
          break
        case 'packet': {
          let version_ids = []
          let manifest_readable = false
          try {
            const manifest = JSON.parse(data.manifest_enc ? await field(vaultSecret, data.manifest_enc) : data.manifest_json)
            version_ids = (manifest.questions ?? []).map((q) => q.version_id).filter(Boolean)
            manifest_readable = true
          } catch {
            // cannot prove inclusion -> omitted, like packetVersionIds()
          }
          m.packets.push({ id: data.id, application_id: data.application_id, manifest_sha256: data.manifest_sha256, frozen_at: data.frozen_at, version_ids, manifest_readable })
          break
        }
        case 'packet_state':
          m.packet_states[data.packet_id] = data.state
          break
        case 'source_document':
          m.sources.set(data.instance_id, { ...data, rid: r })
          break
        case 'evidence_request':
          m.evidence_requests.push({ ...data, rid: r })
          break
        case 'submission_observation':
          m.observations.push({ ...data, rid: r })
          break
        case 'link':
          m.links.push({ ...data, rid: r, created_at: data.created_at })
          break
        case 'question_mark':
          m.question_marks.push({ ...data, rid: r })
          break
        case 'question_note':
          m.question_notes.push({ ...data, rid: r })
          break
        case 'question_add':
          m.question_adds.push({ ...data, rid: r })
          break
        case 'assemble':
          m.assembles.push({ ...data, rid: r })
          break
      }
    } catch {
      m.undecryptable++
    }
  }
  // User-added questions behave like extracted ones: fold them into each
  // instance's question_refs + template metadata so questionRows produces a
  // real row (linkable, markable, classifiable, assemblable). Staged records
  // never rewrite the captured wording of extracted questions.
  for (const add of m.question_adds) {
    const inst = m.instances.get(add.instance_id)
    if (!inst || !inst.template) continue
    if (!inst.question_refs.some((q) => q.question_occurrence_id === add.question_occurrence_id)) {
      inst.question_refs.push({ question_occurrence_id: add.question_occurrence_id, canonical_question_id: null, order: add.order ?? null })
    }
    inst.template.questions ??= []
    if (!inst.template.questions.some((q) => q.question_occurrence_id === add.question_occurrence_id)) {
      const lim = typeof add.limit === 'string' ? add.limit.trim() : ''
      const wordM = /^words:(\d+)$/i.exec(lim)
      const charM = /^chars:(\d+)$/i.exec(lim)
      inst.template.questions.push({
        question_occurrence_id: add.question_occurrence_id, text: add.text, source: 'user_added',
        required: add.required === 'required' ? true : add.required === 'unknown' ? null : false,
        word_limit: wordM ? Number(wordM[1]) : null, char_limit: charM ? Number(charM[1]) : null,
        options: add.options ?? null, section_id: add.group ?? null,
      })
    }
  }
  // update_question annotations correct the EFFECTIVE question metadata (never
  // the captured wording): latest note per question overlays required, limits,
  // options and group onto the template so status/packet paths see the fix.
  // Per-field last-wins across ALL notes in time order — a later partial
  // correction must not silently revert an earlier one (each call only sets
  // the fields it was given).
  const noteByOcc = new Map()
  const sortedNotes = [...m.question_notes].sort((a, b) => (`${a.created_at ?? ''}${a.rid ?? ''}`).localeCompare(`${b.created_at ?? ''}${b.rid ?? ''}`))
  for (const n of sortedNotes) {
    const key = `${n.instance_id}:${n.question_occurrence_id}`
    const acc = noteByOcc.get(key) ?? {}
    for (const [f, v] of Object.entries(n)) if (v !== null && v !== undefined) acc[f] = v
    noteByOcc.set(key, acc)
  }
  m.note_overlay = noteByOcc
  for (const n of noteByOcc.values()) {
    const inst = m.instances.get(n.instance_id)
    const q = inst?.template?.questions?.find((x) => x.question_occurrence_id === n.question_occurrence_id)
    if (!q) continue
    if (n.required === 'required') q.required = true
    else if (n.required === 'optional') q.required = false
    else if (n.required === 'unknown') q.required = null
    if (typeof n.limit === 'string' && n.limit.trim()) {
      const lim = n.limit.trim()
      const wm = /^words:(\d+)$/i.exec(lim), cm = /^chars:(\d+)$/i.exec(lim)
      if (wm) { q.word_limit = Number(wm[1]); q.char_limit = null }
      else if (cm) { q.char_limit = Number(cm[1]); q.word_limit = null }
      // unrecognized formats leave prior limits untouched
    }
    if (typeof n.options === 'string' && n.options.trim()) q.options = n.options.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    else if (n.options === '') q.options = null
    if (typeof n.group === 'string') q.section_id = n.group.trim() || null
    if (n.summary) q.annotation_summary = n.summary
    if (n.kind) q.annotation_kind = n.kind
    if (n.topic) q.annotation_topic = n.topic
  }
  // current fact versions: newest per fact_id; a retracted tombstone hides the fact
  const byFact = new Map()
  for (const f of factRows) {
    const prev = byFact.get(f.fact_id)
    if (!prev || f.created_at.localeCompare(prev.created_at) > 0) byFact.set(f.fact_id, f)
  }
  for (const f of byFact.values()) {
    if (f.retracted) continue
    m.facts.push({ fact_id: f.fact_id, fact_version_id: f.fact_version_id, kind: f.kind, key: f.key, value: f.value ?? '', supersedes: f.supersedes ?? null, evidence_ids: f.evidence_ids ?? [], created_at: f.created_at, method: f.method, retracted: false })
  }
  return m
}

/** Find an instance by instance id or application id. */
export function findInstanceIn(model, id) {
  if (model.instances.has(id)) return model.instances.get(id)
  for (const i of model.instances.values()) if (i.application_id === id) return i
  return null
}

/** Evidence ids attached to a version: version.evidence_ids ∪ evidence links (knowledge.ts evidenceIdsFor). */
export function evidenceIdsFor(model, versionId) {
  const ids = new Set()
  for (const e of model.evidence) if ((e.links ?? []).some((l) => l.target_kind === 'version' && l.target_id === versionId)) ids.add(e.evidence_id)
  const v = model.versions.find((x) => x.id === versionId)
  for (const id of v?.evidence_ids ?? []) ids.add(id)
  return [...ids]
}

/** Agent evidence requests behave like evidence_gap suggestions for status (advisory, workspace-only). */
function requestSuggestions(model, inst, occ) {
  return model.evidence_requests
    .filter((r) => r.question_occurrence_id === occ && r.instance_id === inst.instance_id)
    .map((r) => ({ suggestion_id: r.request_id, question_occurrence_id: occ, instance_id: inst.instance_id, kind: 'evidence_gap', classification: 'gap', candidate_version_id: r.version_id ?? null, created_at: r.created_at, workspace_only: true }))
}

/** The question list of an instance: local template, or the catalog program's occurrences. */
export function instanceQuestions(inst, catalog) {
  if (inst.template?.questions?.length) {
    const byId = new Map(inst.template.questions.map((q) => [q.question_occurrence_id, q]))
    return inst.question_refs.map((ref) => ({ ref, meta: byId.get(ref.question_occurrence_id) ?? null, cat: null }))
  }
  const program = catalog?.programs.find((p) => p.id === inst.program_id) ?? null
  const byOcc = new Map((program?.questions ?? []).map((q) => [q.id, q]))
  return inst.question_refs.map((ref) => {
    const q = byOcc.get(ref.question_occurrence_id)
    return {
      ref, meta: null,
      cat: q ? { text: q.asked_as, canonical_question_id: q.archived_question_id, word_limit: q.word_limit, char_limit: q.char_limit, required: q.is_required, section_id: q.section } : null,
    }
  })
}

export function contextOf(inst, catalog) {
  const t = inst.template
  const program = catalog?.programs.find((p) => p.id === inst.program_id) ?? null
  return {
    program_name: t?.title ?? program?.name ?? null,
    org_name: t?.org || program?.organization || null,
    deadline: t?.deadline ?? program?.deadline_at ?? program?.closes_at ?? null,
    cycle_year: t?.cycle_year ?? null,
  }
}

/** Board rows for one instance (listInstanceQuestions over the workspace model). */
export function questionRows(model, inst, { catalog = null, now, classify = true } = {}) {
  const context = contextOf(inst, catalog)
  const packetVersionIds = new Set(model.packets.filter((p) => p.application_id === inst.application_id).flatMap((p) => p.version_ids))
  // occurrence wording + program names across the workspace (for reuse candidates)
  const occIndex = new Map()
  const programByApp = new Map()
  for (const other of model.instances.values()) {
    for (const { ref, meta, cat } of instanceQuestions(other, catalog)) {
      occIndex.set(ref.question_occurrence_id, { text: meta?.text ?? cat?.text ?? null, canonical: ref.canonical_question_id ?? meta?.canonical_question_id ?? cat?.canonical_question_id ?? null })
    }
    const c = contextOf(other, catalog)
    programByApp.set(other.application_id, { program: c.program_name, org: c.org_name })
  }
  const known = new Set()
  for (const [app, p] of programByApp) {
    if (app === inst.application_id) continue
    if (p.program) known.add(p.program)
    if (p.org) known.add(p.org)
  }
  for (const n of [context.program_name, context.org_name]) if (n) known.delete(n)

  const versionsByAnswer = new Map()
  for (const v of model.versions) versionsByAnswer.set(v.answer_id, [...(versionsByAnswer.get(v.answer_id) ?? []), v])
  const pool = []
  for (const a of model.answers) {
    const vs = sortVersions(versionsByAnswer.get(a.id) ?? [])
    const latest = vs.at(-1)
    if (!latest || !a.scope) continue
    const approvedLatest = [...vs].reverse().find((v) => approvalGate(v, model.approvals, model.reviews).approved)
    const picks = new Map([[latest.id, latest]])
    if (approvedLatest) picks.set(approvedLatest.id, approvedLatest)
    for (const v of picks.values()) {
      const occ = occIndex.get(a.scope.question_occurrence_id)
      const prog = programByApp.get(a.scope.application_id)
      pool.push({
        answer_id: a.id,
        candidate: {
          version_id: v.id, version_sha256: v.sha256, body: v.body, title: v.title, question_text: occ?.text ?? null, scope: a.scope,
          canonical_question_id: occ?.canonical ?? null, approved: approvalGate(v, model.approvals, model.reviews).approved,
          created_at: v.created_at, program_name: prog?.program ?? null, org_name: prog?.org ?? null, evidence_ids: evidenceIdsFor(model, v.id),
        },
      })
    }
  }

  const rows = []
  for (const { ref, meta, cat } of instanceQuestions(inst, catalog)) {
    const occ = ref.question_occurrence_id
    const scope = { application_id: inst.application_id, question_occurrence_id: occ }
    const scoped = model.answers.filter((a) => a.scope?.application_id === scope.application_id && a.scope?.question_occurrence_id === occ)
    const scopedIds = new Set(scoped.map((a) => a.id))
    const vs = sortVersions(model.versions.filter((v) => scopedIds.has(v.answer_id)))
    const sugg = [
      ...model.suggestions.filter((s) => s.question_occurrence_id === occ && (!s.instance_id || s.instance_id === inst.instance_id)),
      ...requestSuggestions(model, inst, occ),
    ]
    const governing = vs.at(-1)
    const evidence_ids = governing ? evidenceIdsFor(model, governing.id) : []
    const status = deriveQuestionStatus({ versions: vs, approvals: model.approvals, reviews: model.reviews, suggestions: sugg, packet_version_ids: packetVersionIds, governing_evidence_ids: evidence_ids })
    const text = meta?.text ?? cat?.text ?? null
    const canonical = ref.canonical_question_id ?? meta?.canonical_question_id ?? cat?.canonical_question_id ?? null
    const word_limit = meta?.word_limit ?? cat?.word_limit ?? null
    const char_limit = meta?.char_limit ?? cat?.char_limit ?? null
    let classification = null
    if (classify && text) {
      classification = classifyReuse(
        { text, canonical_question_id: canonical, word_limit, char_limit, program_name: context.program_name, org_name: context.org_name, cycle_year: context.cycle_year, deadline: context.deadline },
        pool.filter((p) => !scopedIds.has(p.answer_id)).map((p) => p.candidate),
        { known_program_names: [...known], now },
      )
    }
    rows.push({
      question_occurrence_id: occ, canonical_question_id: canonical, text, word_limit, char_limit,
      required: meta && meta.required !== undefined ? meta.required : (cat?.required ?? false), section_id: meta?.section_id ?? cat?.section_id ?? null, options: meta?.options ?? cat?.options ?? null, order: ref.order,
      scope, answer_id: scoped[0]?.id ?? null, versions: vs, status, classification, evidence_ids, suggestions: sugg,
    })
  }
  return { context: { ...context, known_program_names: [...known] }, rows: rows.sort((a, b) => a.order - b.order) }
}

/** One review card view-model (review-ui/load.ts loadCard over the workspace model). */
export function cardFor(model, inst, row, context, now) {
  const versions = row.versions
  const ids = new Set(versions.map((v) => v.id))
  const governing = versions.at(-1) ?? null
  const approvals = model.approvals.filter((a) => ids.has(a.version_id))
  const reviews = model.reviews.filter((r) => ids.has(r.version_id))
  const review_notes = {}
  for (const r of reviews) if (r.review_id in model.review_notes) review_notes[r.review_id] = model.review_notes[r.review_id]
  const provenance = {}
  for (const v of versions) if (model.provenance[v.id]) provenance[v.id] = model.provenance[v.id]
  let evidence = []
  let missing = []
  let derived_source = null
  if (governing) {
    const eids = evidenceIdsFor(model, governing.id)
    evidence = model.evidence.filter((e) => eids.includes(e.evidence_id))
    missing = eids.filter((id) => !evidence.some((e) => e.evidence_id === id))
    const seed = [...versions].reverse().find((v) => v.derived_from)?.derived_from ?? null
    if (seed) {
      const src = model.versions.find((v) => v.id === seed.version_id)
      const answer = src ? model.answers.find((a) => a.id === src.answer_id) : null
      derived_source = {
        version_id: seed.version_id, version_sha256: seed.version_sha256, question_occurrence_id: answer?.scope?.question_occurrence_id ?? null,
        application_id: answer?.scope?.application_id ?? null, title: src?.title ?? null, found: Boolean(src),
      }
    }
  }
  const answerIds = new Set(versions.map((v) => v.answer_id))
  const comments = model.comments.filter((c) => answerIds.has(c.answer_id))
  const suggestions = row.suggestions.map((s) => ('explanation' in s ? s : { ...s, explanation: 'Evidence requested by your agent (workspace only, not yet in the browser vault).', weaknesses: null, unsupported_claims: null }))
  let self_check = null
  if (governing && row.text) {
    self_check = classifyReuse(
      { text: row.text, canonical_question_id: row.canonical_question_id, word_limit: row.word_limit, char_limit: row.char_limit, program_name: context.program_name, org_name: context.org_name, cycle_year: context.cycle_year, deadline: context.deadline },
      [{
        version_id: governing.id, version_sha256: governing.sha256, body: governing.body, title: governing.title, question_text: row.text, scope: row.scope,
        canonical_question_id: row.canonical_question_id, approved: approvalGate(governing, approvals, reviews).approved, created_at: governing.created_at,
        program_name: context.program_name, org_name: context.org_name,
      }],
      { known_program_names: context.known_program_names, now },
    )
  }
  return buildCardViewModel({
    instance_id: inst.instance_id, program_name: context.program_name, org_name: context.org_name, deadline: context.deadline,
    question: {
      question_occurrence_id: row.question_occurrence_id, canonical_question_id: row.canonical_question_id, text: row.text, canonical_text: null,
      word_limit: row.word_limit, char_limit: row.char_limit, required: row.required, section_id: row.section_id,
    },
    versions, approvals, reviews, review_notes, provenance,
    governing: governing ? { title: governing.title, body: governing.body } : null,
    derived_source, evidence, missing_evidence_ids: missing, suggestions, comments, facts: model.facts,
    status: row.status, classification: row.classification, self_check, now,
  })
}

/** Recompute a version's content hash (integrity check: sha256 of canonicalJson({title, body})). */
export async function versionIntact(v) {
  return (await sha256Hex(canonicalJson({ title: v.title, body: v.body }))) === v.sha256
}

export function keyOf(r) {
  return splitRid(r).key
}
