import { createClient } from '@/lib/supabase/server'
import { SignificanceStars } from '@/components/SignificanceStars'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const THEME_GROUPS = [
  { key: '',             label: 'All' },
  { key: 'universal',   label: 'Universal' },
  { key: 'team',        label: 'Team' },
  { key: 'traction',    label: 'Traction' },
  { key: 'problem',     label: 'Problem' },
  { key: 'solution',    label: 'Solution' },
  { key: 'market',      label: 'Market' },
  { key: 'vision',      label: 'Vision' },
  { key: 'technical',   label: 'Technical' },
  { key: 'business_model', label: 'Business' },
  { key: 'fundraising', label: 'Fundraising' },
  { key: 'personal',    label: 'Personal' },
  { key: 'fit',         label: 'Fit' },
  { key: 'impact',      label: 'Impact' },
]

const THEME_LABEL: Record<string, string> = {
  team: 'Team', traction: 'Traction', problem: 'Problem', solution: 'Solution',
  market: 'Market', vision: 'Vision', technical: 'Technical',
  business_model: 'Business', fundraising: 'Fundraising',
  personal: 'Personal', fit: 'Fit', impact: 'Impact',
}

interface ArchivedQuestion {
  id: string
  text: string
  theme: string
  significance_score: number
  asked_by_count: number
  typical_word_limit: number | null
  is_universal: boolean
}

interface Props {
  theme: string
  sort: string
}

function archiveHref(params: { theme?: string; sort?: string }) {
  const qs = new URLSearchParams()
  qs.set('view', 'archive')
  if (params.theme) qs.set('theme', params.theme)
  if (params.sort && params.sort !== 'significance') qs.set('sort', params.sort)
  return `/questions?${qs.toString()}`
}

export async function QuestionsArchiveView({ theme, sort }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('archived_questions')
    .select('id, text, theme, significance_score, asked_by_count, typical_word_limit, is_universal')

  if (theme === 'universal') {
    query = query.eq('is_universal', true)
  } else if (theme) {
    query = query.eq('theme', theme)
  }

  query = sort === 'popular'
    ? query.order('asked_by_count', { ascending: false })
    : query.order('significance_score', { ascending: false })

  const { data } = await query
  const questions = (data ?? []) as ArchivedQuestion[]

  const { data: unlockedRows } = await supabase
    .from('user_question_unlocks')
    .select('archived_question_id')
    .eq('user_id', user.id)
  const unlockedIds = new Set((unlockedRows ?? []).map(r => r.archived_question_id as string))

  const { data: allRows } = await supabase
    .from('archived_questions')
    .select('id, theme, is_universal')
  const all = (allRows ?? []) as { id: string; theme: string; is_universal: boolean }[]

  function tabCount(key: string) {
    if (key === '') return all.length
    if (key === 'universal') return all.filter(q => q.is_universal).length
    return all.filter(q => q.theme === key).length
  }

  const unlockedTotal = all.filter(q => unlockedIds.has(q.id)).length

  return (
    <div>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        {all.length} questions scored by significance across 800+ programs
        {' '}·{' '}
        <span className="font-medium text-brand-600 dark:text-brand-400">{unlockedTotal} unlocked</span>
      </p>

      <div className="flex items-start justify-between gap-4 mb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap gap-0 -mb-px overflow-x-auto">
          {THEME_GROUPS.map(g => {
            const count = tabCount(g.key)
            if (count === 0) return null
            const active = theme === g.key
            return (
              <Link
                key={g.key}
                href={archiveHref({ theme: g.key, sort })}
                className={cn(
                  'px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                  active
                    ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                )}
              >
                {g.label}
                <span className={cn(
                  'ml-1 text-[10px] tabular-nums',
                  active ? 'text-brand-500 dark:text-brand-400' : 'text-neutral-400 dark:text-neutral-500'
                )}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="flex gap-1 flex-shrink-0 pb-2">
          <Link
            href={archiveHref({ theme, sort: 'significance' })}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              sort !== 'popular'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            )}
          >
            Significance
          </Link>
          <Link
            href={archiveHref({ theme, sort: 'popular' })}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              sort === 'popular'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            )}
          >
            Popular
          </Link>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500 py-12 text-center">
          No questions in this category.
        </p>
      ) : (
        <div className="space-y-1">
          {questions.map(q => {
            const unlocked = unlockedIds.has(q.id)
            return (
              <div
                key={q.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 rounded-lg border transition-colors group',
                  unlocked
                    ? 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 hover:border-brand-200 dark:hover:border-brand-800/60'
                    : 'border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/40 dark:bg-neutral-900/10'
                )}
              >
                <div className={cn(
                  'flex-shrink-0 mt-0.5',
                  unlocked ? 'text-brand-500' : 'text-neutral-300 dark:text-neutral-700'
                )}>
                  {unlocked ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M8 11V7a4 4 0 018 0v1M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M17 11V7a5 5 0 00-10 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm leading-relaxed',
                    unlocked
                      ? 'text-neutral-800 dark:text-neutral-200'
                      : 'text-neutral-400 dark:text-neutral-500'
                  )}>
                    {q.text}
                  </p>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {q.asked_by_count} program{q.asked_by_count !== 1 ? 's' : ''}
                    </span>
                    {q.typical_word_limit && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        ~{q.typical_word_limit} words
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">
                      {THEME_LABEL[q.theme] ?? q.theme}
                    </span>
                    {q.is_universal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 uppercase tracking-wide font-medium">
                        Universal
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[90px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                      {q.significance_score.toFixed(2)}
                    </span>
                    <SignificanceStars score={q.significance_score} size="sm" />
                  </div>
                  {unlocked ? (
                    <Link
                      href="/questions"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
                    >
                      Answer
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 text-right leading-tight">
                      Unlocks via<br/>daily drip
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
