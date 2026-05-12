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
import { ProgramCard } from '@/components/ProgramCard'
import { ModeSelector } from '@/components/ModeSelector'
import {
  DEFAULT_MODE,
  defaultSubmitKindForMode,
  isModeDeeplyCurated,
  modeContextLabel,
  modeLabel,
  modeToLegacyTypes,
} from '@/lib/applicantMode'
import { formatDeadline, programTypeLabel, cn } from '@/lib/utils'
import { HubFilters } from './HubFilters'
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
  searchParams: Promise<{ sort?: string; type?: string; rolling?: string; view?: string; domain?: string; tab?: string }>
}) {
  const resolvedParams = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tab: TabKey = resolvedParams.tab === 'mine' ? 'mine' : 'discover'
  // Fetch the user's active applicant mode + claimed identities. Falls back
  // to founder for users on profiles created before migration 027.
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

  // Funders view short-circuits — we don't need program/fit/app data.
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

  // Fetch programs. If the user hasn't explicitly filtered by type, scope to
  // the legacy program_type values mapped from their active applicant mode.
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

  // Domain guard — keeps the hub scoped to the active domain.
  // Defaults to 'founder' until multi-domain UI is built.
  const activeDomain = resolvedParams.domain ?? 'founder'
  query = query.eq('domain', activeDomain)

  const { data: programs } = await query.returns<Program[]>()

  // Fetch fit scores if logged in
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

  // Fetch user's application statuses for all programs
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

  // Fetch next active cycle for each program
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

  // For the "Mine" tab — the discover query may have filtered out programs
  // the user already applied to (different type/domain than active identity).
  // Fetch any missing program rows so My Applications always lists everything.
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

      // Also pull cycles + fit for these
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
    // composite default: programs closing <=60 days always surface first
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

  const view = resolvedParams.view === 'timeline' ? 'timeline' : 'cards'

  // For the "Mine" tab: hydrate the user's applications with program + fit data.
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

  return (
    <div>
      <div className="mb-4">
        {user && <ModeSelector activeIdentity={activeIdentity} identities={identities} />}
      </div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Applications</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {tab === 'mine'
              ? mineRows.length > 0
                ? `${mineRows.length} active application${mineRows.length === 1 ? '' : 's'} · most recent first`
                : 'Track the programs you’re actively applying to'
              : sorted.length > 0
              ? `${sorted.length} ${modeContextLabel(activeIdentity).toLowerCase()} ranked by fit and opportunity value`
              : `Discover ${modeContextLabel(activeIdentity).toLowerCase()} matched to your profile`}
            {' '}
            <Link
              href="/about/scoring"
              className="text-neutral-400 dark:text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors whitespace-nowrap"
            >
              How scores work
            </Link>
          </p>
        </div>

        <ApplicationsTabs tab={tab} />
      </div>

      {tab === 'mine' ? (
        <MyApplicationsList rows={mineRows} />
      ) : (
        <>
          {/* Sub-view tabs (Programs / Timeline) — only visible in Discover */}
          <div className="mb-4 flex justify-end">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 flex-shrink-0">
              <a href="/applications"
                className={view === 'cards'
                  ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'px-3 py-1.5 rounded-md text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}>
                Programs
              </a>
              <a href="/applications?view=timeline"
                className={view === 'timeline'
                  ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'px-3 py-1.5 rounded-md text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}>
                Timeline
              </a>
            </div>
          </div>

          {view === 'timeline' ? (
            <TimelineView programs={sorted} />
          ) : (
            <div className="flex gap-6">
              <aside className="w-48 flex-shrink-0 hidden lg:block">
                <HubFilters currentSort={sort} currentType={resolvedParams.type} currentRolling={resolvedParams.rolling} />
              </aside>
              <div className="flex-1 min-w-0">
                {sorted.length === 0 ? (
                  <EmptyState activeIdentity={activeIdentity} />
                ) : (
                  <div className="space-y-3">
                    {sorted.map((program, i) => (
                      <ProgramCard key={program.id} program={program} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

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
          The engine works for {identityLabel}s today — the curated program data
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
        The program archive is being built. Check back soon — or apply filters to adjust
        what you&apos;re looking for.
      </p>
    </div>
  )
}

// --- My Applications tab ---

type MineRow = {
  application: UserApplication
  program: Program
  fit: UserProgramFit | undefined
  cycle: ProgramNextCycle | null
}

function MyApplicationsList({ rows }: { rows: MineRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
          No applications yet
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
          No applications yet — pick one from{' '}
          <Link href="/applications" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
            Discover →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const { application, program, fit, cycle } = row
        const deadlineSource = cycle?.closes_at ?? program.deadline_at
        const deadline = formatDeadline(deadlineSource)
        const status = application.status ?? 'saved'
        const statusCfg = APP_STATUS_CONFIG[status] ?? APP_STATUS_CONFIG.saved
        const fitPct = fit ? Math.round(fit.fit_score * 100) : null
        const lastUpdated = application.updated_at ?? application.created_at
        const lastUpdatedLabel = lastUpdated ? formatRelative(lastUpdated) : null

        return (
          <Link
            key={application.id}
            href={`/workspace/${program.id}`}
            className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {programTypeLabel(program.type)}
                </span>
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusCfg.dot)} />
                <span className="text-xs text-neutral-400 dark:text-neutral-500">{statusCfg.label}</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {program.name}
              </h3>
              {lastUpdatedLabel && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  Updated {lastUpdatedLabel}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              {deadlineSource && (
                <p className={cn(
                  'text-xs',
                  deadline.urgent
                    ? 'text-warning-600 dark:text-warning-400 font-medium'
                    : 'text-neutral-400 dark:text-neutral-500'
                )}>
                  {deadline.label}
                </p>
              )}
              {fitPct !== null && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  {fitPct}% fit
                </p>
              )}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="text-neutral-300 dark:text-neutral-600 flex-shrink-0"
            >
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )
      })}
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

// --- Timeline view ---

function TimelineView({ programs }: { programs: ProgramWithFit[] }) {
  const MS_PER_DAY = 86_400_000
  const now = Date.now()

  function daysLeft(p: ProgramWithFit) {
    const deadline = p.cycle?.closes_at ?? p.deadline_at
    if (!deadline) return null
    return Math.ceil((new Date(deadline).getTime() - now) / MS_PER_DAY)
  }

  const rolling = programs.filter(p => p.is_rolling || (!p.cycle?.closes_at && !p.deadline_at))
  const withDeadline = programs.filter(p => !p.is_rolling && (p.cycle?.closes_at || p.deadline_at))
  const closingSoon = withDeadline.filter(p => { const d = daysLeft(p); return d !== null && d >= 0 && d <= 14 })
  const open = withDeadline.filter(p => { const d = daysLeft(p); return d !== null && d > 14 })
  const closed = withDeadline.filter(p => { const d = daysLeft(p); return d !== null && d! < 0 })

  return (
    <div className="space-y-8">
      {closingSoon.length > 0 && (
        <TimelineSection title="Closing Soon" subtitle={`${closingSoon.length} program${closingSoon.length !== 1 ? 's' : ''} closing within 14 days`} urgent>
          {closingSoon.map(p => <TimelineRow key={p.id} program={p} days={daysLeft(p)} />)}
        </TimelineSection>
      )}
      {open.length > 0 && (
        <TimelineSection title="Open" subtitle={`${open.length} program${open.length !== 1 ? 's' : ''} with upcoming deadlines`}>
          {open.map(p => <TimelineRow key={p.id} program={p} days={daysLeft(p)} />)}
        </TimelineSection>
      )}
      {rolling.length > 0 && (
        <TimelineSection title="Rolling Admissions" subtitle="Always accepting — apply any time">
          {rolling.map(p => <TimelineRow key={p.id} program={p} days={null} />)}
        </TimelineSection>
      )}
      {closed.length > 0 && (
        <TimelineSection title="Closed" subtitle="Bookmark for next cycle" dimmed>
          {closed.map(p => <TimelineRow key={p.id} program={p} days={daysLeft(p)} />)}
        </TimelineSection>
      )}
    </div>
  )
}

function TimelineSection({ title, subtitle, urgent, dimmed, children }: {
  title: string; subtitle: string; urgent?: boolean; dimmed?: boolean; children: React.ReactNode
}) {
  return (
    <div className={dimmed ? 'opacity-50' : undefined}>
      <div className="mb-3">
        <h2 className={`text-sm font-semibold ${urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-900 dark:text-white'}`}>{title}</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}


function TimelineRow({ program, days }: { program: ProgramWithFit; days: number | null }) {
  const pct = days === null ? 0
    : days < 0 ? 100
    : Math.max(0, Math.min(100, Math.round((1 - days / 120) * 100)))

  const barColor = days === null ? 'bg-brand-500'
    : days < 0 ? 'bg-neutral-300 dark:bg-neutral-700'
    : days <= 7 ? 'bg-warning-500'
    : days <= 30 ? 'bg-success-500'
    : 'bg-brand-500'

  return (
    <Link href={`/applications/${program.slug}`} className="card p-4 block hover:shadow-card-hover transition-shadow group">
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
          {program.name}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          {days === null ? 'Rolling' : days < 0 ? 'Closed' : `${days}d left`}
        </span>
      </div>
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
        <div className={`h-1 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  )
}

// --- Top-level tab switcher (Discover / My Applications / Funders) ---

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

