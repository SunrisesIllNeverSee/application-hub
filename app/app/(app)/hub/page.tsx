import { createClient } from '@/lib/supabase/server'
import type { Program, UserProgramFit, ProgramWithFit } from '@/lib/database.types'
import { ProgramCard } from '@/components/ProgramCard'
import { HubFilters } from './HubFilters'

export const metadata = {
  title: 'Program Hub',
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: { sort?: string; type?: string; rolling?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch programs
  let query = supabase
    .from('programs')
    .select('*')
    .order('heat_score', { ascending: false })

  if (searchParams.type) {
    query = query.eq('type', searchParams.type)
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

  const programsWithFit: ProgramWithFit[] = (programs ?? []).map((p) => ({
    ...p,
    fit: fitMap[p.id],
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Program Hub</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {sorted.length > 0
            ? `${sorted.length} programs ranked by fit and opportunity value`
            : 'Discover accelerators, grants, and fellowships matched to your startup'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <aside className="w-56 flex-shrink-0">
          <HubFilters currentSort={sort} currentType={searchParams.type} currentRolling={searchParams.rolling} />
        </aside>

        {/* Program list */}
        <div className="flex-1 min-w-0">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {sorted.map((program, i) => (
                <ProgramCard key={program.id} program={program} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
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
