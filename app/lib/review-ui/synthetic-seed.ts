// M09 W5 — SYNTHETIC review fixture for the dev harness and tests.
// Every name, number and sentence here is invented ("Example Labs",
// "Sample Accelerator") — no real application or answer content. Writes go
// through the public v5 client API only (no direct store manipulation).

import {
  addEvidenceRecord,
  addFact,
  approveAsHuman,
  createInstance,
  editAsChildVersion,
  linkEvidenceRecord,
  recordAgentSuggestion,
  requestEvidenceOrHelp,
  saveInstanceDraft,
  addVersionComment,
} from '../aqua-local-client/review.ts'
import type { VaultStorage } from '../aqua-local/vault.ts'

export const SYNTHETIC_PROGRAM = 'Sample Accelerator 2027'
export const SYNTHETIC_ORG = 'Sample Ventures (synthetic)'

export interface SyntheticSeed {
  instance_id: string
  bank_instance_id: string
  occ: Record<'company' | 'traction' | 'team' | 'funding' | 'extra' | 'competitors', string>
}

const ACTOR = 'harness-user'

export async function seedSyntheticReview(storage: VaultStorage, secret: string): Promise<SyntheticSeed> {
  // An EARLIER (synthetic) application whose approved answers form the bank.
  const bank = await createInstance(storage, secret, {
    source: { kind: 'paste' },
    local_template: {
      title: 'Earlier Program 2024',
      org: 'Other Fund (synthetic)',
      cycle_year: 2024,
      questions: [
        { text: 'Describe your company and what it does.', word_limit: 200, required: true },
        { text: 'What traction do you have?', word_limit: 200, required: true },
      ],
    },
  })
  const bankQ = bank.question_refs.map((r) => r.question_occurrence_id)
  const bankCompany = await saveInstanceDraft(storage, secret, bank.instance_id, bankQ[0], {
    title: 'Company overview',
    body: 'Example Labs builds a scheduling assistant for small veterinary clinics. Clinics book, remind and reschedule appointments from one screen.',
  })
  await approveAsHuman(storage, { version_id: bankCompany.id, expected_sha256: bankCompany.sha256, actor_id: ACTOR, secret })
  const bankTraction = await saveInstanceDraft(storage, secret, bank.instance_id, bankQ[1], {
    title: 'Traction (2024)',
    body: 'In 2024 we signed 35 paying customers through the Earlier Program 2024 pilot and grew revenue 12% month over month.',
  })
  await approveAsHuman(storage, { version_id: bankTraction.id, expected_sha256: bankTraction.sha256, actor_id: ACTOR, secret })

  // The application under review.
  const inst = await createInstance(storage, secret, {
    source: { kind: 'paste', ref: 'synthetic-fixture' },
    local_template: {
      title: SYNTHETIC_PROGRAM,
      org: SYNTHETIC_ORG,
      cycle_year: 2027,
      deadline: '2027-03-01T23:59:00Z',
      questions: [
        { text: 'Describe your company and what it does.', word_limit: 150, required: true },
        { text: 'What traction do you have so far? Include specific numbers.', word_limit: 60, required: true },
        { text: 'Why is your team uniquely positioned to build this?', word_limit: 100, required: true },
        { text: 'What will you do with the funding?', word_limit: 40, char_limit: 260, required: true },
        { text: 'Anything else we should know?', required: false },
        { text: 'Who are your main competitors and how are you different?', word_limit: 120, required: false },
      ],
    },
  })
  const q = inst.question_refs.map((r) => r.question_occurrence_id)
  const occ = { company: q[0], traction: q[1], team: q[2], funding: q[3], extra: q[4], competitors: q[5] }

  await addFact(storage, secret, { kind: 'organization', key: 'org.customers', value: '40' })
  await addFact(storage, secret, { kind: 'organization', key: 'org.founded_year', value: '2022' })

  // Q1 company — written by the user, evidence linked, not yet approved.
  const company = await saveInstanceDraft(storage, secret, inst.instance_id, occ.company, {
    title: 'Company overview',
    body:
      'Example Labs builds a scheduling assistant for small veterinary clinics.\n\n' +
      'Clinics book, remind and reschedule appointments from one screen, which cuts no-shows and front-desk phone time.',
  })
  const note = await addEvidenceRecord(storage, secret, {
    kind: 'note',
    title: 'Product one-pager (synthetic)',
    excerpt: 'Scheduling, reminders and rescheduling for clinics with 1–5 vets.',
    verification: 'user_confirmed',
    freshness_checked_at: '2026-10-01T00:00:00Z',
  })
  await linkEvidenceRecord(storage, note.evidence_id, { target_kind: 'version', target_id: company.id })
  const link = await addEvidenceRecord(storage, secret, {
    kind: 'url',
    title: 'Public product page (synthetic)',
    url: 'https://example.com/example-labs',
  })
  await linkEvidenceRecord(storage, link.evidence_id, { target_kind: 'version', target_id: company.id })

  // Q2 traction — reused from the 2024 bank answer: Adapt, fact conflict.
  const traction = await saveInstanceDraft(storage, secret, inst.instance_id, occ.traction, {
    title: 'Traction',
    body: 'In 2024 we signed 35 paying customers through the Earlier Program 2024 pilot and grew revenue 12% month over month.',
    derived_from_version_id: bankTraction.id,
  })
  await recordAgentSuggestion(storage, secret, {
    instance_id: inst.instance_id,
    question_occurrence_id: occ.traction,
    kind: 'recommendation',
    candidate_version_id: traction.id,
    explanation: 'Reuses the approved 2024 traction answer; the question now asks for current numbers.',
    weaknesses: 'Numbers are from 2024.\nNames the earlier program.',
    unsupported_claims: '12% month-over-month revenue growth (no source linked)',
    provider: 'local-classifier',
  })

  // Q3 team — BYOK AI draft (suggested), no evidence.
  await saveInstanceDraft(storage, secret, inst.instance_id, occ.team, {
    title: 'Team',
    body: 'Our two founders spent six years running clinic software support and have shipped scheduling tools before.',
    method: 'byok',
    provider: 'anthropic',
    model: 'synthetic-model',
  })

  // Q4 funding — over the limits; a human evidence request recorded.
  const funding = await saveInstanceDraft(storage, secret, inst.instance_id, occ.funding, {
    title: 'Use of funds',
    body:
      'We will hire two engineers to build the reminders engine and integrations, one clinic success lead to onboard new customers, ' +
      'and spend the remainder on a regional sales pilot across three states, plus compliance work for data handling and a modest marketing budget for conferences.',
  })
  await requestEvidenceOrHelp(storage, secret, {
    version_id: funding.id,
    expected_sha256: funding.sha256,
    kind: 'evidence_requested',
    note: 'Challenged claim: three-state sales pilot budget',
    actor_id: ACTOR,
  })

  // Q5 extra — no answer (gap).

  // Q6 competitors — v1 approved, then edited → v2 not approved.
  const comp1 = await saveInstanceDraft(storage, secret, inst.instance_id, occ.competitors, {
    title: 'Competitors',
    body: 'Large practice-management suites include scheduling, but they are priced for hospitals. We focus on small clinics.',
  })
  await approveAsHuman(storage, { version_id: comp1.id, expected_sha256: comp1.sha256, actor_id: ACTOR, secret })
  await addVersionComment(storage, secret, {
    version_id: comp1.id,
    expected_sha256: comp1.sha256,
    body: 'Name one example competitor category more concretely.',
    actor_class: 'human',
    actor_id: ACTOR,
  })
  await editAsChildVersion(storage, secret, {
    parent_version_id: comp1.id,
    body: 'Large practice-management suites include scheduling, but they are priced and built for multi-site hospitals. We focus on clinics with one to five vets.',
  })

  return { instance_id: inst.instance_id, bank_instance_id: bank.instance_id, occ }
}
