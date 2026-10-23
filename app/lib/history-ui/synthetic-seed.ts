// M09b — SYNTHETIC submitted-history seed for the dev harness and tests.
// Writes the same shapes a Restore of a companion `import-history` export
// produces: an app_instance per answered application (history: true), and
// per answer an answer row plus an `imported` version carrying
// `history: true` + `history_enc` (encrypted HistoryMeta). Every string is
// synthetic; nothing here is real application content.

import { createAppInstance } from '../aqua-local/instances.ts'
import { createAnswer, buildVersionPayload } from '../aqua-local/repo.ts'
import { encryptField, decryptField } from '../aqua-local/crypto.ts'
import { HISTORY_FORMAT, findPlaceholders, type HistoryMeta, type HistoryParseConfidence } from '../aqua-local/history.ts'
import type { AppInstanceRecord } from '../aqua-local/schema.ts'
import type { VaultStorage } from '../aqua-local/vault.ts'

export interface SyntheticHistoryApp {
  program: string
  submitted_at: string | null
  source_file: string
  qa: Array<{ question: string; answer: string; parse_confidence?: HistoryParseConfidence; parse_notes?: string[] }>
}

export const SYNTHETIC_HISTORY: SyntheticHistoryApp[] = [
  {
    program: 'Synthetic Founders Fellowship',
    submitted_at: '2025-03-14',
    source_file: 'synthetic-fellowship-2025-03-14.md',
    qa: [
      { question: 'What are you building? (150 words)', answer: 'We build a synthetic scheduling assistant for small clinics. It books, confirms and reschedules visits by text message, so front-desk staff spend their time with patients instead of the phone.' },
      { question: 'Why is now the right time?', answer: 'Synthetic clinics moved scheduling online during the last three years, and text reminders are now expected by most patients we interviewed (synthetic study, 40 clinics).' },
      { question: 'What traction do you have?', answer: 'We have [CONFIRM number] paying clinics and a waitlist of synthetic pilots.' },
    ],
  },
  {
    program: 'Example Climate Grant',
    submitted_at: '2024-11-02',
    source_file: 'example-climate-grant.json',
    qa: [
      { question: 'Describe the problem you are solving.', answer: 'Synthetic rural cooperatives lose a fifth of harvested produce before it reaches a market. Our cold-storage kits cut that loss in synthetic field trials.' },
      { question: 'Who is on your team?', answer: 'Two synthetic founders with eight combined years in agricultural logistics and refrigeration engineering.' },
    ],
  },
  {
    program: 'Example Climate Grant',
    submitted_at: null,
    source_file: 'example-climate-grant-draft-notes.txt',
    qa: [
      { question: 'What would you do with the funding?', answer: 'Deploy twenty synthetic kits with partner cooperatives and measure spoilage for one season.' },
    ],
  },
]

export interface SeededHistory {
  instance_ids: string[]
  version_ids: string[]
}

/** Seed `storage` with SYNTHETIC_HISTORY under `secret`. */
export async function seedSyntheticHistory(storage: VaultStorage, secret: string, apps: SyntheticHistoryApp[] = SYNTHETIC_HISTORY): Promise<SeededHistory> {
  const instance_ids: string[] = []
  const version_ids: string[] = []
  const sourceSha = (s: string) => s.split('').reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 7).toString(16).padStart(8, '0').repeat(8)
  for (const app of apps) {
    const inst = await createAppInstance(storage, secret, {
      source: { kind: 'file', ref: app.source_file },
      local_template: { title: app.program, org: '', questions: app.qa.map((x) => ({ text: x.question })) },
    })
    // mirror the companion export: the instance carries history: true
    await storage.put('app_instances', { ...inst, history: true } as AppInstanceRecord)
    instance_ids.push(inst.instance_id)
    const tpl = JSON.parse(await decryptField(secret, inst.local_template_enc!)) as { questions: Array<{ question_occurrence_id: string }> }
    for (const [i, x] of app.qa.entries()) {
      const answer = await createAnswer(storage, { application_id: inst.application_id, question_occurrence_id: tpl.questions[i].question_occurrence_id })
      const { record, receipt } = await buildVersionPayload(secret, { answer_id: answer.id, title: x.question.slice(0, 120), body: x.answer, method: 'imported' })
      const markers = findPlaceholders(x.answer)
      const meta: HistoryMeta = {
        format: HISTORY_FORMAT,
        program: app.program,
        question: x.question,
        submitted_at: app.submitted_at,
        date_source: app.submitted_at ? 'filename' : null,
        flags: app.submitted_at ? [] : ['date_unknown'],
        source_sha256: sourceSha(app.source_file),
        source_file: app.source_file,
        placeholder: { found: markers.length > 0, markers },
        imported_at: '2026-10-22T00:00:00.000Z',
        importer: 'aqua-companion import-history (synthetic seed)',
        ...(x.parse_confidence ? { parse_confidence: x.parse_confidence, parse_notes: x.parse_notes ?? [] } : {}),
      }
      record.history = true
      record.history_enc = await encryptField(secret, JSON.stringify(meta))
      await storage.put('versions', record)
      await storage.put('provenance', receipt)
      version_ids.push(record.id)
    }
  }
  return { instance_ids, version_ids }
}
