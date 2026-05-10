'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
              aria-hidden="true"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Application Hub</h1>
          <p className="mt-1 text-sm text-neutral-400">
            The smartest way to apply to accelerators and grants
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-50 dark:bg-success-500/10 mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-success-500"
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Check your inbox</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                We sent a magic link to{' '}
                <span className="text-neutral-200 font-medium">{email}</span>. Click it to sign in
                — no password needed.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setEmail('')
                }}
                className="mt-6 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">Sign in</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Enter your email and we&apos;ll send you a magic link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label text-neutral-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className="input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500
                      focus:ring-brand-500"
                  />
                </div>

                {error && (
                  <p className="text-sm text-danger-500 bg-danger-50/10 border border-danger-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full btn-primary py-2.5"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Sending link…
                    </span>
                  ) : (
                    'Send magic link'
                  )}
                </button>
              </form>

              <p className="mt-6 text-xs text-neutral-500 text-center">
                By signing in you agree to our{' '}
                <a href="#" className="text-neutral-400 hover:text-neutral-300 underline">
                  Terms
                </a>{' '}
                and{' '}
                <a href="#" className="text-neutral-400 hover:text-neutral-300 underline">
                  Privacy Policy
                </a>
                .
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-600">
          Built by{' '}
          <a
            href="https://ellocello.com"
            className="text-neutral-500 hover:text-neutral-400 transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Ello Cello LLC
          </a>
        </p>
      </div>
    </div>
  )
}
