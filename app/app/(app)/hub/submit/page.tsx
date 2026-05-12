import { createClient } from '@/lib/supabase/server'
import { SubmitProgramForm } from './SubmitProgramForm'

export const metadata = {
  title: 'Submit a Program — Hub',
}

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

type QueueStatus =
  | 'pending'
  | 'pending_review'
  | 'mapped'
  | 'manual'
  | 'rejected'
  | 'accepted'
  | 'processed'
  | (string & {})

interface SubmissionRow {
  id: string
  url: string | null
  raw_text: string | null
  status: QueueStatus
  notes: string | null
  kind: string | null
  submitted_at: string | null
  created_at: string
}

interface StatusBadgeMeta {
  label: string
  className: string
}

const KIND_LABELS: Record<string, string> = {
  accelerator: 'Accelerator',
  vc: 'Venture Capital',
  grant: 'Grant',
  fellowship: 'Fellowship',
  job_fulltime: 'Job — Full-time',
  job_internship: 'Job — Internship',
  job_contract: 'Job — Contract',
  school_undergrad: 'School — Undergraduate',
  school_grad: 'School — Graduate',
  school_professional: 'School — Professional (MBA / JD / MD)',
  other: 'Other',
}

const STATUS_BADGES: Record<string, StatusBadgeMeta> = {
  pending: {
    label: 'Pending review',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  pending_review: {
    label: 'Pending review',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  accepted: {
    label: 'Accepted',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  mapped: {
    label: 'Mapped',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  processed: {
    label: 'Processed',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  manual: {
    label: 'In manual review',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
}

function statusMeta(status: string): StatusBadgeMeta {
  return (
    STATUS_BADGES[status] ?? {
      label: status,
      className:
        'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    }
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function hostname(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SubmitProgramPage({
  searchParams,
}: {
  searchParams: { queued?: string; kind?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let submissions: SubmissionRow[] = []
  if (user) {
    const { data } = await supabase
      .from('import_queue')
      .select('id, url, raw_text, status, notes, kind, submitted_at, created_at')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    submissions = (data ?? []) as unknown as SubmissionRow[]
  }

  const queuedId = searchParams.queued?.trim() || null
  const justQueued =
    queuedId !== null &&
    submissions.some((s) => s.id === queuedId)

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          Submit a program
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Know a program that isn&apos;t in the archive yet? Drop the URL.
          We&apos;ll scrape the questions, score them, and add them to the
          directory. <span className="text-amber-700 dark:text-amber-300 font-medium">Earn 5 drip unlocks</span>{' '}
          for each submission accepted into the archive — especially valuable for
          under-developed verticals (jobs, schools, grants).
        </p>
      </div>

      {justQueued && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
        >
          Thanks — your submission is queued for review. You&apos;ll see it
          appear in the archive once it&apos;s processed.
        </div>
      )}

      <div className="card p-6 mb-8">
        <SubmitProgramForm defaultKind={searchParams.kind} />
      </div>

      <section>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-3">
          Your submissions
        </h2>

        {submissions.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No submissions yet. Drop a program URL above to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {submissions.map((row) => {
              const badge = statusMeta(row.status)
              const displayUrl = row.url ?? row.raw_text ?? ''
              const host = hostname(row.url ?? displayUrl)
              const date = formatDate(row.submitted_at ?? row.created_at)
              const kindLabel = row.kind ? KIND_LABELS[row.kind] ?? row.kind : null
              return (
                <li
                  key={row.id}
                  className="card p-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {displayUrl ? (
                        <a
                          href={row.url ?? '#'}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm font-medium text-neutral-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate"
                        >
                          {host || displayUrl}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">
                          Submission
                        </span>
                      )}
                      {kindLabel && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          · {kindLabel}
                        </span>
                      )}
                    </div>
                    {row.notes && (
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                        {row.notes}
                      </p>
                    )}
                    {date && (
                      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                        Submitted {date}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
