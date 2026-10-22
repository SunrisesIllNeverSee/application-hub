'use client'

// M09 W5 — "Export review (HTML)". User-initiated download only, behind an
// exposure notice: the file contains private plaintext answers. Building it
// decrypts every card on this device; nothing is uploaded anywhere.

import { useEffect, useRef, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import type { InstanceQuestionRow } from '@/lib/aqua-local-client/review'
import { issueReviewExportNonce, loadCard, type ReviewContext } from '@/lib/review-ui/load'
import { buildReviewHtml } from '@/lib/review-ui/html-export'
import { Notice } from './ui'

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 0)
}

export function ExportReviewDialog({
  instanceId,
  rows,
  context,
  onClose,
}: {
  instanceId: string
  rows: InstanceQuestionRow[]
  context: ReviewContext
  onClose: () => void
}) {
  const vault = useVault()
  const [ack, setAck] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input,button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function exportNow() {
    const secret = vault.getSecret()
    if (!secret) {
      setError('Vault is locked — unlock to export.')
      return
    }
    setError('')
    setDone('')
    try {
      const storage = await vault.ensureStorage()
      const now = new Date().toISOString()
      const cards = []
      for (let i = 0; i < rows.length; i++) {
        setProgress(`Decrypting ${i + 1} of ${rows.length}…`)
        cards.push(await loadCard(storage, secret, { instance_id: instanceId, row: rows[i], context, now }))
      }
      // M2: a fresh nonce per export (its sha256 is kept in the vault) lets
      // the import recognise decision files made from THIS export.
      const export_nonce = await issueReviewExportNonce(storage, instanceId)
      const html = buildReviewHtml({ instance_id: instanceId, program_name: context.program_name, org_name: context.org_name, exported_at: now, export_nonce, cards })
      const name = `aqua-review-${instanceId}-${now.slice(0, 10)}.html`
      downloadText(name, html, 'text/html')
      setDone(`Downloaded ${name}. Opening it does not update AQUA — import its decision file here to apply decisions.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        data-testid="export-dialog"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-neutral-900 sm:rounded-2xl"
      >
        <h2 id="export-title" className="text-base font-semibold text-neutral-900 dark:text-white">
          Export review (HTML)
        </h2>
        <div className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <p className="font-medium text-warning-800 dark:text-warning-300">This file contains your private answers in plain text.</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>It is built on this device and saved only where your browser downloads it. Nothing is uploaded.</li>
            <li>Anyone with the file can read every answer, evidence excerpt, comment and hash in it.</li>
            <li>Clicking decisions inside the file does <strong>not</strong> update AQUA. It only fills a decision file that you import here and confirm.</li>
          </ul>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
          <input type="checkbox" data-testid="export-ack" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4" />
          I understand this file exposes my private answers and I will store it safely.
        </label>
        {progress && <p className="mt-3 text-xs text-neutral-500" role="status">{progress}</p>}
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
        {done && <div className="mt-3"><Notice tone="success" testId="export-done">{done}</Notice></div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">
            {done ? 'Close' : 'Cancel'}
          </button>
          <button type="button" data-testid="export-confirm" disabled={!ack || !!progress} onClick={() => void exportNow()} className="btn-primary px-3 py-1.5 text-xs">
            {progress ? 'Preparing…' : 'Download review HTML'}
          </button>
        </div>
      </div>
    </div>
  )
}
