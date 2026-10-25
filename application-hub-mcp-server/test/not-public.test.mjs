// not_public: data the public key cannot read is reported as such, with
// evidence (HTTP status + PostgREST code), and is never escalated.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalog } from './helpers.mjs'
import { PUBLIC_TOOLS, callPublicTool } from '../src/catalog/tools.mjs'

const ARGS = {
  hub_find_similar_questions: { text: 'problem solving' },
  hub_get_question_significance: { question_id: 'cq-problem' },
  hub_get_program_by_slug: { slug: 'yc-summer-2026' },
  hub_get_program_detail: { slug: 'yc-summer-2026' },
  hub_get_program_questions: { slug: 'yc-summer-2026' },
  hub_get_program_themes: { slug: 'yc-summer-2026' },
  hub_get_acceptance_stats: { slug: 'yc-summer-2026' },
}

test('programs denied: every tool answers not_public with evidence, never an error escalation', async () => {
  for (const deny of [401, 403, '42501', 404]) {
    const c = catalog({ deny: { programs: deny } })
    for (const t of PUBLIC_TOOLS) {
      const { result, isError } = await callPublicTool(t.name, ARGS[t.name] ?? {}, c.data)
      assert.equal(result.status, 'not_public', `${t.name} with ${deny}`)
      assert.equal(isError, false)
      assert.equal(result.table, 'programs')
      assert.ok(result.evidence.http_status === 401 || result.evidence.http_status === 403 || result.evidence.http_status === 404)
      assert.match(result.message, /Nothing was escalated/)
    }
    assert.ok(c.requests.every((r) => r.headers.apikey.startsWith('sb_publishable_')))
  }
})

test('optional sections degrade per section; required tables make the tool not_public', async () => {
  const c = catalog({ deny: { program_stats: 401, program_dna: 404 } })
  const d = await c.call('hub_get_program_detail', { slug: 'yc-summer-2026' })
  assert.equal(d.status, 'ok')
  assert.equal(d.sections.stats.status, 'not_public')
  assert.equal(d.stats, null)
  const b = await c.call('hub_get_program_by_slug', { slug: 'yc-summer-2026' })
  assert.deepEqual([b.status, b.sections.dna.status, b.sections.stats.status], ['ok', 'not_public', 'not_public'])
  assert.equal((await c.call('hub_get_program_themes', { slug: 'yc-summer-2026' })).status, 'not_public')
  const both = catalog({ deny: { program_stats: 401, acceptance_reports: 401 } })
  assert.equal((await both.call('hub_get_acceptance_stats', { slug: 'yc-summer-2026' })).status, 'not_public')
  const one = catalog({ deny: { acceptance_reports: 401 } })
  const acc = await one.call('hub_get_acceptance_stats', { slug: 'yc-summer-2026' })
  assert.deepEqual([acc.status, acc.sections.reports.status, acc.verified_reports, acc.application_count], ['ok', 'not_public', null, 1200])
})

test('missing columns fall back to a smaller select, or mark the scores unavailable', async () => {
  const c = catalog({ missingColumns: { programs: ['credit_value_usd', 'round'], archived_questions: ['theme'] } })
  const s = await c.call('hub_search_programs', {})
  assert.equal(s.status, 'ok')
  assert.equal(s.scores_available, true) // minimal score select
  const q = await c.call('hub_get_program_questions', { slug: 'yc-summer-2026' })
  assert.deepEqual([q.status, q.sections.canonical_questions.status, q.questions[0].theme], ['ok', 'unavailable', null])
  const noScores = catalog({ missingColumns: { programs: ['heat_score'] } })
  assert.equal((await noScores.call('hub_search_programs', {})).scores_available, false)
  const r = await noScores.call('hub_search_programs', { sort_by: 'heat_score' })
  assert.equal(r.status, 'unavailable')
  assert.equal(r.reason, 'score_columns')
  assert.equal((await noScores.call('hub_get_heat_scores', {})).reason, 'schema_mismatch')
})

test('unreachable catalog and unconfigured catalog are tool errors with a fix', async () => {
  const c = catalog({ fail: true })
  const { result, isError } = await callPublicTool('hub_search_programs', {}, c.data)
  assert.deepEqual([result.status, result.reason, isError], ['unavailable', 'catalog_unreachable', true])
  const none = await callPublicTool('hub_search_programs', {}, null)
  assert.equal(none.result.reason, 'catalog_not_configured')
  assert.ok(none.result.how_to_fix.length >= 2)
})
