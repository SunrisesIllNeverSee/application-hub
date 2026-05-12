import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const TYPE_LABELS: Record<string, string> = {
  accelerator: 'Accelerator',
  vc: 'VC',
  government: 'Government',
  foundation: 'Foundation',
  corporate: 'Corporate',
  nonprofit: 'Nonprofit',
}

interface Program {
  id: string
  name: string
  slug: string
  domain: string | null
  deadline: string | null
  heat_score: number | null
  cohort_size: number | null
  funding_amount: string | null
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function FunderProfilePage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: funder } = await supabase
    .from('funders')
    .select('id, name, slug, type, hq_location, founded_year, website, description')
    .eq('slug', slug)
    .single()

  if (!funder) notFound()

  const { data: programRows } = await supabase
    .from('programs')
    .select('id, name, slug, domain, deadline, heat_score, cohort_size, funding_amount')
    .eq('funder_id', funder.id)
    .order('heat_score', { ascending: false, nullsFirst: false })

  const programs: Program[] = (programRows ?? []) as Program[]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/funders" className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
          ← Funders
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{funder.name}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {TYPE_LABELS[funder.type] ?? funder.type}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              {funder.hq_location && <span>{funder.hq_location}</span>}
              {funder.founded_year && <span>Est. {funder.founded_year}</span>}
              {funder.website && (
                <a
                  href={funder.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Website ↗
                </a>
              )}
            </div>
          </div>
        </div>
        {funder.description && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {funder.description}
          </p>
        )}
      </div>

      {/* Programs */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
          {programs.length} {programs.length === 1 ? 'Program' : 'Programs'}
        </h2>

        {programs.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No programs indexed yet for this funder.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map(p => (
              <Link key={p.id} href={`/hub/${p.slug}`} className="card px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {p.domain && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">{p.domain}</span>
                    )}
                    {p.funding_amount && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">{p.funding_amount}</span>
                    )}
                    {p.cohort_size && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">{p.cohort_size} per cohort</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {p.deadline ? (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">Rolling</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link
            href={`/hub?funder=${funder.slug}`}
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            Browse all {funder.name} programs in the Hub →
          </Link>
        </div>
      </div>
    </div>
  )
}
