import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDeadline, cn } from '@/lib/utils'
import type { UserProgramFit } from '@/lib/database.types'
import { computeAquaScore, nextTierDelta, aquaScoreTier, type AquaScoreInputs } from '@/lib/aquascore'
import WeeklyPoll from '@/components/WeeklyPoll'

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
    questionOfDayRes,
    outcomesRes,
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
    supabase
      .from('user_question_unlocks')
      .select('archived_question_id, archived_question:archived_questions(id, text, theme, significance_score, typical_word_limit)')
      .eq('user_id', user.id)
      .order('archived_question(significance_score)', { ascending: false })
      .limit(20),
    supabase
      .from('user_applications')
      .select('status, would_recommend, outcome_logged_at')
      .eq('user_id', user.id)
      .in('status', ['accepted', 'waitlisted', 'rejected']),
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

  const outcomes = outcomesRes.data ?? []
  const outcomeAccepted = outcomes.filter((o) => o.status === 'accepted').length
  const outcomeWaitlisted = outcomes.filter((o) => o.status === 'waitlisted').length
  const outcomeRejected = outcomes.filter((o) => o.status === 'rejected').length
  const outcomeTotal = outcomeAccepted + outcomeWaitlisted + outcomeRejected
  const recommendValues = outcomes
    .map((o) => (o as { would_recommend: number | null }).would_recommend)
    .filter((v): v is number => typeof v === 'number')
  const avgRecommend = recommendValues.length > 0
    ? recommendValues.reduce((s, v) => s + v, 0) / recommendValues.length
    : null

  // Question of the day
  const answeredIds = new Set(allAnswers.map((a) => a.archived_question_id))
  const qodRaw = (questionOfDayRes.data ?? []).find((u) => {
    const aq = Array.isArray(u.archived_question) ? u.archived_question[0] : u.archived_question
    return aq && !answeredIds.has(u.archived_question_id)
  })
  const questionOfDay = qodRaw
    ? (() => {
        const aq = Array.isArray(qodRaw.archived_question) ? qodRaw.archived_question[0] : qodRaw.archived_question
        return aq as { id: string; text: string; theme: string; significance_score: number; typical_word_limit: number | null } | null
      })()
    : null

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

  // Build digest feed items
  const digestItems: { icon: string; text: string; href: string }[] = []
  if (todayCount > 0) {
    digestItems.push({ icon: '🔓', text: `${todayCount} new question${todayCount === 1 ? '' : 's'} unlocked today`, href: '/questions' })
  }
  if (closingSoonApps.length > 0) {
    const app = closingSoonApps[0]
    if (app.program?.deadline_at) {
      const daysLeft = Math.ceil((new Date(app.program.deadline_at).getTime() - Date.now()) / 86_400_000)
      digestItems.push({ icon: '⏰', text: `${app.program.name} closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, href: `/workspace/${app.program_id}` })
    }
  }
  if (topMatches[0]) {
    const prog = (Array.isArray(topMatches[0].programs) ? topMatches[0].programs[0] : topMatches[0].programs) as { name: string; slug: string } | null
    if (prog) {
      const fitPct = Math.round(topMatches[0].fit_score ?? 0)
      digestItems.push({ icon: '✨', text: `Top match: ${prog.name} (${fitPct}% fit)`, href: `/applications/${prog.slug}` })
    }
  }
  if (unanswered > 0) {
    digestItems.push({ icon: '📝', text: `${unanswered} unanswered question${unanswered === 1 ? '' : 's'} in your bank`, href: '/questions' })
  }
  if (answeredThisWeek > 0) {
    digestItems.push({ icon: '✅', text: `${answeredThisWeek} answer${answeredThisWeek === 1 ? '' : 's'} refined this week`, href: '/answers' })
  }
  if (stressTestCount > 0) {
    digestItems.push({ icon: '🧪', text: `${stressTestCount} stress test${stressTestCount === 1 ? '' : 's'} run`, href: '/answers' })
  }
  if (achievements.length > 0) {
    digestItems.push({ icon: '🏆', text: `${achievements.length} achievement${achievements.length === 1 ? '' : 's'} earned`, href: '/profile/credits' })
  }
  digestItems.push({ icon: '📊', text: `AQUAscore: ${score.composite}/100 · ${tier.tier}`, href: '/profile/persona' })

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{dateStr}</p>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mt-0.5">
            {greeting()}, {userName}
          </h1>
        </div>
        <Link
          href="/applications?tab=discover"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          <PlusIcon />
          Add Application
        </Link>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard
          label="AQUAscore"
          value={`${score.composite}`}
          sub="/ 100"
          href="/profile/persona"
          accent="brand"
        />
        <StatCard
          label="Answered"
          value={`${answered}`}
          sub={unanswered > 0 ? `${unanswered} unanswered` : 'all done'}
          href="/answers"
        />
        <StatCard
          label="Unlocked"
          value={`${totalUnlocked}`}
          sub="questions"
          href="/questions"
        />
        <StatCard
          label="Days"
          value={`§${creditBalance}`}
          sub="credits"
          href="/profile/credits"
          accent="orange"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left column */}
        <div className="lg:col-span-5 space-y-3">
          {/* Widget 1 — Question of the Day */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Question of the Day
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                ★ Answer to earn a credit
              </span>
            </div>
            {questionOfDay ? (
              <>
                <p className="text-sm font-medium text-neutral-900 dark:text-white leading-snug mb-2">
                  {questionOfDay.text}
                </p>
                <div className="flex items-center gap-2 mb-3">
                  {questionOfDay.theme && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      {questionOfDay.theme}
                    </span>
                  )}
                  <SignificanceStars score={questionOfDay.significance_score} />
                </div>
                <Link
                  href="/questions"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  Answer it <ChevronIcon />
                </Link>
              </>
            ) : (
              <div className="py-3 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Check the Question Bank for new questions</p>
                <Link href="/questions" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                  Open Question Bank <ChevronIcon />
                </Link>
              </div>
            )}
          </div>

          {/* Widget 2 — Weekly Poll */}
          <div className="card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              Weekly Poll
            </p>
            <WeeklyPoll />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-7 space-y-3">
          {/* Widget 3 — Today's Digest */}
          <div className="card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              {"Today's Digest"}
            </p>
            <div className="space-y-0.5">
              {digestItems.slice(0, 7).map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <span className="text-sm flex-shrink-0 w-5 text-center">{item.icon}</span>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 flex-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {item.text}
                  </span>
                  <ChevronIcon />
                </Link>
              ))}
              {digestItems.length === 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 py-2 px-2">
                  No activity yet — start by answering a question.
                </p>
              )}
            </div>
          </div>

          {/* Widget 4 — Active Challenges */}
          {challenges.length > 0 && (
            <div className="card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Active Challenges
              </p>
              <div className="space-y-1.5">
                {challenges.slice(0, 3).map((c, i) => (
                  <Link
                    key={i}
                    href={c.href}
                    className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-brand-400 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition-colors group"
                  >
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-brand-700 dark:text-brand-300">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-800 dark:text-neutral-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors leading-snug">
                        {c.label}
                      </p>
                      {c.progress && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
                            <div
                              className="h-1 rounded-full bg-brand-500 transition-all"
                              style={{ width: `${Math.min(100, (c.progress.done / c.progress.target) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-neutral-500 dark:text-neutral-400 tabular-nums flex-shrink-0">
                            {c.progress.done}/{c.progress.target}
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronIcon />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Col A — Top Matches */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Top Matches
            </p>
            <Link href="/applications" className="text-[10px] text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              Browse all →
            </Link>
          </div>
          <div className="flex-1 space-y-1">
            {topMatches.length > 0 ? topMatches.map((f) => {
              const prog = (Array.isArray(f.programs) ? f.programs[0] : f.programs) as {
                id: string; name: string; slug: string; deadline_at: string | null; is_rolling: boolean
              } | null
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              const fitPct = Math.round(f.fit_score ?? 0)
              return (
                <Link
                  key={f.program_id}
                  href={`/applications/${prog.slug}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {prog.name}
                    </p>
                    <p className={cn(
                      'text-[10px] mt-0.5',
                      deadline.urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-400 dark:text-neutral-500'
                    )}>
                      {deadline.label}
                    </p>
                  </div>
                  <FitBadge pct={fitPct} />
                </Link>
              )
            }) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 py-2">
                Add more answers to unlock fit matches.
              </p>
            )}
          </div>
        </div>

        {/* Col B — Closing Soon / Active Apps */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {closingSoonApps.length > 0 ? 'Closing Soon' : 'In Progress'}
            </p>
            <Link href="/applications?tab=mine" className="text-[10px] text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              All applications →
            </Link>
          </div>
          <div className="flex-1 space-y-1">
            {closingSoonApps.length > 0 ? closingSoonApps.slice(0, 4).map((app) => {
              const prog = app.program
              if (!prog?.deadline_at) return null
              const daysLeft = Math.ceil((new Date(prog.deadline_at).getTime() - Date.now()) / 86_400_000)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-warning-50/50 dark:hover:bg-warning-900/10 transition-colors group"
                >
                  <WarnIcon />
                  <span className="text-xs font-medium text-neutral-900 dark:text-white flex-1 truncate group-hover:text-warning-700 dark:group-hover:text-warning-400 transition-colors">
                    {prog.name}
                  </span>
                  <span className="text-[10px] font-semibold text-warning-700 dark:text-warning-400 flex-shrink-0">
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                  </span>
                </Link>
              )
            }) : activeApps.length > 0 ? activeApps.slice(0, 4).map((app) => {
              const prog = app.program
              if (!prog) return null
              const deadline = formatDeadline(prog.deadline_at)
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    app.status === 'drafting' ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  )} />
                  <span className="text-xs font-medium text-neutral-900 dark:text-white flex-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {prog.name}
                  </span>
                  <span className={cn(
                    'text-[10px] flex-shrink-0',
                    deadline.urgent ? 'text-warning-600 dark:text-warning-400' : 'text-neutral-400 dark:text-neutral-500'
                  )}>
                    {deadline.label}
                  </span>
                </Link>
              )
            }) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 py-2">
                No active applications yet.
              </p>
            )}
          </div>
        </div>

        {/* Col C — Outcomes (if any) or Achievements + Rewards */}
        {outcomeTotal > 0 ? (
          <div className="card p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Outcomes
              </p>
              <Link href="/applications?tab=mine" className="text-[10px] text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                View all →
              </Link>
            </div>
            <div className="mb-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">{outcomeTotal}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">logged</span>
            </div>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-snug">
              {[
                outcomeAccepted > 0 ? `${outcomeAccepted} accepted` : null,
                outcomeWaitlisted > 0 ? `${outcomeWaitlisted} waitlisted` : null,
                outcomeRejected > 0 ? `${outcomeRejected} rejected` : null,
              ].filter(Boolean).join(' · ')}
            </p>
            {avgRecommend != null && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                ★ {avgRecommend.toFixed(1)} avg recommend
              </p>
            )}
          </div>
        ) : (
          <div className="card p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Achievements
              </p>
              <Link href="/profile/credits" className="text-[10px] text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Days dashboard →
              </Link>
            </div>
            <div className="mb-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">§{creditBalance}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">days credit</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {achievements.slice(0, 4).map((ach) => (
                <span
                  key={ach.achievement_id}
                  title={`Unlocked ${new Date(ach.unlocked_at as string).toLocaleDateString()}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-900/40 text-success-700 dark:text-success-300"
                >
                  {'🏆'} {prettifyAchievement(ach.achievement_id as string)}
                </span>
              ))}
              {achievements.length === 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Answer questions to earn achievements.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Free tier nudge */}
      {!isPro && (apps.length > 0 || totalUnlocked > 5) && (
        <div className="card p-3 bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-900/10 dark:to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">Upgrade to Pro</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Unlock the full question archive, unlimited AI drafts, and priority fit scoring.
              </p>
            </div>
            <Link href="/profile/settings" className="btn-primary text-xs flex-shrink-0 py-1 px-3">
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {apps.length === 0 && topMatches.length === 0 && answered === 0 && (
        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 mb-4">
            <QuestionIcon className="text-brand-500 w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1.5">Start building your AQUAscore</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-4">
            Answer questions once, apply everywhere. Every captured moment moves your score up.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/applications" className="btn-primary text-sm">Browse programs</Link>
            <Link href="/questions" className="btn-secondary text-sm">Open question bank</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function prettifyAchievement(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function StatCard({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string
  value: string
  sub: string
  href: string
  accent?: 'brand' | 'orange'
}) {
  return (
    <Link
      href={href}
      className="card p-3 flex flex-col gap-0.5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={cn(
        'text-xl font-bold tabular-nums',
        accent === 'brand' ? 'text-brand-600 dark:text-brand-400' :
        accent === 'orange' ? 'text-orange-500 dark:text-orange-400' :
        'text-neutral-900 dark:text-white'
      )}>
        {value}
      </p>
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{sub}</p>
    </Link>
  )
}

function SignificanceStars({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5)
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn('text-[10px]', i < filled ? 'text-amber-400' : 'text-neutral-300 dark:text-neutral-600')}>
          ★
        </span>
      ))}
    </span>
  )
}

function FitBadge({ pct }: { pct: number }) {
  const c = pct >= 80 ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
    : pct >= 60 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0', c)}>{pct}%</span>
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-warning-500 flex-shrink-0">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
