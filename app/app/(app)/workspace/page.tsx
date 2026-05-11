import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Program, UserProgramFit, UserApplication } from '@/lib/database.types'
import { formatDeadline, programTypeLabel, formatCheckSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'My Applications',
}

/**
 * Opportunity score: expected ROI combining fit, program value, and check size.
 * Normalized so the best program = 100.
 */
function opportunityScore(fit: UserProgramFit | undefined, program: Program): number {
  const fitPct = (fit?.fit_score ?? 0) * 100
  const programValue = program.program_value_score ?? 50
  // Weight: 50% fit, 35% program value, 15% urgency bonus
  const base = fitPct * 0.50 + programValue * 0.35
  // Urgency bonus: closing within 30 days
  const daysLeft = program.deadline_at
    ? (new Date(program.deadline_at).getTime() - Date.now()) / 86_400_000
    : null
  const urgency = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 ? 15 : 0
  return Math.round(base + urgency)
}

export default async function WorkspacePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. User's applications
  const { data: appRows } = await supabase
    .from('user_applications')
    .select('*')
    .eq('user_id', user.id)
    .returns<UserApplication[]>()

  const programIds = appRows?.map((a) => a.program_id) ?? []
  const appMap = Object.fromEntries((appRows ?? []).map(a => [a.program_id, a]))

  // 2. Program data
  let programs: Program[] = []
  if (programIds.length > 0) {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .in('id', programIds)
      .returns<Program[]>()
    programs = data ?? []
  }

  // 3. Fit scores for applied programs
  let fitMap: Record<string, UserProgramFit> = {}
  if (programIds.length > 0) {
    const { data: fitRows } = await supabase
      .from('user_program_fit')
      .select('*')
      .eq('user_id', user.id)
      .in('program_id', programIds)
      .returns<UserProgramFit[]>()
    fitMap = Object.fromEntries((fitRows ?? []).map((f) => [f.program_id, f]))
  }

  // 4. Top unapplied opportunities (for the "Your best unopened" section)
  const { data: topOpps } = await supabase
    .from('user_program_fit')
    .select('*, programs(id, name, slug, type, deadline_at, is_rolling, check_size_max, program_value_score, heat_score)')
    .eq('user_id', user.id)
    .not('program_id', 'in', `(${programIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
    .order('composite_score', { ascending: false })
    .limit(5)
    .returns<(UserProgramFit & { programs: Program | null })[]>()

  // 5. Score + rank applied programs by opportunity score
  const programsWithFit = programs
    .map((p) => ({
      ...p,
      fit: fitMap[p.id],
      app: appMap[p.id],
      oppScore: opportunityScore(fitMap[p.id], p),
    }))
    .sort((a, b) => b.oppScore - a.oppScore)

  const activeApps = programsWithFit.filter(p => p.app?.status === 'drafting' || p.app?.status === 'saved')
  const otherApps = programsWithFit.filter(p => p.app?.status !== 'drafting' && p.app?.status !== 'saved')

  const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
    saved:      { label: 'Saved',       dot: 'bg-neutral-400 dark:bg-neutral-500' },
    drafting:   { label: 'In progress', dot: 'bg-brand-500' },
    submitted:  { label: 'Submitted',   dot: 'bg-success-500' },
    accepted:   { label: 'Accepted',    dot: 'bg-success-600' },
    rejected:   { label: 'Rejected',    dot: 'bg-neutral-400 dark:bg-neutral-500' },
    waitlisted: { label: 'Waitlisted',  dot: 'bg-warning-500' },
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">My Applications</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Ranked by opportunity value · fit × program value
          </p>
        </div>
        <Link href="/hub" className="btn-secondary text-sm">Browse programs</Link>
      </div>

      {programsWithFit.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {/* Active applications — ranked by opp score */}
          {activeApps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">In progress</h2>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">{activeApps.length}</span>
              </div>
              <div className="space-y-2">
                {activeApps.map((program, i) => {
                  const deadline = formatDeadline(program.deadline_at)
                  const fit = program.fit
                  const coveragePct = fit ? Math.round(fit.coverage_pct * 100) : 0
                  const fitPct = fit ? Math.round(fit.fit_score * 100) : 0
                  const status = program.app?.status ?? 'saved'
                  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.saved
                  const checkSize = formatCheckSize(program.check_size_max ?? program.check_size_min ?? null)

                  return (
                    <Link key={program.id} href={`/workspace/${program.id}`}
                      className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow">
                      {/* Rank badge */}
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                        {i + 1}
                      </div>
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
                        {fit && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
                              <div className={cn('h-1 rounded-full transition-all',
                                coveragePct >= 80 ? 'bg-success-500'
                                : coveragePct >= 50 ? 'bg-brand-500' : 'bg-warning-500'
                              )} style={{ width: `${coveragePct}%` }} />
                            </div>
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">
                              {coveragePct}% answered
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <OppScoreBadge score={program.oppScore} />
                        <p className={cn('text-xs mt-1',
                          deadline.urgent ? 'text-warning-600 dark:text-warning-400 font-medium' : 'text-neutral-400 dark:text-neutral-500'
                        )}>
                          {deadline.label}
                        </p>
                        {fit && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {fitPct}% fit{checkSize !== '—' ? ` · ${checkSize}` : ''}
                          </p>
                        )}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submitted / accepted / other */}
          {otherApps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Submitted &amp; closed</h2>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">{otherApps.length}</span>
              </div>
              <div className="space-y-2">
                {otherApps.map(program => {
                  const deadline = formatDeadline(program.deadline_at)
                  const fitPct = program.fit ? Math.round(program.fit.fit_score * 100) : 0
                  const status = program.app?.status ?? 'submitted'
                  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted
                  return (
                    <Link key={program.id} href={`/workspace/${program.id}`}
                      className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow opacity-75">
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
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">{deadline.label}</p>
                        {program.fit && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{fitPct}% fit</p>}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top unapplied opportunities */}
          {topOpps && topOpps.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Your best unopened opportunities</h2>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">High-fit programs you haven&apos;t started yet</p>
                </div>
                <Link href="/hub" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                  See all →
                </Link>
              </div>
              <div className="space-y-2">
                {topOpps.map((f, i) => {
                  const prog = (Array.isArray(f.programs) ? f.programs[0] : f.programs) as Program | null
                  if (!prog) return null
                  const deadline = formatDeadline(prog.deadline_at)
                  const fitPct = Math.round((f.fit_score ?? 0) * 100)
                  const composite = Math.round(f.composite_score ?? 0)
                  const checkSize = formatCheckSize(prog.check_size_max ?? null)
                  return (
                    <Link key={f.program_id} href={`/hub/${prog.slug}`}
                      className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-dashed">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{programTypeLabel(prog.type)}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{prog.name}</h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {fitPct}% fit · composite {composite}{checkSize !== '—' ? ` · ${checkSize}` : ''}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={cn('text-xs',
                          deadline.urgent ? 'text-warning-600 dark:text-warning-400 font-medium' : 'text-neutral-400 dark:text-neutral-500'
                        )}>
                          {deadline.label}
                        </p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OppScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
    : score >= 45 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {score}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">No active applications</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
        Browse the Hub to find programs that fit your startup, then start an application to see your opportunity rankings here.
      </p>
      <Link href="/hub" className="btn-primary">Browse programs</Link>
    </div>
  )
}
