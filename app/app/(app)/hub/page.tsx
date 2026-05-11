import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type {
  Program,
  UserProgramFit,
  UserApplication,
  ProgramWithFit,
  ApplicantMode,
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
import { HubFilters } from './HubFilters'

export const metadata = {
  title: 'Program Hub',
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: { sort?: string; type?: string; rolling?: string; view?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // Fetch programs. If the user hasn't explicitly filtered by type, scope to
  // the legacy program_type values mapped from their active applicant mode.
  let query = supabase
    .from('programs')
    .select('*')
    .order('heat_score', { ascending: false })

  if (searchParams.type) {
    query = query.eq('type', searchParams.type)
  } else {
    const allowedTypes = modeToLegacyTypes(activeIdentity)
    if (allowedTypes.length > 0) {
      query = query.in('type', allowedTypes as unknown as string[])
    }
  }
  if (searchParams.rolling === 'true') {
    query = query.eq('is_rolling', true)
  }

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

  const programsWithFit: ProgramWithFit[] = (programs ?? []).map((p) => ({
    ...p,
    fit: fitMap[p.id],
    application: applicationMap[p.id],
  }))

  // Sort
  const now = Date.now()
  const MS_PER_DAY = 86_400_000

  const sort = searchParams.sort ?? 'composite'
  const sorted = [...programsWithFit].sort((a, b) => {
    if (sort === 'heat') return b.heat_score - a.heat_score
    if (sort === 'deadline') {
      const da = a.deadline_at ?? '9999-12-31'
      const db = b.deadline_at ?? '9999-12-31'
      return da.localeCompare(db)
    }
    // composite default: programs closing <=60 days always surface first
    const daysA = a.deadline_at ? (new Date(a.deadline_at).getTime() - now) / MS_PER_DAY : Infinity
    const daysB = b.deadline_at ? (new Date(b.deadline_at).getTime() - now) / MS_PER_DAY : Infinity
    const urgentA = daysA > 0 && daysA <= 60
    const urgentB = daysB > 0 && daysB <= 60
    if (urgentA !== urgentB) return urgentA ? -1 : 1
    if (urgentA && urgentB) return daysA - daysB
    const scoreA = a.fit ? a.fit.composite_score : a.heat_score
    const scoreB = b.fit ? b.fit.composite_score : b.heat_score
    return scoreB - scoreA
  })

  const view = searchParams.view === 'timeline' ? 'timeline' : 'cards'

  return (
    <div>
      <div className="mb-4">
        {user && <ModeSelector activeIdentity={activeIdentity} identities={identities} />}
      </div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Hub</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {sorted.length > 0
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

        {/* View tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 flex-shrink-0">
          <a href="/hub"
            className={view === 'cards'
              ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'px-3 py-1.5 rounded-md text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}>
            Programs
          </a>
          <a href="/hub?view=timeline"
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
            <HubFilters currentSort={sort} currentType={searchParams.type} currentRolling={searchParams.rolling} />
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
    </div>
  )
}

function EmptyState({ activeIdentity }: { activeIdentity: ApplicantMode }) {
  const sparse = !isModeDeeplyCurated(activeIdentity)
  const submitHref = `/hub/submit?kind=${defaultSubmitKindForMode(activeIdentity)}`
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
            href="/hub?type="
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

// ─── Timeline view ────────────────────────────────────────────────────────────

function TimelineView({ programs }: { programs: ProgramWithFit[] }) {
  const MS_PER_DAY = 86_400_000
  const now = Date.now()

  function daysLeft(p: ProgramWithFit) {
    if (!p.deadline_at) return null
    return Math.ceil((new Date(p.deadline_at).getTime() - now) / MS_PER_DAY)
  }

  const rolling = programs.filter(p => p.is_rolling || !p.deadline_at)
  const withDeadline = programs.filter(p => !p.is_rolling && p.deadline_at)
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
    <Link href={`/hub/${program.slug}`} className="card p-4 block hover:shadow-card-hover transition-shadow group">
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
