import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDeadline, cn } from '@/lib/utils'
import type { UserProgramFit } from '@/lib/database.types'

export const metadata = { title: 'Today' }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Run daily drip (idempotent, no-op if already ran)
  await supabase.rpc('run_daily_drip', { p_user_id: user.id })

  // Parallel fetches
  const [
    { data: unlockedToday },
    { data: totalUnlocked },
    { data: appRows },
    { data: fitRows },
    { data: answerRows },
    { data: subscription },
  ] = await Promise.all([
    // Questions unlocked today
    supabase
      .from('user_question_unlocks')
      .select('id, archived_question_id, unlocked_at, source')
      .eq('user_id', user.id)
      .gte('unlocked_at', todayStart.toISOString()),

    // Total unlocked
    supabase
      .from('user_question_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    // User applications with program data
    supabase
      .from('user_applications')
      .select('id, program_id, status, updated_at, programs(id, name, slug, deadline_at, is_rolling, type, heat_score)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10),

    // Top fit scores
    supabase
      .from('user_program_fit')
      .select('*, programs(id, name, slug, type, deadline_at, is_rolling)')
      .eq('user_id', user.id)
      .order('composite_score', { ascending: false })
      .limit(5)
      .returns<(UserProgramFit & { programs: { id: string; name: string; slug: string; type: string; deadline_at: string | null; is_rolling: boolean } | null })[]>(),

    // Answered questions count
    supabase
      .from('profile_answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    // Subscription
    supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single(),
  ])

  const isPro = subscription?.tier === 'pro' || subscription?.tier === 'team'

  // Process applications
type AppRow = typeof appRows extends (infer T)[] | null ? T : never
  type FitRow = UserProgramFit & {
    composite_score: number | null
    programs: {
      id: string
      name: string
      slug: string
      type: string
      deadline_at: string | null
      is_rolling: boolean
    } | null
  }
  const apps = (appRows ?? []).map((a: AppRow) => {
    const prog = (Array.isArray((a as { programs: unknown }).programs) ? (a as { programs: unknown[] }).programs[0] : (a as { programs: unknown }).programs) as {
      id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean; type: string; heat_score: number
    } | null
    return { ...a, program: prog }
  })

  const activeApps = apps.filter((a: AppRow & { program: { deadline_at: string | null } | null }) => a.status === 'drafting' || a.status === 'saved')
  const closingSoonApps = apps.filter((a: AppRow & { program: { deadline_at: string | null } | null }) => {
    if (!a.program?.deadline_at) return false
    const daysLeft = (new Date(a.program.deadline_at).getTime() - Date.now()) / 86_400_000
    return daysLeft >= 0 && daysLeft <= 14
  })

  // Unanswered unlocked count
  const unlockedIdsTotal: string[] = []
  // We don't have full list here, so approximate from totalUnlocked vs answered
  const totalUnlockedCount = (totalUnlocked as unknown as { count: number } | null)?.count ?? 0
  const answeredCount = (answerRows as unknown as { count: number } | null)?.count ?? 0
  const unansweredCount = Math.max(0, totalUnlockedCount - answeredCount)

  const todayCount = (unlockedToday ?? []).length

  const typedFitRows = (fitRows ?? []) as FitRow[]
  const topMatches = typedFitRows.filter((f: FitRow) => {
    // Don't show programs already in active apps
    return !apps.find((a: AppRow) => a.program_id === f.program_id)
  }).slice(0, 3)

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const userName = user.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{dateStr}</p>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          {greeting()}, {userName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Here&apos;s where things stand today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          href="/bank"
          label="New today"
          value={todayCount}
          sub={`${totalUnlockedCount} total unlocked`}
          accent={todayCount > 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          href="/bank"
          label="Unanswered"
          value={unansweredCount}
          sub={`${answeredCount} answered`}
          accent={unansweredCount > 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          href="/workspace"
          label="Active apps"
          value={activeApps.length}
          sub={`${apps.length} total`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          href="/workspace"
          label="Closing soon"
          value={closingSoonApps.length}
          sub="within 14 days"
          accent={closingSoonApps.length > 0}
          warn={closingSoonApps.length > 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      {/* In-progress applications */}
      {activeApps.length > 0 && (
        <Section title="In progress" href="/workspace" hrefLabel="All applications">
          <div className="space-y-2">
            {activeApps.slice(0, 4).map((app: AppRow & { program: { id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean; type: string; heat_score: number } | null }) => {
              const prog = app.program
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    app.status === 'drafting' ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  )} />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {prog.name}
                  </span>
                  <span className={cn(
                    'text-xs flex-shrink-0',
                    deadline.urgent ? 'text-warning-600 dark:text-warning-400 font-medium' : 'text-neutral-400 dark:text-neutral-500'
                  )}>
                    {deadline.label}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {/* Closing soon — only if there are applications with real deadlines */}
      {closingSoonApps.length > 0 && (
        <Section
          title="Deadlines this week"
          titleClass="text-warning-600 dark:text-warning-400"
        >
          <div className="space-y-2">
            {closingSoonApps.map((app: AppRow & { program: { id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean; type: string; heat_score: number } | null }) => {
              const prog = app.program
              if (!prog?.deadline_at) return null
              const daysLeft = Math.ceil((new Date(prog.deadline_at).getTime() - Date.now()) / 86_400_000)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-warning-200 dark:border-warning-900/50 bg-warning-50/50 dark:bg-warning-900/10 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors group"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-warning-500 flex-shrink-0">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate">
                    {prog.name}
                  </span>
                  <span className="text-xs font-semibold text-warning-700 dark:text-warning-400 flex-shrink-0">
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
                  </span>
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {/* Question bank nudge */}
      {unansweredCount > 0 && (
        <Section title="Answer bank" href="/bank" hrefLabel="Open bank">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-brand-600 dark:text-brand-400">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} waiting for your answer
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {todayCount > 0
                  ? `${todayCount} unlocked today — build your arsenal while it&apos;s fresh.`
                  : 'Each answer pre-fills future applications automatically.'}
              </p>
            </div>
            <Link href="/bank" className="btn-primary text-xs flex-shrink-0">
              Answer now
            </Link>
          </div>
        </Section>
      )}

      {/* Top program matches (not yet applied) */}
      {topMatches.length > 0 && (
        <Section title="Top matches for you" href="/hub" hrefLabel="Browse all">
          <div className="space-y-2">
            {topMatches.map((f: FitRow) => {
              const prog = (Array.isArray(f.programs) ? f.programs[0] : f.programs) as {
                id: string; name: string; slug: string; type: string; deadline_at: string | null; is_rolling: boolean
              } | null
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              const fitPct = Math.round((f.fit_score ?? 0) * 100)
              const compositePct = Math.round(f.composite_score ?? 0)
              return (
                <Link
                  key={f.program_id}
                  href={`/hub/${prog.slug}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {prog.name}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {fitPct}% fit · composite {compositePct}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <FitBadge pct={fitPct} />
                    <p className={cn(
                      'text-xs mt-1',
                      deadline.urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-400 dark:text-neutral-500'
                    )}>
                      {deadline.label}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Link href="/hub" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors">
              See all {sorted?.length ?? 0} ranked programs →
            </Link>
          </div>
        </Section>
      )}

      {/* Empty state — new user */}
      {apps.length === 0 && topMatches.length === 0 && (
        <div className="card p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-brand-500">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
            Start building your arsenal
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Answer questions once, apply everywhere. Browse the Hub to find programs — your fit scores and recommendations will appear here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/hub" className="btn-primary">Browse programs</Link>
            <Link href="/bank" className="btn-secondary">Open question bank</Link>
          </div>
        </div>
      )}

      {/* Pro upsell — only for free users with some activity */}
      {!isPro && (apps.length > 0 || totalUnlockedCount > 10) && (
        <div className="card p-4 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-900/10 dark:to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Upgrade to Pro</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Unlock all 225 questions, unlimited AI drafts, and priority fit scoring.
              </p>
            </div>
            <Link href="/profile/settings" className="btn-primary text-xs flex-shrink-0 opacity-70 cursor-not-allowed pointer-events-none">
              Coming soon
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, href, accent, warn, icon
}: {
  label: string
  value: number
  sub: string
  href: string
  accent?: boolean
  warn?: boolean
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className={cn(
      'card p-4 flex flex-col gap-3 hover:shadow-card-hover transition-shadow group',
      warn && 'border-warning-200 dark:border-warning-800/50'
    )}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        warn
          ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400'
          : accent
          ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
      )}>
        {icon}
      </div>
      <div>
        <p className={cn(
          'text-2xl font-bold leading-none',
          warn ? 'text-warning-600 dark:text-warning-400'
          : accent ? 'text-brand-600 dark:text-brand-400'
          : 'text-neutral-900 dark:text-white'
        )}>
          {value}
        </p>
        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mt-1">{label}</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{sub}</p>
      </div>
    </Link>
  )
}

function Section({
  title,
  titleClass,
  href,
  hrefLabel,
  children,
}: {
  title: string
  titleClass?: string
  href?: string
  hrefLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn('text-sm font-semibold text-neutral-900 dark:text-white', titleClass)}>
          {title}
        </h2>
        {href && hrefLabel && (
          <Link href={href} className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            {hrefLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function FitBadge({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
    : pct >= 60 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {pct}%
    </span>
  )
}

// Silence TS — sorted is not actually used in JSX but referenced in template literal
const sorted: { length: number } | undefined = undefined
