import { createClient } from '@/lib/supabase/server'
import { computeAquaScore, nextTierDelta, aquaScoreTier, type AquaScoreInputs } from '@/lib/aquascore'
import { DnaRadarChart } from '@/components/DnaRadarChart'
import { ThemeTag } from '@/components/ThemeTag'
import { FmsQuickAssess } from '@/components/FmsQuickAssess'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Persona' }

const THEMES = [
  'team', 'traction', 'vision', 'market', 'product', 'financials',
  'impact', 'problem', 'solution', 'business_model', 'technical',
  'personal', 'fit', 'fundraising', 'legal', 'other',
] as const

const THEME_STRENGTHS: Record<string, string> = {
  team: 'Strong team narrative',
  traction: 'Demonstrated traction',
  technical: 'Technical depth',
  problem: 'Problem-aware founder',
  solution: 'Solution-focused',
  vision: 'Long-range vision',
  market: 'Market understanding',
  impact: 'Impact orientation',
  personal: 'Compelling personal story',
  fit: 'Strong program fit',
  fundraising: 'Fundraising fluency',
  business_model: 'Business model clarity',
}

function getArchetype(identity: string, themeCount: Record<string, number>): string {
  const dominant = Object.entries(themeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([t]) => t)

  if (identity === 'founder') {
    if (dominant.some((t) => ['traction', 'market', 'business_model'].includes(t))) return 'Market-Driven Builder'
    if (dominant.includes('technical')) return 'Technical Founder'
    if (dominant.includes('impact')) return 'Mission-Driven Founder'
    return 'Operator Founder'
  }
  if (identity === 'researcher') {
    if (dominant.includes('technical')) return 'Research Scientist'
    return 'Academic Researcher'
  }
  if (identity === 'student') {
    if (dominant.some((t) => ['fit', 'personal'].includes(t))) return 'Graduate Applicant'
    return 'Student Applicant'
  }
  if (identity === 'job_seeker') {
    const totalAnswers = Object.values(themeCount).reduce((s, c) => s + c, 0)
    return totalAnswers >= 10 ? 'Industry Professional' : 'Career Changer'
  }
  return 'Versatile Applicant'
}

export default async function PersonaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // ── Pull every signal that feeds AQUAscore ────────────────────────────
  const [
    answersRes,
    applicationsRes,
    unlocksRes,
    stressTestsRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from('profile_answers')
      .select('id, archived_question_id, confidence, word_count, content, archived_question:archived_questions(theme)')
      .eq('user_id', user.id),
    supabase
      .from('user_applications')
      .select('id, status, program_id, programs(type)')
      .eq('user_id', user.id),
    supabase
      .from('user_question_unlocks')
      .select('archived_question_id')
      .eq('user_id', user.id),
    supabase
      .from('answer_stress_tests')
      .select('id')
      .eq('user_id', user.id),
    supabase
      .from('user_profiles')
      .select('display_name, active_identity, github_url, linkedin_url, onboarding_completed_at, applicant_context')
      .eq('user_id', user.id)
      .maybeSingle<{
        display_name: string | null
        active_identity: string
        github_url: string | null
        linkedin_url: string | null
        onboarding_completed_at: string | null
        applicant_context: Record<string, unknown> | null
      }>(),
  ])

  const answers = answersRes.data ?? []
  const applications = applicationsRes.data ?? []
  const unlocks = unlocksRes.data ?? []
  const stressTests = stressTestsRes.data ?? []
  const profile = profileRes.data ?? null

  // ── Theme distribution from user's actual answers ────────────────────
  const themeCount: Record<string, number> = {}
  for (const a of answers) {
    const theme = (Array.isArray(a.archived_question) ? a.archived_question[0]?.theme : (a.archived_question as { theme?: string } | null)?.theme) as string | undefined
    if (theme) themeCount[theme] = (themeCount[theme] ?? 0) + 1
  }
  const themesCovered = Object.keys(themeCount).length

  const dnaRows = THEMES.map((t) => ({ theme: t, weight: themeCount[t] ?? 0 }))
  const maxThemeCount = Math.max(1, ...Object.values(themeCount))
  const userCoverage = Object.fromEntries(
    Object.entries(themeCount).map(([t, c]) => [t, c / maxThemeCount])
  )

  // ── Confidence + word-count distribution ─────────────────────────────
  const lockedCount = answers.filter((a) => a.confidence === 'locked').length
  const solidCount = answers.filter((a) => a.confidence === 'solid').length
  const draftCount = answers.filter((a) => a.confidence === 'draft').length
  const totalWords = answers.reduce((sum, a) => sum + (a.word_count ?? 0), 0)
  const avgWordCount = answers.length > 0 ? Math.round(totalWords / answers.length) : 0

  // ── Applications signals ─────────────────────────────────────────────
  const appsStarted = applications.length
  const appsSubmitted = applications.filter((a) => a.status === 'submitted' || a.status === 'accepted' || a.status === 'waitlisted').length
  const typesCovered = new Set(
    applications
      .map((a) => {
        const prog = Array.isArray(a.programs) ? a.programs[0] : a.programs
        return (prog as { type?: string } | null)?.type
      })
      .filter(Boolean)
  ).size

  // ── AQUAscore composition ────────────────────────────────────────────
  const inputs: AquaScoreInputs = {
    applicationsStarted: appsStarted,
    applicationsSubmitted: appsSubmitted,
    programTypesCovered: typesCovered,
    themesCovered,
    questionsAnswered: answers.length,
    questionsUnlocked: unlocks.length,
    totalAnswers: answers.length,
    lockedConfidenceCount: lockedCount,
    solidConfidenceCount: solidCount,
    averageWordCount: avgWordCount,
    stressTestCount: stressTests.length,
  }
  const score = computeAquaScore(inputs)
  const tier = aquaScoreTier(score.composite)
  const delta = nextTierDelta(score, inputs)

  // ── Boost-layer availability ──────────────────────────────────────────
  const hasGithub = !!profile?.github_url
  const fmsTier = (profile?.applicant_context as Record<string, unknown> | null)?.fms_tier
  const hasFmsAssessment = !!(fmsTier && typeof fmsTier === 'number')
  const hasFundScore = false     // wired when fundscore CLI is vendored
  const hasPortfolio = !!profile?.linkedin_url

  const topThemes = Object.entries(themeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([t]) => t)

  // ── Distilled profile (Layer 2) ───────────────────────────────────────
  const activeIdentity = profile?.active_identity ?? 'founder'
  const archetype = getArchetype(activeIdentity, themeCount)
  const narrativeStrengths = topThemes
    .filter((t) => t in THEME_STRENGTHS)
    .map((t) => ({ theme: t, label: THEME_STRENGTHS[t] }))
  const coverageOf12 = Object.keys(themeCount).filter((t) => t in THEME_STRENGTHS).length
  const coveragePct = Math.round((coverageOf12 / 12) * 100)
  const qualitySignal =
    lockedCount > 0
      ? `${lockedCount} locked answer${lockedCount === 1 ? '' : 's'} signal high confidence`
      : solidCount > 0
      ? `${solidCount} solid answer${solidCount === 1 ? '' : 's'}, keep refining`
      : 'All drafts — locking answers boosts your score'

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Persona</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          The system&apos;s read on you — distilled from your answers, applications, and craft.
        </p>
      </div>

      {/* AQUAscore headline */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/30 dark:to-neutral-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              AQUAscore
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-neutral-900 dark:text-white tabular-nums">
                {score.composite}
              </span>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                / 100
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {tier.tier} · <span className="text-neutral-500 dark:text-neutral-400 font-normal">{tier.description}</span>
            </p>
          </div>

          {/* Pillar breakdown */}
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            <PillarBar label="Applications" pct={score.applications} />
            <PillarBar label="Questions" pct={score.questions} />
            <PillarBar label="Answers" pct={score.answers} />
          </div>
        </div>

        {/* Delta to next tier */}
        {delta.pointsGain > 0 && (
          <div className="mt-5 pt-5 border-t border-brand-200/60 dark:border-brand-800/40">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Next move (+{delta.pointsGain} pts)
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">{delta.hint}</p>
          </div>
        )}
      </div>

      {/* Three-layer view */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <LayerCard
          tier={1}
          name="Answer Bank"
          status="active"
          stat={`${answers.length} answer${answers.length === 1 ? '' : 's'} captured`}
          detail={`${lockedCount} locked · ${solidCount} solid · ${draftCount} draft`}
        />
        <LayerCard
          tier={2}
          name="Persona Profile"
          status={answers.length >= 8 ? 'active' : 'forming'}
          stat={
            answers.length >= 8
              ? `${themesCovered} themes covered`
              : `Forming — ${Math.max(0, 8 - answers.length)} more answers to activate`
          }
          detail={answers.length >= 8 ? 'Distilled view of your strengths' : 'Building from your raw captures'}
        />
        <LayerCard
          tier={3}
          name="Recruiter Surface"
          status={appsSubmitted >= 1 && answers.length >= 15 ? 'forming' : 'locked'}
          stat="Future B2B layer"
          detail="Activates when programs can pull from a ranked applicant pool"
        />
      </div>

      {/* Theme strengths radar */}
      {themesCovered > 0 && (
        <div className="card p-6 mb-6">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Theme strengths</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            How your answer bank is distributed across themes. More breadth = stronger persona.
          </p>
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <DnaRadarChart
              dnaRows={dnaRows.filter((r) => r.weight > 0)}
              userCoverage={userCoverage}
              size={240}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                Top themes
              </p>
              {topThemes.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Answer questions in different themes to surface your strongest signals.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {topThemes.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
                      <ThemeTag theme={t} />
                      <span className="tabular-nums">×{themeCount[t]}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Active identity: <span className="font-medium text-neutral-700 dark:text-neutral-300">{(profile?.active_identity ?? 'founder').replace('_', ' ')}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Distilled profile — Layer 2 (visible once 8+ answers) */}
      {answers.length >= 8 && (
        <div className="card p-6 mb-6">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Your distilled profile</h3>

          {/* Archetype */}
          <p className="text-xl font-bold text-neutral-900 dark:text-white mb-4">{archetype}</p>

          {/* Narrative strength tags */}
          {narrativeStrengths.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {narrativeStrengths.map(({ theme, label }) => (
                <span
                  key={theme}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-xs font-medium text-brand-700 dark:text-brand-300"
                >
                  <ThemeTag theme={theme} />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Coverage bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Theme coverage</span>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {coverageOf12}/12 themes covered
                {coveragePct >= 75 ? ' — strong breadth' : coveragePct >= 50 ? ' — good breadth' : ' — keep adding answers'}
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  coveragePct >= 75 ? 'bg-success-500' : coveragePct >= 50 ? 'bg-brand-500' : 'bg-warning-500'
                )}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>

          {/* Quality signal */}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{qualitySignal}</p>
        </div>
      )}

      {/* FMS quick-assess inline (when not yet classified) */}
      {!hasFmsAssessment && <FmsQuickAssess />}

      {/* Boost layers — additive, never subtractive */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Boost your score</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
          Optional signal sources. AQUAscore stays additive — connect what you have, no penalty for the rest.
        </p>

        <div className="space-y-3">
          <BoostRow
            name="GitHub project"
            connected={hasGithub}
            description="Repo health, traction signals, and FundScore (artifact readiness)."
            cta={hasGithub ? 'Connected' : 'Add GitHub URL'}
            href="/profile/about"
          />
          <BoostRow
            name="LinkedIn / Portfolio"
            connected={hasPortfolio}
            description="Surrogate readiness for non-tech paths (jobs, school applications)."
            cta={hasPortfolio ? 'Connected' : 'Add LinkedIn URL'}
            href="/profile/about"
          />
          <BoostRow
            name="Project Moat (FMS)"
            connected={hasFmsAssessment}
            description="Strategic defensibility tier (1-5). Manual or AI-assisted classification."
            cta={hasFmsAssessment ? `Tier ${fmsTier as number} — Edit` : 'Rate your moat below'}
            href={hasFmsAssessment ? '/profile/about' : undefined}
          />
          <BoostRow
            name="FundScore"
            connected={hasFundScore}
            description="Deterministic investor-readiness score from your GitHub repo's structure."
            cta="Coming soon"
            disabled
          />
        </div>
      </div>
    </div>
  )
}

function PillarBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="text-center md:text-right">
      <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold text-neutral-900 dark:text-white tabular-nums">{pct}</p>
      <div className="w-16 md:w-20 mx-auto md:ml-auto md:mr-0 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1 mt-1">
        <div
          className={cn(
            'h-1 rounded-full transition-all',
            pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-brand-500' : 'bg-warning-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function LayerCard({
  tier,
  name,
  status,
  stat,
  detail,
}: {
  tier: 1 | 2 | 3
  name: string
  status: 'active' | 'forming' | 'locked'
  stat: string
  detail: string
}) {
  const statusStyle =
    status === 'active'
      ? 'border-success-300 dark:border-success-700 bg-success-50/40 dark:bg-success-950/20'
      : status === 'forming'
      ? 'border-brand-300 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-950/20'
      : 'border-neutral-200 dark:border-neutral-800 opacity-70'
  const statusLabel = status === 'active' ? 'Active' : status === 'forming' ? 'Forming' : 'Locked'
  return (
    <div className={cn('card p-4 border-2', statusStyle)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-500 uppercase tracking-wider">
          Layer {tier}
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
            status === 'active' && 'bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300',
            status === 'forming' && 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
            status === 'locked' && 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
          )}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">{name}</p>
      <p className="text-xs text-neutral-700 dark:text-neutral-300 mb-1">{stat}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  )
}

function BoostRow({
  name,
  connected,
  description,
  cta,
  href,
  disabled,
}: {
  name: string
  connected: boolean
  description: string
  cta: string
  href?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span
          className={cn(
            'mt-1 w-2 h-2 rounded-full flex-shrink-0',
            connected ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-700'
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
        </div>
      </div>
      {disabled ? (
        <span className="text-xs text-neutral-400 dark:text-neutral-600 italic flex-shrink-0">{cta}</span>
      ) : connected ? (
        href ? (
          <a
            href={href}
            className="text-xs font-medium text-success-600 hover:text-success-700 dark:text-success-400 transition-colors flex-shrink-0"
          >
            {cta} →
          </a>
        ) : (
          <span className="text-xs font-medium text-success-600 dark:text-success-400 flex-shrink-0">
            ✓ {cta}
          </span>
        )
      ) : href ? (
        <a
          href={href}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors flex-shrink-0"
        >
          {cta} →
        </a>
      ) : (
        <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">{cta}</span>
      )}
    </div>
  )
}
