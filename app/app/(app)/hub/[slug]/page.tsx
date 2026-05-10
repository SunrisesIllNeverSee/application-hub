import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type {
  Program,
  ProgramDna,
  ProgramQuestionWithArchived,
} from '@/lib/database.types'
import { ThemeBar } from '@/components/ThemeBar'
import { ThemeTag } from '@/components/ThemeTag'
import {
  formatCheckSize,
  formatEquity,
  formatDeadline,
  formatProgramStartDate,
  getApplicantSignal,
  getHeatSignal,
  programTypeLabel,
} from '@/lib/utils'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props) {
  return {
    title: params.slug.replace(/-/g, ' '),
  }
}

export default async function ProgramDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('slug', params.slug)
    .single<Program>()

  if (!program) notFound()

  // Fetch DNA weights
  const { data: dnaRows } = await supabase
    .from('program_dna')
    .select('*')
    .eq('program_id', program.id)
    .order('weight_pct', { ascending: false })
    .returns<ProgramDna[]>()

  // Fetch questions with archived data
  const { data: questionRows } = await supabase
    .from('program_questions')
    .select('*, archived_question:archived_questions(*)')
    .eq('program_id', program.id)
    .order('order_index', { ascending: true })
    .returns<ProgramQuestionWithArchived[]>()

  const dna = dnaRows ?? []
  const questions = questionRows ?? []
  const deadline = formatDeadline(program.deadline_at)
  const heat = getHeatSignal(program.heat_score, program.program_value_score)
  const applicants = getApplicantSignal(program.applicant_count, program.cohort_size)
  const tldr = program.tldr
  const pros = Array.isArray(program.pros) ? program.pros : []
  const cons = Array.isArray(program.cons) ? program.cons : []
  const bestFor = program.best_for
  const cohortStart = formatProgramStartDate(program.program_start_date)

  // Group questions by section
  const sections = questions.reduce<Record<string, ProgramQuestionWithArchived[]>>((acc, q) => {
    const section = q.section ?? 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push(q)
    return acc
  }, {})

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Link
        href="/hub"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Hub
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                {programTypeLabel(program.type)}
              </span>
              {program.is_rolling && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  Rolling
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{program.name}</h1>
            {program.description && (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {program.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col gap-2">
            <Link
              href={`/workspace/${program.id}`}
              className="btn-primary"
            >
              Start Application
            </Link>
            {program.url && (
              <a
                href={program.url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-center"
              >
                Website
              </a>
            )}
          </div>
        </div>

        {/* Key stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800 min-w-0">
          <Stat
            label="Equity"
            value={formatEquity(program.equity_taken)}
          />
          <Stat
            label="Investment"
            value={formatCheckSize(program.check_size_max ?? program.check_size_min)}
          />
          <Stat
            label="Focus"
            value={program.geo_focus?.length > 0 ? program.geo_focus.join(', ') : '—'}
          />
          <Stat
            label="Deadline"
            value={
              <span className={deadline.urgent ? 'text-warning-500 font-semibold' : undefined}>
                {deadline.label}
              </span>
            }
          />
          <Stat
            label={heat.provisional ? 'Heat signal' : 'Heat score'}
            value={heat.label}
            hint={heat.detail}
          />
          {program.program_value_score != null && (
            <Stat label="Value score" value={`${Math.round(program.program_value_score)}/100`} />
          )}
          {(program.applicant_count != null || program.cohort_size != null) && (
            <Stat
              label={applicants.detail}
              value={applicants.label}
              hint={applicants.provisional ? 'Provisional' : undefined}
            />
          )}
          {program.cohort_name && <Stat label="Cohort" value={program.cohort_name} />}
          {cohortStart && <Stat label="Starts" value={cohortStart} />}
          {program.industry_tags?.length > 0 && (
            <Stat label="Industries" value={program.industry_tags.slice(0, 2).join(', ')} />
          )}
        </div>
      </div>

      {/* TL;DR / Pros / Cons / Best For */}
      {(tldr || pros.length > 0 || cons.length > 0 || bestFor) && (
        <div className="card p-6 mb-6">
          {tldr && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-5 font-medium">
              {tldr}
            </p>
          )}
          {(pros.length > 0 || cons.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {pros.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-success-700 dark:text-success-400 uppercase tracking-wider mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {pros.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="mt-0.5 text-success-500 flex-shrink-0">+</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-warning-700 dark:text-warning-400 uppercase tracking-wider mb-2">Watch out for</p>
                  <ul className="space-y-1.5">
                    {cons.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="mt-0.5 text-warning-500 flex-shrink-0">&minus;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {bestFor && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Best for </span>
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{bestFor}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* DNA */}
        {dna.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
              What {program.name} cares about
            </h2>
            <div className="space-y-3">
              {dna.map((d) => (
                <ThemeBar
                  key={d.id}
                  theme={d.theme}
                  weight={d.weight_pct}
                  questionCount={d.question_count}
                />
              ))}
            </div>
          </div>
        )}

        {/* Questions */}
        <div className={dna.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {Object.keys(sections).length === 0 ? (
            <div className="card p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Questions for this program haven&apos;t been added yet.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(sections).map(([section, qs]) => (
                <div key={section} className="card overflow-hidden">
                  <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                    <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {section}
                    </h3>
                  </div>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {qs.map((q) => (
                      <QuestionRow key={q.id} q={q} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-0.5 truncate">{label}</p>
      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{value}</p>
      {hint && <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">{hint}</p>}
    </div>
  )
}

function QuestionRow({ q }: { q: ProgramQuestionWithArchived }) {
  const sig = q.archived_question?.significance_score ?? 0
  const stars = Math.round(sig * 5)  // significance_score is 0–1

  return (
    <div className="px-5 py-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
          {q.asked_as}
        </p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <ThemeTag theme={q.archived_question?.theme} />
          {q.word_limit && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {q.word_limit} words
            </span>
          )}
          {q.char_limit && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {q.char_limit} chars
            </span>
          )}
          {!q.is_required && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">Optional</span>
          )}
        </div>
      </div>
      {stars > 0 && (
        <div className="flex-shrink-0 flex gap-0.5" title={`Significance: ${sig}/100`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              className={i < stars ? 'text-warning-500' : 'text-neutral-200 dark:text-neutral-700'}
            >
              <path
                fill="currentColor"
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          ))}
        </div>
      )}
    </div>
  )
}
