import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Program, UserProgramFit } from '@/lib/database.types'
import { formatDeadline, programTypeLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'My Applications',
}

export default async function WorkspacePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Get programs where user has a fit score (proxy for "started tracking")
  const { data: fitRows } = await supabase
    .from('user_program_fit')
    .select('*')
    .eq('user_id', user.id)
    .order('composite_score', { ascending: false })
    .returns<UserProgramFit[]>()

  const programIds = fitRows?.map((f) => f.program_id) ?? []

  let programs: Program[] = []
  if (programIds.length > 0) {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .in('id', programIds)
      .returns<Program[]>()
    programs = data ?? []
  }

  const fitMap = Object.fromEntries((fitRows ?? []).map((f) => [f.program_id, f]))
  const programsWithFit = programs.map((p) => ({ ...p, fit: fitMap[p.id] }))

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">My Applications</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Track your progress across every program you&apos;re applying to
          </p>
        </div>
        <Link href="/hub" className="btn-secondary text-sm">
          Browse programs
        </Link>
      </div>

      {programsWithFit.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {programsWithFit.map((program) => {
            const deadline = formatDeadline(program.deadline_at)
            const fit = program.fit
            const coverage = fit ? Math.round(fit.coverage_pct * 100) : 0

            return (
              <Link
                key={program.id}
                href={`/workspace/${program.id}`}
                className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {programTypeLabel(program.type)}
                    </span>
                    {program.is_rolling && (
                      <span className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                        Rolling
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {program.name}
                  </h3>

                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          coverage >= 80
                            ? 'bg-success-500'
                            : coverage >= 50
                            ? 'bg-brand-500'
                            : 'bg-warning-500'
                        )}
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                      {coverage}% answered
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      deadline.urgent
                        ? 'text-warning-600 dark:text-warning-500'
                        : 'text-neutral-600 dark:text-neutral-400'
                    )}
                  >
                    {deadline.label}
                  </p>
                  {fit && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {Math.round(fit.fit_score * 100)}% fit score
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
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
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
        No active applications
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
        Browse the Hub to find programs that fit your startup, then start an application to begin
        building your answers here.
      </p>
      <Link href="/hub" className="btn-primary">
        Browse programs
      </Link>
    </div>
  )
}
