import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'

export const metadata = { title: 'Import an application — Profile' }

type SourceKind = 'accelerator' | 'job' | 'school' | 'grant' | 'other'

const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  accelerator: 'Accelerator app',
  job: 'Job app',
  school: 'School essay',
  grant: 'Grant proposal',
  other: 'Other',
}

const VALID_SOURCE_KINDS: SourceKind[] = ['accelerator', 'job', 'school', 'grant', 'other']

function resolveSourceKind(raw: string | undefined): SourceKind {
  if (raw && (VALID_SOURCE_KINDS as string[]).includes(raw)) {
    return raw as SourceKind
  }
  return 'accelerator'
}

// ─── Server action: paste-import ───────────────────────────────────────────────

async function importPasteAction(formData: FormData): Promise<void> {
  'use server'

  const pastedText = String(formData.get('pasted_text') ?? '').trim()
  const sourceKind = resolveSourceKind(String(formData.get('source_kind') ?? ''))

  if (pastedText.length < 50) {
    redirect('/profile/import?err=too_short')
  }

  // Resolve base URL for the internal API call. In Next 14 on the server we
  // need an absolute URL for fetch().
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const base = `${proto}://${host}`

  // Forward the session cookies so the API route sees the same auth user.
  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  let payload:
    | { session_id: string | null; extracted_count: number }
    | { error: string }
    | null = null
  try {
    const res = await fetch(`${base}/api/import/paste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({ pasted_text: pastedText, source_kind: sourceKind }),
      cache: 'no-store',
    })
    payload = await res.json()
    if (!res.ok) {
      const errMsg =
        payload && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'extraction_failed'
      redirect(`/profile/import?err=${encodeURIComponent(errMsg)}`)
    }
  } catch {
    redirect('/profile/import?err=network')
  }

  revalidatePath('/profile/answers')
  revalidatePath('/questions')
  revalidatePath('/profile/import')

  const sessionId =
    payload && 'session_id' in payload && payload.session_id ? payload.session_id : ''
  const count =
    payload && 'extracted_count' in payload ? payload.extracted_count : 0
  redirect(`/profile/import?session=${sessionId}&saved=${count}`)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: string
  source_kind: string | null
  extracted_count: number | null
  error_text: string | null
  created_at: string
}

export default async function ProfileImportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; session?: string; saved?: string; err?: string }>
}) {
  const { kind, session, saved, err } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const defaultKind = resolveSourceKind(kind)
  const savedCount = saved ? Number(saved) : null
  const sessionParam = session ?? null
  const errParam = err ?? null

  type SessionsResp = { data: SessionRow[] | null }
  const sessionsResp = (await supabase
    .from('app_import_sessions')
    .select('id, source_kind, extracted_count, error_text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)) as unknown as SessionsResp
  const recentImports: SessionRow[] = sessionsResp.data ?? []

  return (
    <div className="max-w-3xl space-y-8">
      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Import an application
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Paste an application you&apos;ve already submitted — to YC, a job, a grad
          school, a grant — and we&apos;ll extract the questions and answers into
          your answer bank.
        </p>
      </div>

      {/* Banners */}
      {savedCount !== null && sessionParam && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 px-4 py-3">
          <p className="text-sm text-green-800 dark:text-green-300">
            Imported{' '}
            <span className="font-semibold">
              {savedCount} {savedCount === 1 ? 'answer' : 'answers'}
            </span>{' '}
            into your answer bank.{' '}
            <a
              href="/profile/answers"
              className="underline font-medium hover:text-green-900 dark:hover:text-green-200"
            >
              View answer bank
            </a>
          </p>
        </div>
      )}

      {errParam && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-800 dark:text-red-300">
            {errParam === 'too_short'
              ? 'Paste at least 50 characters of your application.'
              : errParam === 'network'
              ? 'Network error — please try again.'
              : errParam === 'AI extraction not configured'
              ? 'AI extraction is not configured on this deployment. Add ANTHROPIC_API_KEY to the server environment.'
              : `Import failed: ${errParam}`}
          </p>
        </div>
      )}

      {/* Form */}
      <form action={importPasteAction} className="card p-6 space-y-5">
        <div>
          <label className="label" htmlFor="pasted_text">
            Application text
          </label>
          <textarea
            id="pasted_text"
            name="pasted_text"
            rows={20}
            className="input resize-y font-mono text-xs leading-relaxed"
            placeholder={`Q: Tell us about your team.\nA: We're a team of three engineers who met at Stanford...\n\nQ: What problem are you solving?\nA: We help founders ...`}
            minLength={50}
            maxLength={50000}
            required
          />
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-600">
            50 – 50,000 characters. Paste Q&amp;A pairs, a Google Doc export, or
            an entire essay — we&apos;ll find the structure.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="source_kind">
            What kind of application is this?
          </label>
          <select
            id="source_kind"
            name="source_kind"
            defaultValue={defaultKind}
            className="input"
          >
            {VALID_SOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {SOURCE_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button type="submit" className="btn-primary">
            Extract questions &amp; answers
          </button>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
            Existing answers in your bank are never overwritten — we only fill gaps.
          </p>
        </div>
      </form>

      {/* Recent imports */}
      <section>
        <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
          Recent imports
        </h3>
        {recentImports.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-600">
            No imports yet. Paste one above to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentImports.map((row) => {
              const dt = new Date(row.created_at)
              const dateStr = dt.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const timeStr = dt.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })
              const kindLabel =
                row.source_kind && (VALID_SOURCE_KINDS as string[]).includes(row.source_kind)
                  ? SOURCE_KIND_LABEL[row.source_kind as SourceKind]
                  : 'Application'
              return (
                <li
                  key={row.id}
                  className="card px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {kindLabel}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {dateStr} · {timeStr}
                      {row.error_text ? ' · failed' : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {row.error_text ? (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Error
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {row.extracted_count ?? 0}
                        </span>{' '}
                        {row.extracted_count === 1 ? 'answer' : 'answers'}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
