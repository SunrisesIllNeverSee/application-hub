import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { formatDeadline, cn } from '@/lib/utils'

export const metadata = { title: 'Smart Matcher — AQUA' }

interface Recommendation {
  program_id: string
  program_name: string
  program_slug: string
  program_logo_url: string | null
  program_deadline: string | null
  opportunity_kind: string
  fit_score: number
  top_questions: Array<{
    question_id: string
    text: string
    theme: string
    significance_score: number
  }>
  user_answer_preview: Array<{
    question_id: string
    answer_preview: string
    confidence: string
  }>
}

function FitScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 85 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    pct >= 70 ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
    pct >= 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
    'bg-neutral-500/20 text-neutral-400 border-neutral-500/30'

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', color)}>
      {pct}% fit
    </span>
  )
}

function DeadlineCountdown({ deadline }: { deadline: string | null }) {
  const info = formatDeadline(deadline)
  const color =
    info.status === 'closed' ? 'text-red-400' :
    info.urgent ? 'text-amber-400' :
    info.status === 'rolling' ? 'text-neutral-500' :
    'text-neutral-400'
  return <span className={cn('text-xs', color)}>{info.label}</span>
}

export default async function SmartMatcherPage({
  searchParams,
}: {
  searchParams: Promise<{ modes?: string; min_score?: string; deadline_days?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Parse filters
  const modesFilter = params.modes ? params.modes.split(',') : []
  const minScore = params.min_score ? parseFloat(params.min_score) : 0
  const deadlineDays = params.deadline_days ? parseInt(params.deadline_days) : 0

  // Call Smart Matcher RPC
  const { data: rawRecommendations, error } = await supabase.rpc(
    'compute_smart_matcher_recommendations',
    {
      p_user_id: user.id,
      p_modes: modesFilter,
      p_limit: 30,
    }
  )

  let recommendations = (rawRecommendations ?? []) as unknown as Recommendation[]

  // Client-side filters
  if (minScore > 0) {
    recommendations = recommendations.filter(r => r.fit_score >= minScore)
  }
  if (deadlineDays > 0) {
    const cutoff = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000)
    recommendations = recommendations.filter(r =>
      !r.program_deadline || new Date(r.program_deadline) <= cutoff
    )
  }

  // Daily digest summary
  const topCount = recommendations.filter(r => r.fit_score >= 0.8).length
  const avgScore = recommendations.length > 0
    ? recommendations.reduce((sum, r) => sum + r.fit_score, 0) / recommendations.length
    : 0

  const MODE_OPTIONS = [
    { value: 'accelerator', label: 'Accelerators' },
    { value: 'vc', label: 'VC Programs' },
    { value: 'fellowship', label: 'Fellowships' },
    { value: 'grant', label: 'Grants' },
    { value: 'job_fulltime', label: 'Jobs' },
    { value: 'school_grad', label: 'Schools' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Matcher</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Personalized recommendations based on your persona profile and answer bank.
        </p>
      </div>

      {/* Daily Digest */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-brand-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">
              {topCount > 0
                ? `${topCount} high-fit ${topCount === 1 ? 'match' : 'matches'} today`
                : 'No high-fit matches yet'}
            </p>
            <p className="text-xs text-neutral-500">
              {recommendations.length} programs scored · Average fit: {Math.round(avgScore * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mode filters */}
        <div className="flex flex-wrap items-center gap-2">
          {MODE_OPTIONS.map(mode => {
            const isActive = modesFilter.includes(mode.value)
            const newModes = isActive
              ? modesFilter.filter(m => m !== mode.value)
              : [...modesFilter, mode.value]
            const href = newModes.length > 0
              ? `?modes=${newModes.join(',')}`
              : '?'
            return (
              <Link
                key={mode.value}
                href={href}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 border-brand-500/30'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                )}
              >
                {mode.label}
              </Link>
            )
          })}
        </div>

        {/* Score filter */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Min score:</span>
          <div className="flex gap-1">
            {[0, 0.5, 0.7, 0.85].map(score => (
              <Link
                key={score}
                href={`?${modesFilter.length ? `modes=${modesFilter.join(',')}&` : ''}min_score=${score}`}
                className={cn(
                  'px-2 py-1 rounded border text-xs',
                  minScore === score
                    ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                    : 'border-neutral-800 hover:border-neutral-700'
                )}
              >
                {score === 0 ? 'All' : `${Math.round(score * 100)}%`}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
          Unable to load recommendations. Please complete your persona profile first.
        </div>
      )}

      {!error && recommendations.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center">
          <p className="text-sm text-neutral-400">No matching programs found.</p>
          <p className="mt-2 text-xs text-neutral-500">
            Build your persona profile and answer more questions to unlock recommendations.
          </p>
        </div>
      )}

      {!error && recommendations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((rec) => (
            <div
              key={rec.program_id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 flex flex-col gap-3 hover:border-neutral-700 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                {rec.program_logo_url ? (
                  <Image
                    src={rec.program_logo_url}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-cover bg-neutral-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-500">
                    {rec.program_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">{rec.program_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <DeadlineCountdown deadline={rec.program_deadline} />
                    <FitScoreBadge score={rec.fit_score} />
                  </div>
                </div>
              </div>

              {/* Top questions / reasons */}
              {rec.top_questions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Key questions</p>
                  {rec.top_questions.slice(0, 3).map((q) => (
                    <p key={q.question_id} className="text-xs text-neutral-400 truncate">
                      {q.text}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-2">
                <Link
                  href={`/workspace/${rec.program_id}`}
                  className="flex-1 text-center px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
                >
                  Pre-fill Now
                </Link>
                <Link
                  href={`/applications?program=${rec.program_slug}`}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs hover:bg-neutral-800 transition-colors"
                >
                  View Full
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
