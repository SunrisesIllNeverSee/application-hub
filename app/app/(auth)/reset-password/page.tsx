'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sanitizeNextPath } from '@/lib/safe-redirect'

const MIN_LENGTH = 8

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

// AUTH-03: landing page for password-recovery links. /auth/callback exchanges
// the recovery code for a session and redirects here (?next=/reset-password).
function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = sanitizeNextPath(searchParams.get('next'))
  // undefined = still checking, false = no session
  const [hasSession, setHasSession] = useState<boolean | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setHasSession(!!data.session)
      })
      .catch(() => {
        if (!cancelled) setHasSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push(nextPath ?? '/dash')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-white">Application Hub</h1>
          <p className="mt-1 text-sm text-neutral-400">Choose a new password</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          {hasSession === undefined ? (
            <p className="text-sm text-neutral-400 text-center">Checking your reset link…</p>
          ) : hasSession === false ? (
            <div className="text-center py-2">
              <h2 className="text-lg font-semibold text-white mb-2">This reset link is not valid</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                The link may have expired or already been used. Request a new one from the sign-in page.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="label text-neutral-300">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  className="input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="label text-neutral-300">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat the new password"
                  className="input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus:ring-brand-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full btn-primary py-2.5"
              >
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
