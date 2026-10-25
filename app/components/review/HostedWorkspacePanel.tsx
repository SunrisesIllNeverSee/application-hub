'use client'

// m10 — hosted-workspace state for the review surface + the consent card
// that provisions it.
//
// The signal for "this review can also write to a hosted workspace" is the
// caller's own aqua_workspaces row (RLS-scoped to the signed-in account):
// a row exists only after the human explicitly enabled hosted storage via
// POST /api/workspace/init {consent_hosted_workspace:true} — the button
// below IS that consent act. No row → the hosted path stays dormant and
// the local vault remains the only place approvals are recorded.

import { useCallback, useEffect, useState } from 'react'
import { findHostedWorkspace, getAccessToken, hostedInit, HostedApiError, type HostedWorkspaceRow } from '@/lib/aqua-hosted'
import { Notice, Pill } from './ui'

export type HostedWorkspaceState =
  | { status: 'probing' }
  /** No signed-in session: the hosted surface stays completely hidden. */
  | { status: 'signed_out' }
  /** Signed in, no hosted workspace — enabling is offered, never assumed. */
  | { status: 'none' }
  /** Hosted workspace exists — approvals may also be recorded there. */
  | { status: 'ready'; workspace: HostedWorkspaceRow }

export interface UseHostedWorkspace {
  state: HostedWorkspaceState
  busy: boolean
  error: string
  /** The consent action: POST /api/workspace/init, then re-probe. */
  enable: () => Promise<void>
}

export function useHostedWorkspace(): UseHostedWorkspace {
  const [state, setState] = useState<HostedWorkspaceState>({ status: 'probing' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const probe = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) {
        setState({ status: 'signed_out' })
        return
      }
      const ws = await findHostedWorkspace()
      setState(ws ? { status: 'ready', workspace: ws } : { status: 'none' })
    } catch (e) {
      // The hosted surface failing to probe must not break the local
      // review board — degrade to 'none' with an honest error the panel
      // can surface only if the user tries to enable.
      setState({ status: 'none' })
      setError(e instanceof Error ? e.message : 'Could not check for a hosted workspace')
    }
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  const enable = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new HostedApiError(0, 'not_signed_in', 'sign in to enable a hosted workspace')
      await hostedInit(token)
      const ws = await findHostedWorkspace()
      setState(ws ? { status: 'ready', workspace: ws } : { status: 'none' })
      if (!ws) throw new HostedApiError(0, 'workspace_lookup_failed', 'the workspace was provisioned but could not be re-read')
    } catch (e) {
      if (e instanceof HostedApiError && (e.code === 'not_configured' || e.code === 'local_first')) {
        setError('Hosted workspaces are not enabled on this deployment.')
      } else {
        setError(e instanceof Error ? e.message : 'Could not enable the hosted workspace')
      }
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, error, enable }
}

/**
 * The consent affordance. Rendered on the review board: quiet when there is
 * no session (local-first default), an explicit enable card when the user
 * is signed in without a hosted workspace, and a small status line once
 * one exists.
 */
export function HostedWorkspacePanel({ hosted }: { hosted: UseHostedWorkspace }) {
  const { state, busy, error, enable } = hosted
  if (state.status === 'signed_out' || state.status === 'probing') return null
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" data-testid="hosted-workspace-panel">
      {state.status === 'ready' ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <Pill tone="info">Hosted workspace on</Pill>
          <span>
            Approvals you confirm can also be recorded on your hosted workspace — choose per approval inside the
            confirm step. Your vault stays the primary record.
          </span>
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-prose text-xs text-neutral-600 dark:text-neutral-400">
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Hosted workspace is off.</strong> Enable it
            to let the hosted MCP tools stage and review answers against encrypted records stored on AQUA servers. Opt-in —
            your on-device vault stays the default and works without it.
          </p>
          <button
            type="button"
            data-testid="enable-hosted-workspace"
            disabled={busy}
            onClick={() => void enable()}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {busy ? 'Enabling…' : 'Enable hosted workspace'}
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Notice tone="danger" testId="hosted-workspace-error">{error}</Notice>
        </div>
      )}
    </div>
  )
}
