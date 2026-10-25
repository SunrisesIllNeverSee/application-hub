'use client'

// M09 W5 — application-level review board (directive §7 "Batch review").
// Every question with its derived status, agent classification, length vs
// limit, evidence count; filter chips; progress; a card opens in place
// (desktop: side panel, mobile: full-screen sheet) or one-at-a-time with
// next / previous. Bodies are decrypted lazily — only the governing
// versions of the visible page (for word counts) and the open card.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import type { InstanceQuestionRow } from '@/lib/aqua-local-client/review'
import type { ReuseClassification } from '@/lib/aqua-local'
import { loadBoard, loadBodyCounts, type ReviewContext } from '@/lib/review-ui/load'
import { boardRowVM, FILTER_LABEL, progressSummary, type FilterKey } from '@/lib/review-ui/view-model'
import { ReviewCard } from './ReviewCard'
import { ExportReviewDialog } from './ExportReviewDialog'
import { DecisionImportPanel } from './DecisionImportPanel'
import { HostedWorkspacePanel, useHostedWorkspace } from './HostedWorkspacePanel'
import { Notice, Pill } from './ui'

const PAGE_SIZE = 20
const FILTERS: FilterKey[] = ['all', 'attention', 'gaps', 'ready', 'approved', 'in_packet']
const CLASS_LABEL = { direct: 'Direct', adapt: 'Adapt', gap: 'Gap' } as const

export function ReviewBoard({
  instanceId,
  supplied,
  backHref,
}: {
  instanceId: string
  /** Public catalog context for catalog-backed instances. */
  supplied?: Partial<ReviewContext>
  backHref?: string | null
}) {
  const vault = useVault()
  const [rows, setRows] = useState<InstanceQuestionRow[] | null>(null)
  const [context, setContext] = useState<ReviewContext | null>(null)
  const [classes, setClasses] = useState<Record<string, ReuseClassification | null>>({})
  const [classifying, setClassifying] = useState(false)
  const [counts, setCounts] = useState<Record<string, { words: number; chars: number }>>({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [page, setPage] = useState(0)
  const [openOcc, setOpenOcc] = useState<string | null>(null)
  const [oneAtATime, setOneAtATime] = useState(false)
  const [dialog, setDialog] = useState<null | 'export' | 'import'>(null)
  const listFocusRef = useRef<string | null>(null)
  // m10 — is there a hosted workspace for this account? 'ready' activates
  // the per-approval "also record on the hosted workspace" option on the
  // card; 'none' offers the consent-gated enable action. Local vault stays
  // the default either way.
  const hosted = useHostedWorkspace()

  const refresh = useCallback(
    async (opts: { classify?: boolean } = {}) => {
      const secret = vault.getSecret()
      if (!secret) return
      try {
        const storage = await vault.ensureStorage()
        const b = await loadBoard(storage, secret, instanceId, supplied, { classify: false })
        setRows(b.rows)
        setContext(b.context)
        setError('')
        if (opts.classify) {
          // Reuse classification decrypts candidate answers across the vault
          // — run it after first paint, then merge (advisory data only).
          setClassifying(true)
          const c = await loadBoard(storage, secret, instanceId, supplied, { classify: true })
          setClasses(Object.fromEntries(c.rows.map((r) => [r.question_occurrence_id, r.classification])))
          setClassifying(false)
        }
      } catch (e) {
        setClassifying(false)
        setError(e instanceof Error ? e.message : 'Could not read this application from the vault')
      }
    },
    [vault, instanceId, supplied],
  )

  useEffect(() => {
    void refresh({ classify: true })
  }, [refresh])

  const merged = useMemo(
    () => (rows ?? []).map((r) => (r.question_occurrence_id in classes ? { ...r, classification: classes[r.question_occurrence_id] } : r)),
    [rows, classes],
  )
  const vms = useMemo(
    () => merged.map((r) => boardRowVM(r, r.versions.at(-1) ? counts[r.versions.at(-1)!.id] : null)),
    [merged, counts],
  )
  const summary = useMemo(() => progressSummary(vms), [vms])
  const filtered = useMemo(() => vms.filter((v) => v.categories.includes(filter)), [vms, filter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page])
  const inflight = useRef(new Set<string>())

  useEffect(() => {
    if (page >= pages) setPage(0)
  }, [page, pages])

  // Lazy word counts: decrypt the governing body of visible rows only.
  useEffect(() => {
    const secret = vault.getSecret()
    if (!secret || !rows) return
    const need = pageRows
      .map((v) => merged.find((r) => r.question_occurrence_id === v.question_occurrence_id)?.versions.at(-1)?.id)
      .filter((id): id is string => !!id && !(id in counts) && !inflight.current.has(id))
    if (need.length === 0) return
    for (const id of need) inflight.current.add(id)
    // Ids stay in `inflight` once tried (versions are immutable), so an
    // undecryptable body is not retried on every render.
    void (async () => {
      const storage = await vault.ensureStorage()
      const c = await loadBodyCounts(storage, secret, need)
      if (Object.keys(c).length) setCounts((prev) => ({ ...prev, ...c }))
    })()
  }, [pageRows, merged, counts, rows, vault])

  const openIndex = openOcc ? filtered.findIndex((v) => v.question_occurrence_id === openOcc) : -1
  const openRow = openOcc ? merged.find((r) => r.question_occurrence_id === openOcc) ?? null : null
  const globalIndex = openOcc ? merged.findIndex((r) => r.question_occurrence_id === openOcc) : -1

  const go = (delta: number) => {
    if (filtered.length === 0) return
    const i = openIndex < 0 ? 0 : (openIndex + delta + filtered.length) % filtered.length
    setOpenOcc(filtered[i].question_occurrence_id)
    setPage(Math.floor(i / PAGE_SIZE))
  }

  const close = useCallback(() => {
    listFocusRef.current = openOcc
    setOpenOcc(null)
    setOneAtATime(false)
  }, [openOcc])

  useEffect(() => {
    if (!openOcc && listFocusRef.current) {
      document.querySelector<HTMLElement>(`[data-row="${CSS.escape(listFocusRef.current)}"]`)?.focus()
      listFocusRef.current = null
    }
  }, [openOcc])

  useEffect(() => {
    if (!openOcc || dialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openOcc, dialog, close])

  if (error && !rows) {
    return <Notice tone="danger">{error}</Notice>
  }
  if (!rows || !context) {
    return <p className="text-sm text-neutral-500" role="status">Loading the review board from your vault…</p>
  }

  const pct = summary.total ? Math.round((summary.approved / summary.total) * 100) : 0

  const nav = (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" data-testid="card-prev" onClick={() => go(-1)} className="btn-secondary px-2 py-1 text-xs" aria-label="Previous question">
        ‹ Prev
      </button>
      <span className="px-1 text-[11px] tabular-nums text-neutral-500" aria-live="polite">
        {openIndex + 1}/{filtered.length}
      </span>
      <button type="button" data-testid="card-next" onClick={() => go(1)} className="btn-secondary px-2 py-1 text-xs" aria-label="Next question">
        Next ›
      </button>
      <button type="button" data-testid="card-close" onClick={close} className="btn-secondary ml-1 px-2 py-1 text-xs" aria-label="Close answer">
        ✕
      </button>
    </div>
  )

  return (
    <div className="space-y-4" data-testid="review-board">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {backHref && (
              <a href={backHref} className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                ← Back to workspace
              </a>
            )}
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Review answers{context.program_name ? ` — ${context.program_name}` : ''}</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {context.org_name ? `${context.org_name} · ` : ''}
              {context.deadline ? `Deadline ${context.deadline.slice(0, 10)} · ` : ''}
              Decrypted on this device only · only your explicit approval counts
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="open-export" onClick={() => setDialog('export')} className="btn-secondary px-3 py-1.5 text-xs">
              Export review (HTML)
            </button>
            <button type="button" data-testid="open-import" onClick={() => setDialog('import')} className="btn-secondary px-3 py-1.5 text-xs">
              Import decisions
            </button>
            <button
              type="button"
              data-testid="toggle-one"
              aria-pressed={oneAtATime}
              onClick={() => {
                const next = !oneAtATime
                setOneAtATime(next)
                if (next && !openOcc && filtered[0]) setOpenOcc(filtered[0].question_occurrence_id)
              }}
              className={cn('px-3 py-1.5 text-xs', oneAtATime ? 'btn-primary' : 'btn-secondary')}
            >
              One at a time
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" data-testid="progress">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <span>
              <strong className="text-neutral-900 dark:text-white">{summary.approved}</strong> of {summary.total} approved · {summary.in_packet} in packet ·{' '}
              {summary.ready} ready · {summary.attention} need attention · {summary.gaps} gap{summary.gaps === 1 ? '' : 's'}
            </span>
            <span>
              Required approved: {summary.required_approved}/{summary.required_total}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden>
            <div className="h-1.5 rounded-full bg-success-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {classifying && <p className="mt-1 text-[11px] text-neutral-400">Checking your answer bank for reusable answers…</p>}
        </div>

        <HostedWorkspacePanel hosted={hosted} />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter questions">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              data-testid={`filter-${f}`}
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f)
                setPage(0)
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                filter === f
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800',
              )}
            >
              {FILTER_LABEL[f]} <span className="tabular-nums opacity-70">{summary.counts[f]}</span>
            </button>
          ))}
        </div>
      </header>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className={cn(openRow && !oneAtATime && 'lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-4')}>
        {!oneAtATime && (
          <div>
            {filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
                No questions match “{FILTER_LABEL[filter]}”.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800" data-testid="board-rows">
                {pageRows.map((v) => {
                  const n = merged.findIndex((r) => r.question_occurrence_id === v.question_occurrence_id) + 1
                  const active = v.question_occurrence_id === openOcc
                  return (
                    <li key={v.question_occurrence_id}>
                      <button
                        type="button"
                        data-row={v.question_occurrence_id}
                        data-testid="board-row"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => setOpenOcc(v.question_occurrence_id)}
                        className={cn(
                          'flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                          active ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900',
                        )}
                      >
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5 text-xs tabular-nums text-neutral-400">Q{n}</span>
                          <span className="line-clamp-2 flex-1 text-sm text-neutral-900 dark:text-neutral-100">{v.text ?? v.question_occurrence_id}</span>
                          {v.required && <span className="text-[10px] text-neutral-400">required</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 pl-6">
                          <Pill tone={v.tone} title="Derived status">{v.status_label}</Pill>
                          {v.classification && <Pill tone="info" title="Agent recommendation (advice only)">Agent: {CLASS_LABEL[v.classification]}</Pill>}
                          <span className={cn('text-[11px] tabular-nums', v.over_limit ? 'font-semibold text-danger-600 dark:text-danger-500' : 'text-neutral-500')}>
                            {v.word_count == null
                              ? v.version_count
                                ? '… words'
                                : 'no answer'
                              : `${v.word_count}${v.word_limit ? `/${v.word_limit}` : ''} words`}
                            {v.char_limit && v.char_count != null ? ` · ${v.char_count}/${v.char_limit} chars` : ''}
                          </span>
                          <span className={cn('text-[11px]', v.evidence_count ? 'text-neutral-500' : 'text-warning-700 dark:text-warning-400')}>
                            {v.evidence_count} evidence
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {v.version_count} version{v.version_count === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {pages > 1 && (
              <nav className="mt-2 flex items-center justify-between text-xs" aria-label="Board pages">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-secondary px-2 py-1 text-xs">
                  Previous page
                </button>
                <span className="text-neutral-500">
                  Page {page + 1} of {pages}
                </span>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="btn-secondary px-2 py-1 text-xs">
                  Next page
                </button>
              </nav>
            )}
          </div>
        )}

        {openRow ? (
          <aside
            role={oneAtATime ? 'region' : 'dialog'}
            aria-label="Answer review"
            data-testid="card-panel"
            className={cn(
              oneAtATime
                ? 'relative rounded-xl border border-neutral-200 p-4 dark:border-neutral-800'
                : 'fixed inset-0 z-50 overflow-y-auto bg-white p-4 dark:bg-neutral-950 lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:rounded-xl lg:border lg:border-neutral-200 lg:dark:border-neutral-800',
            )}
          >
            <ReviewCard
              key={openRow.question_occurrence_id}
              instanceId={instanceId}
              row={openRow}
              context={context}
              index={globalIndex}
              onChanged={() => refresh()}
              headerActions={nav}
              hosted={hosted.state.status === 'ready' ? hosted.state.workspace : null}
            />
          </aside>
        ) : (
          !oneAtATime && (
            <p className="mt-4 hidden text-sm text-neutral-500 lg:block">Select a question to review its answer, evidence and recommendation.</p>
          )
        )}
      </div>

      {dialog === 'export' && <ExportReviewDialog instanceId={instanceId} rows={merged} context={context} onClose={() => setDialog(null)} />}
      {dialog === 'import' && (
        <DecisionImportPanel instanceId={instanceId} rows={merged} onClose={() => setDialog(null)} onApplied={() => refresh()} />
      )}
    </div>
  )
}
