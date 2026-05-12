import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type {
  Program,
  UserProgramFit,
  UserApplication,
  ProgramWithFit,
  ApplicantMode,
  ProgramNextCycle,
} from '@/lib/database.types'
import { ModeSelector } from '@/components/ModeSelector'
import {
  DEFAULT_MODE,
  defaultSubmitKindForMode,
  isModeDeeplyCurated,
  modeContextLabel,
  modeLabel,
  modeToLegacyTypes,
} from '@/lib/applicantMode'
import { formatDeadline, programTypeLabel, formatCheckSize, cn } from '@/lib/utils'
import { FundersDirectory } from '@/components/FundersDirectory'

export const metadata = {
  title: 'Applications',
}

type TabKey = 'discover' | 'mine'

const APP_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  saved: { label: 'Saved', dot: 'bg-neutral-400 dark:bg-neutral-500' },
  drafting: { label: 'In progress', dot: 'bg-brand-500' },
  submitted: { label: 'Submitted', dot: 'bg-success-500' },
  accepted: { label: 'Accepted', dot: 'bg-success-600' },
  rejected: { label: 'Rejected', dot: 'bg-neutral-400 dark:bg-neutral-500' },
  waitlisted: { label: 'Waitlisted', dot: 'bg-warning-500' },
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; type?: string; rolling?: string; view?: string; domain?: string; tab?: string; selected?: string }>
}) {
  const resolvedParams = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tab: TabKey = resolvedParams.tab === 'mine' ? 'mine' : 'discover'
  let activeIdentity: ApplicantMode = DEFAULT_MODE
  let identities: ApplicantMode[] = [DEFAULT_MODE]
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('active_identity, identities')
      .eq('user_id', user.id)
      .single<{ active_identity: ApplicantMode | null; identities: ApplicantMode[] | null }>()
    activeIdentity = profile?.active_identity ?? DEFAULT_MODE
    identities = profile?.identities ?? [DEFAULT_MODE]
  }

  // Funders view short-circuits
  if (resolvedParams.view === 'funders') {
    return (
      <div>
        <div className="mb-4">
          {user && <ModeSelector activeIdentity={activeIdentity} identities={identities} />}
        </div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Applications</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Organizations running programs in the Hub
            </p>
          </div>
          <ApplicationsTabs tab="funders" />
        </div>
        <FundersDirectory filterType={resolvedParams.type ?? ''} />
      </div>
    )
  }

  // Fetch programs
  let query = supabase
    .from('programs')
    .select('*')
    .order('heat_score', { ascending: false })

  if (resolvedParams.type) {
    query = query.eq('type', resolvedParams.type)
  } else {
    const allowedTypes = modeToLegacyTypes(activeIdentity)
    if (allowedTypes.length > 0) {
      query = query.in('type', allowedTypes as unknown as string[])
    }
  }
  if (resolvedParams.rolling === 'true') {
    query = query.eq('is_rolling', true)
  }

  const activeDomain = resolvedParams.domain ?? 'founder'
  query = query.eq('domain', activeDomain)

  const { data: programs } = await query.returns<Program[]>()

  // Fetch fit scores
  let fitMap: Record<string, UserProgramFit> = {}
  if (user && programs?.length) {
    const { data: fitRows } = await supabase
      .from('user_program_fit')
      .select('*')
      .eq('user_id', user.id)
      .returns<UserProgramFit[]>()
    if (fitRows) {
      fitMap = Object.fromEntries(fitRows.map((f) => [f.program_id, f]))
    }
  }

  // Fetch user application statuses
  let applicationMap: Record<string, UserApplication> = {}
  if (user) {
    const { data: appRows } = await supabase
      .from('user_applications')
      .select('*')
      .eq('user_id', user.id)
      .returns<UserApplication[]>()
    if (appRows) {
      applicationMap = Object.fromEntries(appRows.map((a) => [a.program_id, a]))
    }
  }

  // Fetch next active cycle
  let cycleMap: Record<string, ProgramNextCycle> = {}
  if (programs?.length) {
    const programIds = programs.map(p => p.id)
    const { data: cycleRows } = await supabase
      .from('program_next_cycle')
      .select('*')
      .in('program_id', programIds)
      .returns<ProgramNextCycle[]>()
    if (cycleRows) {
      cycleMap = Object.fromEntries(cycleRows.map(c => [c.program_id, c]))
    }
  }

  // For "Mine" tab: fetch any missing programs
  const programMap: Record<string, Program> = Object.fromEntries(
    (programs ?? []).map((p) => [p.id, p])
  )
  if (user && tab === 'mine') {
    const missingIds = Object.keys(applicationMap).filter((id) => !programMap[id])
    if (missingIds.length > 0) {
      const { data: extraPrograms } = await supabase
        .from('programs')
        .select('*')
        .in('id', missingIds)
        .returns<Program[]>()
      for (const p of extraPrograms ?? []) programMap[p.id] = p

      const { data: extraCycles } = await supabase
        .from('program_next_cycle')
        .select('*')
        .in('program_id', missingIds)
        .returns<ProgramNextCycle[]>()
      for (const c of extraCycles ?? []) cycleMap[c.program_id] = c

      const missingFromFit = missingIds.filter((id) => !fitMap[id])
      if (missingFromFit.length > 0) {
        const { data: extraFit } = await supabase
          .from('user_program_fit')
          .select('*')
          .eq('user_id', user.id)
          .in('program_id', missingFromFit)
          .returns<UserProgramFit[]>()
        for (const f of extraFit ?? []) fitMap[f.program_id] = f
      }
    }
  }

  const programsWithFit: ProgramWithFit[] = (programs ?? []).map((p) => ({
    ...p,
    fit: fitMap[p.id],
    application: applicationMap[p.id],
    cycle: cycleMap[p.id] ?? null,
  }))

  // Sort
  const now = Date.now()
  const MS_PER_DAY = 86_400_000

  const sort = resolvedParams.sort ?? 'composite'
  const sorted = [...programsWithFit].sort((a, b) => {
    if (sort === 'heat') return b.heat_score - a.heat_score
    if (sort === 'deadline') {
      const da = a.cycle?.closes_at ?? a.deadline_at ?? '9999-12-31'
      const db = b.cycle?.closes_at ?? b.deadline_at ?? '9999-12-31'
      return da.localeCompare(db)
    }
    const deadlineA = a.cycle?.closes_at ?? a.deadline_at
    const deadlineB = b.cycle?.closes_at ?? b.deadline_at
    const daysA = deadlineA ? (new Date(deadlineA).getTime() - now) / MS_PER_DAY : Infinity
    const daysB = deadlineB ? (new Date(deadlineB).getTime() - now) / MS_PER_DAY : Infinity
    const urgentA = daysA > 0 && daysA <= 60
    const urgentB = daysB > 0 && daysB <= 60
    if (urgentA !== urgentB) return urgentA ? -1 : 1
    if (urgentA && urgentB) return daysA - daysB
    const scoreA = a.fit ? a.fit.fit_score : a.heat_score
    const scoreB = b.fit ? b.fit.fit_score : b.heat_score
    return scoreB - scoreA
  })

  // My Applications rows
  const mineRows: MineRow[] = []
  if (user) {
    for (const app of Object.values(applicationMap)) {
      const program = programMap[app.program_id]
      if (!program) continue
      mineRows.push({
        application: app,
        program,
        fit: fitMap[app.program_id],
        cycle: cycleMap[app.program_id] ?? null,
      })
    }
    mineRows.sort((a, b) => {
      const ua = a.application.updated_at ?? a.application.created_at ?? ''
      const ub = b.application.updated_at ?? b.application.created_at ?? ''
      return ub.localeCompare(ua)
    })
  }

  // Determine selected item from ?selected= param
  const selectedId = resolvedParams.selected ?? null
  const defaultSelectedId = tab === 'mine'
    ? (mineRows[0]?.program.id ?? null)
    : (sorted[0]?.id ?? null)
  const resolvedSelectedId = selectedId ?? defaultSelectedId

  // Find selected program/application data
  const selectedProgramWithFit = resolvedSelectedId
    ? (tab === 'mine'
        ? mineRows.find(r => r.program.id === resolvedSelectedId)
            ? { ...mineRows.find(r => r.program.id === resolvedSelectedId)!.program,
                fit: fitMap[resolvedSelectedId],
                application: applicationMap[resolvedSelectedId],
                cycle: cycleMap[resolvedSelectedId] ?? null } as ProgramWithFit
            : null
        : sorted.find(p => p.id === resolvedSelectedId) ?? null)
    : null

  const selectedApplication = resolvedSelectedId
    ? (applicationMap[resolvedSelectedId] ?? null)
    : null

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-8 h-[calc(100vh-3.5rem)] md:h-screen flex flex-col">
      {/* Slim header */}
      <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Applications</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {tab === 'mine'
                ? mineRows.length > 0
                  ? `${mineRows.length} active application${mineRows.length === 1 ? '' : 's'}`
                  : "Track the programs you're actively applying to"
                : sorted.length > 0
                ? `${sorted.length} ${modeContextLabel(activeIdentity).toLowerCase()} ranked by fit`
                : `Discover ${modeContextLabel(activeIdentity).toLowerCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user && <ModeSelector activeIdentity={activeIdentity} identities={identities} />}
            <ApplicationsTabs tab={tab} />
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: program/application list */}
        <aside className="md:w-72 md:flex-shrink-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 md:h-full md:overflow-y-auto">
          <ApplicationsSidebar
            tab={tab}
            sorted={sorted}
            mineRows={mineRows}
            sort={sort}
            selectedId={resolvedSelectedId}
          />
        </aside>

        {/* Right: detail panel */}
        <section className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
          {selectedProgramWithFit ? (
            <ApplicationDetailPanel
              program={selectedProgramWithFit}
              application={selectedApplication}
              tab={tab}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              Select a program to view details.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MineRow = {
  application: UserApplication
  program: Program
  fit: UserProgramFit | undefined
  cycle: ProgramNextCycle | null
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ApplicationsSidebar({
  tab,
  sorted,
  mineRows,
  sort,
  selectedId,
}: {
  tab: TabKey
  sorted: ProgramWithFit[]
  mineRows: MineRow[]
  sort: string
  selectedId: string | null
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Compact sort row — only in Discover */}
      {tab === 'discover' && (
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mr-1">Sort:</span>
          {(['composite', 'heat', 'deadline'] as const).map((s) => (
            <a
              key={s}
              href={`/applications?sort=${s}`}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                sort === s
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              {s === 'composite' ? 'Best fit' : s === 'heat' ? 'Trending' : 'Deadline'}
            </a>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'mine' ? (
          mineRows.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No applications yet.{' '}
                <Link href="/applications" className="text-brand-600 dark:text-brand-400 hover:underline">
                  Discover programs
                </Link>
              </p>
            </div>
          ) : (
            mineRows.map((row) => {
              const { application, program, cycle } = row
              const deadlineSource = cycle?.closes_at ?? program.deadline_at
              const deadline = formatDeadline(deadlineSource)
              const status = application.status ?? 'saved'
              const statusCfg = APP_STATUS_CONFIG[status] ?? APP_STATUS_CONFIG.saved
              const isSelected = selectedId === program.id
              return (
                <Link
                  key={application.id}
                  href={`/applications?tab=mine&selected=${program.id}`}
                  className={cn(
                    'flex items-start gap-2 px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/40 transition-colors',
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-brand-500'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {programTypeLabel(program.type)}
                      </span>
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusCfg.dot)} />
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{statusCfg.label}</span>
                    </div>
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{program.name}</p>
                    {deadlineSource && (
                      <p className={cn(
                        'text-[10px] mt-0.5',
                        deadline.urgent
                          ? 'text-warning-600 dark:text-warning-400 font-medium'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        {deadline.label}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })
          )
        ) : (
          sorted.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No programs match your filters.</p>
            </div>
          ) : (
            sorted.map((program) => {
              const deadlineSource = program.cycle?.closes_at ?? program.deadline_at
              const deadline = formatDeadline(deadlineSource)
              const isSelected = selectedId === program.id
              const fitPct = program.fit ? Math.round(program.fit.fit_score) : null
              return (
                <Link
                  key={program.id}
                  href={`/applications?selected=${program.id}`}
                  className={cn(
                    'flex items-start gap-2 px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/40 transition-colors',
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-brand-500'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {programTypeLabel(program.type)}
                      </span>
                      {fitPct !== null && (
                        <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium ml-auto">
                          {fitPct}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{program.name}</p>
                    {deadlineSource && (
                      <p className={cn(
                        'text-[10px] mt-0.5',
                        deadline.urgent
                          ? 'text-warning-600 dark:text-warning-400 font-medium'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        {deadline.label}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })
          )
        )}
      </div>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function ApplicationDetailPanel({
  program,
  application,
  tab,
}: {
  program: ProgramWithFit
  application: UserApplication | null
  tab: TabKey
}) {
  const deadlineSource = program.cycle?.closes_at ?? program.deadline_at
  const deadline = formatDeadline(deadlineSource)
  const fitPct = program.fit ? Math.round(program.fit.fit_score) : null

  return (
    <div className="px-6 py-5 max-w-2xl">
      {/* Program name + type */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {programTypeLabel(program.type)}
          </span>
          {fitPct !== null && (
            <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
              {fitPct}% fit
            </span>
          )}
          {application && (() => {
            const status = application.status ?? 'saved'
            const statusCfg = APP_STATUS_CONFIG[status] ?? APP_STATUS_CONFIG.saved
            return (
              <span className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{statusCfg.label}</span>
              </span>
            )
          })()}
        </div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{program.name}</h2>
        {program.organization && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{program.organization}</p>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 mb-4 py-3 border-y border-neutral-100 dark:border-neutral-800">
        {deadlineSource && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Deadline</p>
            <p className={cn(
              'text-sm font-medium',
              deadline.urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-700 dark:text-neutral-300'
            )}>
              {deadline.label}
            </p>
          </div>
        )}
        {program.check_size_max != null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Check size</p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {formatCheckSize(program.check_size_max)}
            </p>
          </div>
        )}
        {program.is_rolling && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Admissions</p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Rolling</p>
          </div>
        )}
        {application?.updated_at && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Last updated</p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {formatRelative(application.updated_at)}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      {program.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-5">
          {program.description}
        </p>
      )}

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/workspace/${program.id}`}
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          {tab === 'mine' ? 'Continue in Workspace' : 'Open Workspace'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        {program.url && (
          <a
            href={program.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center justify-center gap-1 text-sm"
          >
            Website
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-60">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < hour) {
    const mins = Math.max(1, Math.round(diffMs / minute))
    return `${mins}m ago`
  }
  if (diffMs < day) {
    const hours = Math.round(diffMs / hour)
    return `${hours}h ago`
  }
  if (diffMs < 30 * day) {
    const days = Math.round(diffMs / day)
    return `${days}d ago`
  }
  return new Date(iso).toLocaleDateString()
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

type ApplicationsTabKey = 'discover' | 'mine' | 'funders'

function ApplicationsTabs({ tab }: { tab: ApplicationsTabKey }) {
  const base = 'px-3 py-1.5 rounded-md text-xs font-medium'
  const active = `${base} bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm`
  const inactive = `${base} text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200`
  return (
    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 flex-shrink-0">
      <a href="/applications" className={tab === 'discover' ? active : inactive}>
        Discover
      </a>
      <a href="/applications?tab=mine" className={tab === 'mine' ? active : inactive}>
        My Applications
      </a>
      <a href="/applications?view=funders" className={tab === 'funders' ? active : inactive}>
        Funders
      </a>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ activeIdentity }: { activeIdentity: ApplicantMode }) {
  const sparse = !isModeDeeplyCurated(activeIdentity)
  const submitHref = `/applications/submit?kind=${defaultSubmitKindForMode(activeIdentity)}`
  const contextLabel = modeContextLabel(activeIdentity).toLowerCase()
  const identityLabel = modeLabel(activeIdentity).toLowerCase()

  if (sparse) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-300/60 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/20 p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mb-4 text-amber-700 dark:text-amber-300">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
          The {contextLabel} vertical is still being built
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mx-auto">
          The engine works for {identityLabel}s today &mdash; the curated program data
          isn&apos;t there yet. Help us build it: submit a {contextLabel.replace(/s$/, '')}{' '}
          program URL and earn{' '}
          <span className="font-medium text-amber-700 dark:text-amber-300">5 drip unlocks</span>{' '}
          when it&apos;s accepted.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            href={submitHref}
            className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
          >
            Submit a {contextLabel.replace(/s$/, '')} program
          </Link>
          <Link
            href="/applications?type="
            className="px-4 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            View all programs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          className="text-neutral-400"
        >
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
        No programs yet
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
        The program archive is being built. Check back soon &mdash; or apply filters to adjust
        what you&apos;re looking for.
      </p>
    </div>
  )
}
