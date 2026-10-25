'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadConsentRequest, decideConsentRequest } from '@/lib/oauth-consent'

type AuthzRequest = {
  authorization_id: string
  client?: { id?: string; name?: string; uri?: string }
  scope?: string
}

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-8">Loading…</main>}>
      <ConsentInner />
    </Suspense>
  )
}

function ConsentInner() {
  const params = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  const [authz, setAuthz] = useState<AuthzRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)

  useEffect(() => {
    if (!authorizationId || !supabaseUrl) {
      setError(authorizationId ? 'Missing Supabase configuration.' : 'Missing authorization_id.')
      return
    }
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!session) {
          window.location.assign(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`)
          return
        }
        const details = await loadConsentRequest(supabase.auth.oauth, authorizationId)
        if ('redirect_url' in details) {
          window.location.assign(details.redirect_url)
          return
        }
        setAuthz(details)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the authorization request. Return to OpenAI and reconnect.')
      } finally {
        setLoading(false)
      }
    })()
  }, [authorizationId, supabaseUrl])

  const decide = useCallback(async (action: 'approve' | 'deny') => {
    if (!authorizationId || !supabaseUrl) return
    setBusy(action)
    try {
      const supabase = createClient()
      const redirectUrl = await decideConsentRequest(supabase.auth.oauth, authorizationId, action)
      window.location.assign(redirectUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${action} could not be completed. Return to OpenAI and reconnect.`)
    } finally {
      setBusy(null)
    }
  }, [authorizationId, supabaseUrl])

  const requestedName = authz?.client?.name ?? (authz as any)?.client_name ?? (authz as any)?.client?.client_name
  const clientName = requestedName?.trim() || (authz?.client?.id ? `Application ${authz.client.id}` : 'Unknown application')
  const scope = authz?.scope ?? 'read/write access to your AQUA workspace'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-8">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {authz ? `Authorize ${clientName}?` : 'Connect to AQUA'}
      </h1>
      {loading && !error && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300" role="status">Loading authorization request…</p>}
      {authz && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {clientName} is asking for {scope}. Approving lets it read and write your hosted
        AQUA workspace. Human approvals still require your approval secret.
      </p>}
      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      {authz && !error && (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide('approve')}
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide('deny')}
            className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200"
          >
            {busy === 'deny' ? 'Denying…' : 'Deny'}
          </button>
        </div>
      )}
    </main>
  )
}
