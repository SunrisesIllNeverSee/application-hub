import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { SubmissionExport } from '@/components/SubmissionExport'
import { ProgramSelect } from '@/components/ProgramSelect'
import { cn } from '@/lib/utils'
import type {
  Program,
  ProgramQuestionWithArchived,
  ProfileAnswer,
} from '@/lib/database.types'

export const metadata = { title: 'Workstation — Application Hub' }

type SourceKind = 'accelerator' | 'job' | 'school' | 'grant' | 'other'
const VALID_SOURCE_KINDS: SourceKind[] = ['accelerator', 'job', 'school', 'grant', 'other']
const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  accelerator: 'Accelerator app',
  job: 'Job application',
  school: 'School / grad essay',
  grant: 'Grant proposal',
  other: 'Other',
}

function resolveSourceKind(raw: string | undefined): SourceKind {
  if (raw && (VALID_SOURCE_KINDS as string[]).includes(raw)) return raw as SourceKind
  return 'accelerator'
}

async function importAction(formData: FormData): Promise<void> {
  'use server'
  const pastedText = String(formData.get('pasted_text') ?? '').trim()
  const sourceKind = resolveSourceKind(String(formData.get('source_kind') ?? ''))

  if (pastedText.length < 50) {
    redirect('/workstation?tab=import&err=too_short')
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const base = `${proto}://${host}`

  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  let payload: { session_id?: string | null; extracted_count?: number; error?: string } | null = null
  try {
    const res = await fetch(`${base}/api/import/paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({ pasted_text: pastedText, source_kind: sourceKind }),
      cache: 'no-store',
    })
    payload = await res.json()
    if (!res.ok) {
      const msg = payload?.error ?? 'extraction_failed'
      redirect(`/workstation?tab=import&err=${encodeURIComponent(msg)}`)
    }
  } catch {
    redirect('/workstation?tab=import&err=network')
  }

  revalidatePath('/workstation')
  revalidatePath('/profile/answers')
  revalidatePath('/questions')

  const sessionId = payload?.session_id ?? ''
  const count = payload?.extracted_count ?? 0
  redirect(`/workstation?tab=import&session=${sessionId}&saved=${count}`)
}

interface Props {
  searchParams: Promise<{
    tab?: string
    program?: string
    err?: string
    session?: string
    saved?: string
    kind?: string
  }>
}

export default async function WorkstationPage({ searchParams }: Props) {
  const { tab: tabParam, program: programId, err, session, saved, kind } = await searchParams
  const tab = tabParam === 'export' ? 'export' : 'import'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const defaultKind = resolveSourceKind(kind)
  const savedCount = saved ? Number(saved) : null
  const errParam = err ?? null

  type SessionRow = {
    id: string; source_kind: string | null; extracted_count: number | null; error_text: string | null; created_at: string
  }
  const { data: recentImports } = await supabase
    .from('app_import_sessions')
    .select('id, source_kind, extracted_count, error_text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: appRows } = await supabase
    .from('user_applications')
    .select('id, program_id, status, programs(id, name, slug, website_url)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  type AppRow = {
    id: string; program_id: string; status: string
    programs: { id: string; name: string; slug: string; website_url?: string | null } | { id: string; name: string; slug: string; website_url?: string | null }[] | null
  }
  const apps = (appRows ?? []) as unknown as AppRow[]

  const programList = apps.map((a) => {
    const prog = Array.isArray(a.programs) ? a.programs[0] : a.programs
    return { id: a.program_id, name: prog?.name ?? 'Unknown', status: a.status }
  })

  const resolvedProgramId = programId ?? programList[0]?.id ?? null
  let selectedProgram: Program | null = null
  let exportQuestions: ExportQItem[] = []

  if (resolvedProgramId) {
    const { data: prog } = await supabase
      .from('programs')
      .select('*')
      .eq('id', resolvedProgramId)
      .single<Program>()
    selectedProgram = prog ?? null

    if (selectedProgram) {
      const { data: qRows } = await supabase
        .from('program_questions')
        .select('*, archived_question:archived_questions(*)')
        .eq('program_id', selectedProgram.id)
        .order('order_index', { ascending: true })
        .returns<ProgramQuestionWithArchived[]>()

      const questions = qRows ?? []
      const archivedIds = questions.map((q) => q.archived_question_id).filter(Boolean)

      let answerMap: Record<string, ProfileAnswer> = {}
      if (archivedIds.length > 0) {
        const { data: answers } = await supabase
          .from('profile_answers')
          .select('*')
          .eq('user_id', user.id)
          .in('archived_question_id', archivedIds)
          .returns<ProfileAnswer[]>()
        answerMap = Object.fromEntries((answers ?? []).map((a) => [a.archived_question_id, a]))
      }

      exportQuestions = questions.map((q) => {
        const answer = answerMap[q.archived_question_id] ?? null
        const aq = Array.isArray(q.archived_question) ? q.archived_question[0] : q.archived_question
        return {
          archived_question_id: q.archived_question_id,
          item: {
            asked_as: q.asked_as ?? '',
            word_limit: q.word_limit ?? null,
            char_limit: q.char_limit ?? null,
            section: q.section ?? null,
            order_index: q.order_index ?? 0,
            is_required: q.is_required ?? false,
            archived_question: aq ? { theme: aq.theme ?? null } : null,
          },
          answer: answer
            ? { answer_content: answer.answer_content ?? '', word_count: answer.word_count ?? null }
            : null,
        }
      })
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Workstation</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Import answers from past applications · Export compiled submissions
        </p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-8">
        <TabLink href="/workstation?tab=import" active={tab === 'import'}>Import</TabLink>
        <TabLink href="/workstation?tab=export" active={tab === 'export'}>Export</TabLink>
      </div>

      {tab === 'import' && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Paste any application you&apos;ve already submitted and we&apos;ll pull the Q&amp;A pairs into your answer bank.
          </p>

          {savedCount !== null && session && (
            <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 px-4 py-3">
              <p className="text-sm text-green-800 dark:text-green-300">
                Imported <span className="font-semibold">{savedCount} {savedCount === 1 ? 'answer' : 'answers'}</span> into your answer bank.{' '}
                <Link href="/answers" className="underline font-medium hover:text-green-900 dark:hover:text-green-200">View answers</Link>
              </p>
            </div>
          )}

          {errParam && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-800 dark:text-red-300">
                {errParam === 'too_short'
                  ? 'Paste at least 50 characters.'
                  : errParam === 'network'
                  ? 'Network error — please try again.'
                  : errParam === 'AI extraction not configured'
                  ? 'No AI provider configured. Add one in Profile → Integrations.'
                  : `Import failed: ${errParam}`}
              </p>
            </div>
          )}

          <form action={importAction} className="card p-6 space-y-5">
            <div>
              <label className="label" htmlFor="pasted_text">Application text</label>
              <textarea
                id="pasted_text"
                name="pasted_text"
                rows={18}
                className="input resize-y font-mono text-xs leading-relaxed"
                placeholder={"Q: Tell us about your team.\nA: We're a team of three engineers...\n\nQ: What problem are you solving?\nA: We help founders..."}
                minLength={50}
                maxLength={50000}
                required
              />
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-600">
                50–50,000 characters. Paste Q&amp;A pairs, a Google Doc export, or a full essay.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="source_kind">What kind of application?</label>
              <select id="source_kind" name="source_kind" defaultValue={defaultKind} className="input">
                {VALID_SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>{SOURCE_KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>

            <div>
              <button type="submit" className="btn-primary">Extract questions &amp; answers</button>
              <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">Existing answers are never overwritten — we only fill gaps.</p>
            </div>
          </form>

          {(recentImports ?? []).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Recent imports</h3>
              <ul className="space-y-2">
                {(recentImports as SessionRow[]).map((row) => {
                  const dt = new Date(row.created_at)
                  const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                  const kindLabel = row.source_kind && (VALID_SOURCE_KINDS as string[]).includes(row.source_kind)
                    ? SOURCE_KIND_LABEL[row.source_kind as SourceKind]
                    : 'Application'
                  return (
                    <li key={row.id} className="card px-4 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{kindLabel}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{dateStr} · {timeStr}{row.error_text ? ' · failed' : ''}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {row.error_text
                          ? <span className="text-xs text-red-600 dark:text-red-400">Error</span>
                          : <span className="text-xs text-neutral-500"><span className="font-semibold text-neutral-800 dark:text-neutral-200">{row.extracted_count ?? 0}</span> {row.extracted_count === 1 ? 'answer' : 'answers'}</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Pick a program and get all your answers compiled and ready to paste into the application portal.
          </p>

          {programList.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No applications yet.{' '}
                <Link href="/applications" className="text-brand-600 dark:text-brand-400 hover:underline">Start one here.</Link>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="program-select">Program</label>
                <ProgramSelect programs={programList} selected={resolvedProgramId ?? ''} />
              </div>

              {selectedProgram ? (
                <div className="card overflow-hidden" style={{ height: '65vh', minHeight: '420px' }}>
                  <SubmissionExport
                    programName={selectedProgram.name}
                    programUrl={(selectedProgram as unknown as { website_url?: string | null }).website_url ?? null}
                    questions={exportQuestions}
                  />
                </div>
              ) : (
                <div className="card p-8 text-center text-sm text-neutral-400 dark:text-neutral-600">
                  Select a program above.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
        active
          ? 'border-brand-600 text-brand-700 dark:text-brand-400'
          : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300'
      )}
    >
      {children}
    </Link>
  )
}

type ExportQItem = {
  archived_question_id: string
  item: {
    asked_as: string
    word_limit: number | null
    char_limit: number | null
    section: string | null
    order_index: number
    is_required: boolean
    archived_question: { theme: string | null } | null
  }
  answer: { answer_content: string; word_count: number | null } | null
}
