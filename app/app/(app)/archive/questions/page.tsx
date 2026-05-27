import { createClient } from '@/lib/supabase/server'
import { ThemeTag } from '@/components/ThemeTag'
import { SignificanceStars } from '@/components/SignificanceStars'
import Link from 'next/link'

export const metadata = { title: 'Question Archive' }

const THEMES = [
  'team', 'traction', 'problem', 'solution',
  'market', 'vision', 'technical', 'business_model',
  'fundraising', 'impact', 'personal', 'fit',
]

const DOMAIN_LABELS: Record<string, string> = {
  founder: 'Founder / Accelerator',
  jobs: 'Jobs',
  education: 'Education',
  grants: 'Grants',
}

interface ArchivedQuestion {
  id: string
  text: string
  theme: string
  domain: string | null
  significance_score: number
  asked_by_count: number
  typical_word_limit: number | null
}

interface PageProps {
  searchParams: Promise<{ theme?: string; domain?: string; sort?: string }>
}

export default async function ArchiveQuestionsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const resolved = await searchParams

  const theme = resolved.theme ?? ''
  const domain = resolved.domain ?? ''
  const sort = resolved.sort ?? 'significance'

  let query = supabase
    .from('archived_questions')
    .select('id, text, theme, domain, significance_score, asked_by_count, typical_word_limit')

  if (theme) query = query.eq('theme', theme)
  if (domain) query = query.eq('domain', domain)

  if (sort === 'asked_by') {
    query = query.order('asked_by_count', { ascending: false })
  } else {
    query = query.order('significance_score', { ascending: false })
  }

  const { data } = await query
  const questions: ArchivedQuestion[] = (data ?? []) as ArchivedQuestion[]

  const totalCount = questions.length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          Question Archive
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {totalCount} questions asked by real programs — scored by significance.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Theme filter */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href="/archive/questions" active={!theme} label="All themes" />
          {THEMES.map(t => (
            <FilterChip
              key={t}
              href={buildHref({ theme: t, domain, sort })}
              active={theme === t}
              label={t.replace('_', ' ')}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {/* Domain filter */}
        <FilterChip href={buildHref({ theme, domain: '', sort })} active={!domain} label="All domains" />
        {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
          <FilterChip
            key={key}
            href={buildHref({ theme, domain: key, sort })}
            active={domain === key}
            label={label}
          />
        ))}

        {/* Sort */}
        <div className="ml-auto flex gap-1.5">
          <FilterChip href={buildHref({ theme, domain, sort: 'significance' })} active={sort === 'significance'} label="By significance" />
          <FilterChip href={buildHref({ theme, domain, sort: 'asked_by' })} active={sort === 'asked_by'} label="By popularity" />
        </div>
      </div>

      {/* Question list */}
      {questions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No questions match these filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="card px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
                    {q.text}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <ThemeTag theme={q.theme as never} />
                    {q.domain && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {DOMAIN_LABELS[q.domain] ?? q.domain}
                      </span>
                    )}
                    {q.typical_word_limit && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {q.typical_word_limit}w
                      </span>
                    )}
                    {q.asked_by_count > 1 && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        Asked by {q.asked_by_count} programs
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <SignificanceStars score={q.significance_score} size="xs" />
                  <Link
                    href={`/bank`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Answer →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function buildHref({ theme, domain, sort }: { theme: string; domain: string; sort: string }) {
  const params = new URLSearchParams()
  if (theme) params.set('theme', theme)
  if (domain) params.set('domain', domain)
  if (sort && sort !== 'significance') params.set('sort', sort)
  const qs = params.toString()
  return `/archive/questions${qs ? `?${qs}` : ''}`
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
