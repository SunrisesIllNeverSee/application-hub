import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = { title: 'Funders' }

const TYPE_LABELS: Record<string, string> = {
  accelerator: 'Accelerator',
  vc: 'VC',
  government: 'Government',
  foundation: 'Foundation',
  corporate: 'Corporate',
  nonprofit: 'Nonprofit',
}

const TYPES = Object.keys(TYPE_LABELS)

interface FunderRow {
  id: string
  name: string
  slug: string
  type: string
  hq_location: string | null
  founded_year: number | null
  website: string | null
  program_count: number
}

interface PageProps {
  searchParams: Promise<{ type?: string }>
}

export default async function FundersPage({ searchParams }: PageProps) {
  const { type: typeParam } = await searchParams
  const supabase = await createClient()
  const filterType = typeParam ?? ''

  // Fetch funders with program count
  let query = supabase
    .from('funders')
    .select('id, name, slug, type, hq_location, founded_year, website')
    .order('name')

  if (filterType) query = query.eq('type', filterType)

  const { data: funderRows } = await query

  // Get program counts per funder
  const { data: countRows } = await supabase
    .from('programs')
    .select('funder_id')
    .not('funder_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of countRows ?? []) {
    if (row.funder_id) countMap[row.funder_id] = (countMap[row.funder_id] ?? 0) + 1
  }

  const funders: FunderRow[] = (funderRows ?? []).map(f => ({
    ...f,
    program_count: countMap[f.id] ?? 0,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Funders</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {funders.length} organizations running programs in the Hub.
        </p>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <FilterChip href="/applications?view=funders" active={!filterType} label="All" />
        {TYPES.map(t => (
          <FilterChip key={t} href={`/applications?view=funders?type=${t}`} active={filterType === t} label={TYPE_LABELS[t]} />
        ))}
      </div>

      {funders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No funders match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funders.map(f => (
            <Link key={f.id} href={`/funders/${f.slug}`} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {f.name}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                  {TYPE_LABELS[f.type] ?? f.type}
                </span>
              </div>
              <div className="space-y-1">
                {f.hq_location && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{f.hq_location}</p>
                )}
                {f.founded_year && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Est. {f.founded_year}</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {f.program_count} {f.program_count === 1 ? 'program' : 'programs'} indexed
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      {label}
    </Link>
  )
}
