import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDeadline, cn } from '@/lib/utils'
import type { UserProgramFit } from '@/lib/database.types'
import { computeAquaScore, nextTierDelta, aquaScoreTier, type AquaScoreInputs } from '@/lib/aquascore'

export const metadata = { title: 'Dash' }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  await supabase.rpc('run_daily_drip', { p_user_id: user.id })

  const [
    unlockedTodayRes,
    totalUnlockedRes,
    appsRes,
    fitRes,
    answersAllRes,
    answersThisWeekRes,
    subRes,
    achievementsRes,
    stressTestsRes,
    profileRes,
    balanceRes,
  ] = await Promise.all([
    supabase
      .from('user_question_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .gte('unlocked_at', todayStart.toISOString()),
    supabase
      .from('user_question_unlocks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('user_applications')
      .select('id, program_id, status, updated_at, programs(id, name, slug, deadline_at, is_rolling, type)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('user_program_fit')
      .select('*, programs(id, name, slug, type, deadline_at, is_rolling)')
      .eq('user_id', user.id)
      .order('fit_score', { ascending: false })
      .limit(8)
      .returns<(UserProgramFit & { programs: { id: string; name: string; slug: string; type: string; deadline_at: string | null; is_rolling: boolean } | null })[]>(),
    supabase
      .from('profile_answers')
      .select('id, archived_question_id, confidence, word_count, archived_question:archived_questions(theme)')
      .eq('user_id', user.id),
    supabase
      .from('profile_answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('last_updated', weekStart.toISOString()),
    supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })
      .limit(8),
    supabase
      .from('answer_stress_tests')
      .select('id')
      .eq('user_id', user.id),
    supabase
      .from('user_profiles')
      .select('active_identity, github_url, linkedin_url')
      .eq('user_id', user.id)
      .maybeSingle<{ active_identity: string; github_url: string | null; linkedin_url: string | null }>(),
    supabase
      .from('user_credit_balance')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle<{ balance: number }>(),
  ])

  const isPro = subRes.data?.tier === 'pro' || subRes.data?.tier === 'team'
  const todayCount = (unlockedTodayRes.data ?? []).length
  const totalUnlocked = totalUnlockedRes.count ?? 0
  const allAnswers = answersAllRes.data ?? []
  const answered = allAnswers.length
  const unanswered = Math.max(0, totalUnlocked - answered)
  const answeredThisWeek = answersThisWeekRes.count ?? 0
  const stressTestCount = (stressTestsRes.data ?? []).length
  const achievements = achievementsRes.data ?? []
  const creditBalance = balanceRes.data?.balance ?? 0

  const apps = (appsRes.data ?? []).map((a) => {
    const prog = (Array.isArray(a.programs) ? a.programs[0] : a.programs) as {
      id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean; type: string
    } | null
    return { ...a, program: prog }
  })
  const themeCount: Record<string, number> = {}
  for (const a of allAnswers) {
    const theme = (Array.isArray(a.archived_question) ? a.archived_question[0]?.theme : (a.archived_question as { theme?: string } | null)?.theme) as string | undefined
    if (theme) themeCount[theme] = (themeCount[theme] ?? 0) + 1
  }
  const lockedCount = allAnswers.filter((a) => a.confidence === 'locked').length
  const solidCount = allAnswers.filter((a) => a.confidence === 'solid').length
  const totalWords = allAnswers.reduce((sum, a) => sum + (a.word_count ?? 0), 0)
  const avgWordCount = answered > 0 ? Math.round(totalWords / answered) : 0
  const typesCovered = new Set(apps.map((a) => a.program?.type).filter(Boolean)).size

  const scoreInputs: AquaScoreInputs = {
    applicationsStarted: apps.length,
    applicationsSubmitted: apps.filter((a) => ['submitted', 'accepted', 'waitlisted'].includes(a.status)).length,
    programTypesCovered: typesCovered,
    themesCovered: Object.keys(themeCount).length,
    questionsAnswered: answered,
    questionsUnlocked: totalUnlocked,
    totalAnswers: answered,
    lockedConfidenceCount: lockedCount,
    solidConfidenceCount: solidCount,
    averageWordCount: avgWordCount,
    stressTestCount,
  }
  const score = computeAquaScore(scoreInputs)
  const tier = aquaScoreTier(score.composite)
  const delta = nextTierDelta(score, scoreInputs)

  const challenges: { label: string; href: string; progress?: { done: number; target: number } }[] = []
  if (delta.pointsGain > 0) {
    challenges.push({ label: delta.hint, href: `/${delta.pillar === 'applications' ? 'applications' : delta.pillar === 'questions' ? 'questions' : 'answers'}` })
  }
  if (stressTestCount < 3) {
    challenges.push({
      label: `Stress-test ${3 - stressTestCount} more answer${3 - stressTestCount === 1 ? '' : 's'}`,
      href: '/answers',
      progress: { done: stressTestCount, target: 3 },
    })
  }
  if (todayCount > 0) {
    challenges.push({
      label: `Answer ${todayCount} fresh question${todayCount === 1 ? '' : 's'} unlocked today`,
      href: '/questions',
      progress: { done: 0, target: todayCount },
    })
  }
  if (!profileRes.data?.github_url && Object.keys(themeCount).length >= 4) {
    challenges.push({
      label: 'Add a GitHub URL to unlock FundScore and FMS boost layers',
      href: '/profile/about',
    })
  }

  const activeApps = apps.filter((a) => a.status === 'drafting' || a.status === 'saved')
  const closingSoonApps = apps.filter((a) => {
    if (!a.program?.deadline_at) return false
    const d = (new Date(a.program.deadline_at).getTime() - Date.now()) / 86_400_000
    return d >= 0 && d <= 14
  })
  const appliedIds = new Set(apps.map((a) => a.program_id))
  const topMatches = (fitRes.data ?? []).filter((f) => !appliedIds.has(f.program_id)).slice(0, 3)

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const userName = (user.email ?? '').split('@')[0] ?? 'there'

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{dateStr}</p>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          {greeting()}, {userName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Here&apos;s where you stand today.
        </p>
      </div>

      <div className="card p-6 bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/30 dark:to-neutral-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              AQUAscore
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-neutral-900 dark:text-white tabular-nums">
                {score.composite}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">/ 100</span>
              <Link
                href="/profile/persona"
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
              >
                Breakdown →
              </Link>
            </div>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{tier.tier}</span>
              <span className="text-neutral-500 dark:text-neutral-400 font-normal"> · {tier.description}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 md:gap-6 text-center md:text-right">
            <Pillar label="Apps" value={score.applications} />
            <Pillar label="Questions" value={score.questions} />
            <Pillar label="Answers" value={score.answers} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-brand-200/60 dark:border-brand-800/40">
          <MicroStat label="In progress" value={activeApps.length} />
          <MicroStat label="Answered this week" value={answeredThisWeek} />
          <MicroStat label="Days of Pro" value={creditBalance} suffix="§" />
          <MicroStat label="Achievements" value={achievements.length} />
        </div>
      </div>

      {challenges.length > 0 && (
        <Section title="Active challenges" titleClass="text-neutral-900 dark:text-white">
          <div className="space-y-2">
            {challenges.slice(0, 4).map((c, i) => (
              <Link
                key={i}
                href={c.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-brand-400 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                    {c.label}
                  </p>
                  {c.progress && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-brand-500 transition-all"
                          style={{ width: `${Math.min(100, (c.progress.done / c.progress.target) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {c.progress.done}/{c.progress.target}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronIcon />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {achievements.length > 0 && (
        <Section title="Rewards unlocked" href="/profile/credits" hrefLabel="Days dashboard">
          <div className="flex flex-wrap gap-2">
            {achievements.slice(0, 6).map((ach) => (
              <span
                key={ach.achievement_id}
                title={`Unlocked ${new Date(ach.unlocked_at as string).toLocaleDateString()}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-900/40 text-xs font-medium text-success-700 dark:text-success-300"
              >
                <span>🏆</span>
                <span>{prettifyAchievement(ach.achievement_id as string)}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {closingSoonApps.length > 0 && (
        <Section title="Deadlines this week" titleClass="text-warning-600 dark:text-warning-400">
          <div className="space-y-2">
            {closingSoonApps.map((app) => {
              const prog = app.program
              if (!prog?.deadline_at) return null
              const daysLeft = Math.ceil((new Date(prog.deadline_at).getTime() - Date.now()) / 86_400_000)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-warning-200 dark:border-warning-900/50 bg-warning-50/50 dark:bg-warning-900/10 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors group"
                >
                  <WarnIcon />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate">{prog.name}</span>
                  <span className="text-xs font-semibold text-warning-700 dark:text-warning-400 flex-shrink-0">
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
                  </span>
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {activeApps.length > 0 && (
        <Section title="In progress" href="/applications?tab=mine" hrefLabel="All applications">
          <div className="space-y-1">
            {activeApps.slice(0, 4).map((app) => {
              const prog = app.program
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      app.status === 'drafting' ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'
                    )}
                  />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white flex-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {prog.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs flex-shrink-0',
                      deadline.urgent ? 'text-warning-600 dark:text-warning-400 font-medium' : 'text-neutral-400 dark:text-neutral-500'
                    )}
                  >
                    {deadline.label}
                  </span>
                  <ChevronIcon />
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {topMatches.length > 0 && (
        <Section title="Top matches for you" href="/applications" hrefLabel="Browse all">
          <div className="space-y-1">
            {topMatches.map((f) => {
              const prog = (Array.isArray(f.programs) ? f.programs[0] : f.programs) as {
                id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean
              } | null
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              const fitPct = Math.round((f.fit_score ?? 0) * 100)
              return (
                <Link
                  key={f.program_id}
                  href={`/applications/${prog.slug}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {prog.name}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {fitPct}% fit
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <FitBadge pct={fitPct} />
                    <p
                      className={cn(
                        'text-xs mt-1',
                        deadline.urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-400 dark:text-neutral-500'
                      )}
                    >
                      {deadline.label}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {apps.length === 0 && topMatches.length === 0 && answered === 0 && (
        <div className="card p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 mb-5">
            <QuestionIcon className="text-brand-500 w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Start building your AQUAscore</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Answer questions once, apply everywhere. Every captured moment moves your score up.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/applications" className="btn-primary">Browse programs</Link>
            <Link href="/questions" className="btn-secondary">Open question bank</Link>
          </div>
        </div>
      )}

      {!isPro && (apps.length > 0 || totalUnlocked > 5) && (
        <div className="card p-4 bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-900/10 dark:to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Upgrade to Pro</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Unlock the full question archive, unlimited AI drafts, and priority fit scoring.
              </p>
            </div>
            <Link href="/profile/settings" className="btn-primary text-xs flex-shrink-0">
              Upgrade
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function prettifyAchievement(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Pillar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold text-neutral-900 dark:text-white tabular-nums">{value}</p>
      <div className="w-14 md:w-16 mx-auto md:ml-auto md:mr-0 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1 mt-1">
        <div
          className={cn(
            'h-1 rounded-full transition-all',
            value >= 70 ? 'bg-success-500' : value >= 40 ? 'bg-brand-500' : 'bg-warning-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function MicroStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-base font-semibold text-neutral-900 dark:text-white tabular-nums mt-0.5">
        {suffix && <span className="text-neutral-400 mr-0.5">{suffix}</span>}
        {value}
      </p>
    </div>
  )
}

function Section({ title, titleClass, href, hrefLabel, children }: {
  title: string; titleClass?: string; href?: string; hrefLabel?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn('text-sm font-semibold text-neutral-900 dark:text-white', titleClass)}>{title}</h2>
        {href && hrefLabel && (
          <Link href={href} className="text-xs text-neutral-400 hover:text-brand-600 dark:text-neutral-500 dark:hover:text-brand-400 transition-colors">
            {hrefLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function FitBadge({ pct }: { pct: number }) {
  const c = pct >= 80 ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
    : pct >= 60 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', c)}>{pct}%</span>
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-warning-500 flex-shrink-0">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
