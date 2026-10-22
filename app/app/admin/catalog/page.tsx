import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CANDIDATE_COLUMNS, SOURCE_COLUMNS, catalogServiceClient, isCatalogCurator } from '@/lib/catalog-promotion/server'
import { checksFor, loadReviewContext, loadSourceFacts, type CandidateRow, type ReviewContext } from '@/lib/catalog-promotion/review'
import { CHECK_KEYS, type CandidateChecks } from '@/lib/catalog-promotion/checks'
import { validateCandidatePayload, type CandidatePayload } from '@/lib/catalog-promotion/schema'
import { CANDIDATE_STATES, curatorNextSteps, isCandidateState } from '@/lib/catalog-promotion/transitions'
import { CandidateActions } from './CandidateActions'

// /admin/catalog — curator review of public catalog candidates (M09 W3).
// Curators only (row in catalog_curators); everyone else, including guests
// and deployments where 058 is not applied yet, gets a 404.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Catalog review', robots: { index: false, follow: false } }

type SourceRow = {
  id: string; url: string; final_url: string | null; capture_method: string; captured_at: string
  content_sha256: string | null; reuse: string; robots_disallow: boolean | null
  last_checked_at: string | null; verification_status: string
  fetched_at: string | null; reuse_signals: string[] | null; snapshot_sha256: string | null
}
type EventRow = {
  candidate_id: string; from_state: string | null; to_state: string; actor_role: string
  note: string | null; evidence: Record<string, unknown> | null; at: string
}
type Row = CandidateRow & { source: SourceRow | null }

const CHECK_LABEL: Record<string, string> = {
  source_public_reusable: 'Source public & reusable',
  no_private_data: 'No private data',
  duplicate_template: 'No duplicate template',
  exact_wording_preserved: 'Exact wording in source',
  cycle_identified: 'Cycle identified',
  deadline_requirements_evidence: 'Deadline / requirements evidenced',
}

const STATE_STYLE: Record<string, string> = {
  candidate: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  extracted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  matched: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  verified: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  published: 'bg-green-600 text-white',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  withdrawn: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}

export default async function CatalogReviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const admin = catalogServiceClient()
  if (!admin) notFound()
  if ((await isCatalogCurator(admin, user.id)) !== true) notFound()

  const { state } = await searchParams
  const filter = state && isCandidateState(state) ? state : null
  let query = admin
    .from('catalog_candidates')
    .select(`${CANDIDATE_COLUMNS}, source:catalog_sources(${SOURCE_COLUMNS})`)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (filter) query = query.eq('state', filter)
  const { data, error } = await query
  const rows = ((data ?? []) as unknown as Row[])

  // Shared facts for live check previews (programs + revisions are the same for every candidate).
  const baseCtx = rows.length ? await loadReviewContext(admin, { source_id: null }) : null
  const { data: eventData } = rows.length
    ? await admin.from('catalog_candidate_events')
        .select('candidate_id, from_state, to_state, actor_role, note, evidence, at')
        .in('candidate_id', rows.map((r) => r.id))
        .order('id', { ascending: true })
    : { data: [] }
  const events = new Map<string, EventRow[]>()
  for (const e of (eventData ?? []) as EventRow[]) events.set(e.candidate_id, [...(events.get(e.candidate_id) ?? []), e])

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Catalog review</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Candidate → Extracted → Matched → Verified → Approved → Published. Only public program material; publishing never touches applicant answers.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1.5 text-xs" aria-label="Filter by state">
            <a href="/admin/catalog" className={`rounded-full px-2.5 py-1 ${!filter ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800'}`}>all</a>
            {CANDIDATE_STATES.map((s) => (
              <a key={s} href={`/admin/catalog?state=${s}`} className={`rounded-full px-2.5 py-1 ${filter === s ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800'}`}>{s}</a>
            ))}
          </nav>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">Could not load candidates ({error.code ?? 'error'}).</p>}
        {!error && rows.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400">No candidates{filter ? ` in state ${filter}` : ''}.</p>}

        <ul className="space-y-5">
          {rows.map((row) => <CandidateCard key={row.id} row={row} baseCtx={baseCtx} events={events.get(row.id) ?? []} />)}
        </ul>
      </div>
    </main>
  )
}

async function CandidateCard({ row, baseCtx, events }: { row: Row; baseCtx: ReviewContext | null; events: EventRow[] }) {
  const parsed = validateCandidatePayload(row.payload)
  const payload: CandidatePayload | null = parsed.ok ? parsed.value : null
  const terminal = ['published', 'rejected', 'withdrawn'].includes(row.state)
  const stored = (row.checks && (row.checks as Partial<CandidateChecks>).results ? row.checks : null) as CandidateChecks | null

  let checks: CandidateChecks | null = stored
  let live = false
  if (!terminal && baseCtx) {
    const admin = catalogServiceClient()
    const source = admin ? await loadSourceFacts(admin, row.source_id) : null
    checks = checksFor(row, { ...baseCtx, source })
    live = true
  }
  const steps = isCandidateState(row.state) ? curatorNextSteps(row.state) : []
  const src = row.source
  const serverCaptured = src?.capture_method === 'url_fetch'
  const selfApproved = events.some((e) => e.to_state === 'approved' && e.evidence?.self_approved === true)

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-neutral-900 dark:text-white">
            {payload?.program.name ?? '(invalid payload)'}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {payload?.program.organization} · {payload?.program.kind}
            {payload?.program.apply_url && (
              <> · <a className="underline decoration-dotted" href={payload.program.apply_url} rel="noopener noreferrer nofollow" target="_blank">apply URL</a></>
            )}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
            {row.id} · submitted {new Date(row.submitted_at).toISOString().slice(0, 16).replace('T', ' ')}Z
            {row.program_match_id && <> · revision of {row.program_match_id.slice(0, 8)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 self-start">
          {selfApproved && (
            <span title="Approved by the curator who submitted it" className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300">self-approved</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLE[row.state] ?? ''}`}>{row.state}</span>
        </div>
      </div>

      {/* Source + reuse signal */}
      <section className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
        {src ? (
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <span className="min-w-0 truncate">source: <a className="underline decoration-dotted" href={src.url} rel="noopener noreferrer nofollow" target="_blank">{src.url}</a></span>
            <span>capture: {src.capture_method}{' '}
              <strong className={serverCaptured ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                ({serverCaptured ? 'server-captured' : 'client-supplied, lower trust'})
              </strong>
            </span>
            {src.fetched_at && <span>fetched {src.fetched_at.slice(0, 16).replace('T', ' ')}Z</span>}
            {src.final_url && src.final_url !== src.url && <span className="min-w-0 truncate">final: {src.final_url}</span>}
            {src.last_checked_at && <span>last checked {src.last_checked_at.slice(0, 16).replace('T', ' ')}Z</span>}
            {src.reuse_signals && src.reuse_signals.length > 0 && <span>signals: {src.reuse_signals.join(', ')}</span>}
            <span>reuse: <strong className={src.reuse === 'allowed' ? 'text-green-700 dark:text-green-400' : src.reuse === 'disallowed' ? 'text-red-700 dark:text-red-400' : ''}>{src.reuse}</strong></span>
            <span>robots/terms disallow: {src.robots_disallow === null ? 'unknown' : src.robots_disallow ? 'yes' : 'no'}</span>
            <span>verification: {src.verification_status}</span>
            {src.content_sha256 && <span className="font-mono">sha256 {src.content_sha256.slice(0, 12)}…</span>}
          </div>
        ) : <span>no source evidence</span>}
      </section>

      {/* Payload preview */}
      {payload ? (
        <section className="mt-3 space-y-2 text-sm">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
            <div><dt className="inline text-neutral-500">cycle: </dt><dd className="inline">{payload.cycle?.name ?? (payload.cycle?.is_rolling ? 'rolling' : '—')}</dd></div>
            <div><dt className="inline text-neutral-500">deadline: </dt><dd className="inline">{payload.cycle?.closes_at ?? '—'} {payload.cycle?.timezone ? `(${payload.cycle.timezone})` : ''}</dd></div>
            {payload.eligibility && <div className="sm:col-span-2"><dt className="inline text-neutral-500">eligibility: </dt><dd className="inline whitespace-pre-wrap">{payload.eligibility}</dd></div>}
            {payload.requirements && <div className="sm:col-span-2"><dt className="inline text-neutral-500">requirements: </dt><dd className="inline whitespace-pre-wrap">{payload.requirements}</dd></div>}
          </dl>
          <details open={!terminal} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {payload.questions.length} question{payload.questions.length === 1 ? '' : 's'} (exact wording)
            </summary>
            <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {payload.questions.map((q, i) => (
                <li key={i} className={`px-3 py-2 ${checks?.missing_wording?.includes(i) ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}>
                  <p className="whitespace-pre-wrap text-sm text-neutral-900 dark:text-neutral-100">{q.asked_as}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-neutral-500">
                    <span>#{q.order_index}</span>
                    {q.section && <span>{q.section}</span>}
                    <span>{q.required === false ? 'optional' : 'required'}</span>
                    {q.response_type && <span>{q.response_type}</span>}
                    {q.word_limit && <span>{q.word_limit} words max</span>}
                    {q.char_limit && <span>{q.char_limit} chars max</span>}
                    {q.time_context && <span>time: {q.time_context}</span>}
                    {q.mapping ? <span>map: {q.mapping.tier} → {q.mapping.canonical_question_id?.slice(0, 8) ?? 'new'}</span> : <span>map: novel</span>}
                    {checks?.missing_wording?.includes(i) && <span className="text-amber-700 dark:text-amber-400">not found verbatim in source</span>}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : (
        <p className="mt-3 text-xs text-red-700 dark:text-red-400">Stored payload no longer validates: {parsed.ok ? '' : parsed.errors.map((e) => `${e.path}:${e.code}`).join(', ')}</p>
      )}

      {/* Checks */}
      {checks && (
        <section className="mt-3">
          <h3 className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Checks {live ? '(live preview — recorded on each transition)' : `(recorded ${checks.ran_at?.slice(0, 16).replace('T', ' ')}Z)`}: {checks.all_passed ? 'all passing' : 'failing'}
          </h3>
          <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {CHECK_KEYS.map((k) => {
              const r = checks!.results?.[k]
              if (!r) return null
              return (
                <li key={k} className="flex gap-2 text-xs">
                  <span aria-hidden className={r.pass ? 'text-green-600' : 'text-red-600'}>{r.pass ? '✓' : '✗'}</span>
                  <span><span className="font-medium text-neutral-800 dark:text-neutral-200">{CHECK_LABEL[k]}</span> <span className="text-neutral-500">— {r.detail}</span></span>
                </li>
              )
            })}
          </ul>
          {checks.duplicates?.length > 0 && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              Possible duplicate template: {checks.duplicates.map((d) => `${d.name} [${d.slug}] (${d.reasons.join('+')})`).join('; ')}
            </p>
          )}
        </section>
      )}

      {events.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">History ({events.length} events)</summary>
          <ol className="mt-1 space-y-0.5 text-neutral-700 dark:text-neutral-300">
            {events.map((e, i) => (
              <li key={i}>
                <span className="font-mono text-[11px] text-neutral-500">{e.at.slice(0, 16).replace('T', ' ')}Z</span>{' '}
                {e.from_state ?? '—'} → <strong>{e.to_state}</strong> ({e.actor_role})
                {e.evidence?.self_approved === true && <span className="ml-1 text-amber-700 dark:text-amber-400">self-approved</span>}
                {e.evidence?.override === true && <span className="ml-1 text-amber-700 dark:text-amber-400">override</span>}
                {e.note && <span className="text-neutral-500"> — {e.note}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <CandidateActions
        id={row.id}
        canRecheck={serverCaptured && !terminal}
        steps={steps}
        canPublish={row.state === 'approved'}
        reuse={src?.reuse ?? 'unknown'}
        verificationStatus={src?.verification_status ?? 'unverified'}
        robotsDisallow={src?.robots_disallow ?? null}
      />
    </li>
  )
}
