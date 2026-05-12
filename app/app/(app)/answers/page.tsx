import { createClient } from '@/lib/supabase/server'
import type { ProfileAnswerWithQuestion, QuestionTheme } from '@/lib/database.types'
import { ThemeTag } from '@/components/ThemeTag'
import { AnswerEditor } from '@/components/AnswerEditor'
import { AnswerFileTree } from '@/components/AnswerFileTree'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export const metadata = { title: 'Answers' }

const THEME_ORDER: QuestionTheme[] = [
  'problem', 'solution', 'market', 'traction', 'team',
  'business_model', 'vision', 'impact', 'technical',
  'fundraising', 'personal', 'fit', 'legal', 'other',
]

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function AnswersPage({ searchParams }: Props) {
  const { id: selectedId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: answers } = await supabase
    .from('profile_answers')
    .select('*, archived_question:archived_questions(*)')
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false })
    .returns<ProfileAnswerWithQuestion[]>()

  const allAnswers = answers ?? []
  const total = allAnswers.length

  // Group by theme. The "other" bucket catches uncategorized.
  const answersByTheme: Record<string, ProfileAnswerWithQuestion[]> = {}
  for (const t of THEME_ORDER) answersByTheme[t] = []
  for (const a of allAnswers) {
    const theme = a.archived_question?.theme ?? 'other'
    if (!answersByTheme[theme]) answersByTheme[theme] = []
    answersByTheme[theme].push(a)
  }

  const lockedCount = allAnswers.filter((a) => a.confidence === 'locked').length
  const solidCount = allAnswers.filter((a) => a.confidence === 'solid').length
  const draftCount = allAnswers.filter((a) => a.confidence === 'draft').length

  // Pick the answer to show in the right panel.
  // Default = most recently updated (first in list).
  const resolvedId = selectedId || allAnswers[0]?.id || null
  const selected = resolvedId ? allAnswers.find((a) => a.id === resolvedId) ?? null : null

  if (total === 0) {
    return (
      <div>
        <Header total={0} locked={0} solid={0} draft={0} />
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
            Your answer bank is empty
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Start answering questions in the{' '}
            <Link href="/questions" className="text-brand-600 dark:text-brand-400 hover:underline">
              Question Bank
            </Link>
            {' '}and they&apos;ll appear here as timestamped captured moments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-8 h-[calc(100vh-3.5rem)] md:h-screen flex flex-col">
      {/* Slim header */}
      <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Answers</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {total} captured · {lockedCount} locked · {solidCount} solid · {draftCount} draft
            </p>
          </div>
          <Link
            href="/questions"
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex-shrink-0"
          >
            Question Bank →
          </Link>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: file tree */}
        <aside className="md:w-80 md:flex-shrink-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 md:h-full md:overflow-hidden">
          <AnswerFileTree answersByTheme={answersByTheme} selectedAnswerId={resolvedId} />
        </aside>

        {/* Right: viewer/editor */}
        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          {selected ? <AnswerDetail answer={selected} /> : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              Select an answer from the tree to view.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Header({ total, locked, solid, draft }: { total: number; locked: number; solid: number; draft: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Answers</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Your reusable answers. Each one is a timestamped captured moment.
          </p>
        </div>
        <Link href="/questions" className="flex-shrink-0 text-sm text-brand-600 dark:text-brand-400 hover:underline">
          Question Bank →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={total} />
        <StatCard label="Locked" value={locked} />
        <StatCard label="Solid" value={solid} />
        <StatCard label="Drafts" value={draft} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold text-neutral-900 dark:text-white">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</p>
    </div>
  )
}

function AnswerDetail({ answer }: { answer: ProfileAnswerWithQuestion }) {
  const q = answer.archived_question
  const confidence = answer.confidence ?? 'draft'
  const confidenceStyle = {
    draft: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
    solid: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
    locked: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  }[confidence]

  const created = answer.created_at ? new Date(answer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
  const updated = answer.last_updated ? new Date(answer.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : created

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
      <div className="max-w-3xl">
        {/* Captured-moment metadata */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {q?.theme && <ThemeTag theme={q.theme} />}
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider', confidenceStyle)}>
            {confidence}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
            {answer.word_count ?? 0} {(answer.word_count ?? 0) === 1 ? 'word' : 'words'}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
            Captured {created}{updated !== created ? ` · updated ${updated}` : ''}
          </span>
        </div>

        {/* Question */}
        <h2 className="text-base font-medium text-neutral-900 dark:text-white leading-relaxed mb-1">
          {q?.text ?? 'Question not found'}
        </h2>
        {q?.asked_by_count && q.asked_by_count > 1 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            Asked by {q.asked_by_count} programs
          </p>
        )}

        {/* Editor + provenance in one card */}
        <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4">
            <AnswerEditor
              archivedQuestionId={answer.archived_question_id}
              initialAnswer={answer}
              compact
            />
          </div>
          <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 font-mono truncate flex-1">
              {answer.id}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 flex-shrink-0">
              timestamped · version-tracked
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
