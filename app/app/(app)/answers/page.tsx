import { createClient } from '@/lib/supabase/server'
import type { ProfileAnswerWithQuestion, QuestionTheme } from '@/lib/database.types'
import { themeLabel } from '@/lib/utils'
import { ThemeTag } from '@/components/ThemeTag'
import { AnswerEditor } from '@/components/AnswerEditor'
import Link from 'next/link'

export const metadata = { title: 'Answer Bank' }

const THEME_ORDER: QuestionTheme[] = [
  'problem', 'solution', 'market', 'traction', 'team',
  'business_model', 'vision', 'impact', 'technical',
  'fundraising', 'personal', 'fit',
]

export default async function AnswerBankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: answers } = await supabase
    .from('profile_answers')
    .select('*, archived_question:archived_questions(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .returns<ProfileAnswerWithQuestion[]>()

  const allAnswers = answers ?? []

  const grouped = THEME_ORDER.reduce<Record<QuestionTheme, ProfileAnswerWithQuestion[]>>(
    (acc, theme) => {
      acc[theme] = allAnswers.filter(a => a.archived_question?.theme === theme)
      return acc
    },
    {} as Record<QuestionTheme, ProfileAnswerWithQuestion[]>
  )

  const uncategorized = allAnswers.filter(a => !a.archived_question?.theme)
  const lockedCount  = allAnswers.filter(a => a.confidence === 'locked').length
  const solidCount   = allAnswers.filter(a => a.confidence === 'solid').length
  const draftCount   = allAnswers.filter(a => a.confidence === 'draft').length

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Answer Bank</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Your reusable answers. Write once, apply everywhere.
          </p>
        </div>
        <Link
          href="/bank"
          className="flex-shrink-0 text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          Question Bank →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total answers" value={allAnswers.length} />
        <StatCard label="Locked" value={lockedCount} />
        <StatCard label="Solid" value={solidCount} />
        <StatCard label="Drafts" value={draftCount} />
      </div>

      {allAnswers.length === 0 ? (
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
            Start answering questions in your{' '}
            <Link href="/bank" className="text-brand-600 dark:text-brand-400 hover:underline">
              Question Bank
            </Link>
            {' '}and they&apos;ll appear here for reuse across every application.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {THEME_ORDER.map(theme => {
            const themeAnswers = grouped[theme]
            if (!themeAnswers || themeAnswers.length === 0) return null
            return (
              <section key={theme}>
                <div className="flex items-center gap-3 mb-4">
                  <ThemeTag theme={theme} size="lg" />
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    {themeAnswers.length} answer{themeAnswers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-4">
                  {themeAnswers.map(answer => (
                    <AnswerBankCard key={answer.id} answer={answer} />
                  ))}
                </div>
              </section>
            )
          })}
          {uncategorized.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Other</span>
                <span className="text-xs text-neutral-400">{uncategorized.length}</span>
              </div>
              <div className="space-y-4">
                {uncategorized.map(answer => (
                  <AnswerBankCard key={answer.id} answer={answer} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
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

function AnswerBankCard({ answer }: { answer: ProfileAnswerWithQuestion }) {
  const question = answer.archived_question
  const badge = {
    draft:  { label: 'Draft',  className: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300' },
    solid:  { label: 'Solid',  className: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400' },
    locked: { label: 'Locked', className: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' },
  }[answer.confidence ?? 'draft']

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {question?.text ?? 'Question not found'}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-auto">{answer.word_count} words</span>
        </div>
      </div>
      <div className="p-5">
        <AnswerEditor archivedQuestionId={answer.archived_question_id} initialAnswer={answer} compact />
      </div>
    </div>
  )
}
