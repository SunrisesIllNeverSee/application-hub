'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup' | 'magic' | 'magic_sent'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function resetForm() {
    setError(null)
    setInfo(null)
    setPassword('')
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      router.push('/today')
      router.refresh()
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setInfo('Account created — check your email to confirm, then sign in.')
      setMode('signin')
      setPassword('')
    }
  }

  async function handleGitHub() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMode('magic_sent')
    }
  }

  const isPasswordMode = mode === 'signin' || mode === 'signup'

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Application Hub</h1>
          <p className="mt-1 text-sm text-neutral-400">
            The smartest way to apply to accelerators and grants
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">

          {/* Magic link sent state */}
          {mode === 'magic_sent' ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Check your inbox</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                We sent a magic link to{' '}
                <span className="text-neutral-200 font-medium">{email}</span>.
                Click it to sign in.
              </p>
              <button
                onClick={() => { setMode('signin'); resetForm() }}
                className="mt-6 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Sign in / Sign up tab toggle */}
              <div className="flex rounded-lg bg-neutral-800 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); resetForm() }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === 'signin'
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-300'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); resetForm() }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === 'signup'
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-300'
                  }`}
                >
                  Create account
                </button>
              </div>

              {/* Info banner (e.g. after signup) */}
              {info && (
                <p className="mb-4 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  {info}
                </p>
              )}

              {/* GitHub OAuth */}
              {isPasswordMode && (
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={handleGitHub}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    Continue with GitHub
                  </button>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex-1 h-px bg-neutral-800" />
                    <span className="text-xs text-neutral-600">or</span>
                    <div className="flex-1 h-px bg-neutral-800" />
                  </div>
                </div>
              )}

              {/* Email + password form */}
              {isPasswordMode && (
                <form onSubmit={mode === 'signin' ? handlePasswordSignIn : handleSignUp} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="label text-neutral-300">Email address</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com"
                      className="input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="label text-neutral-300">Password</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
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
                    disabled={loading || !email.trim() || !password}
                    className="w-full btn-primary py-2.5"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
                      </span>
                    ) : (
                      mode === 'signup' ? 'Create account' : 'Sign in'
                    )}
                  </button>

                  {/* Magic link fallback */}
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => { setMode('magic'); resetForm() }}
                      className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                    >
                      {mode === 'signin' ? 'Forgot password? Use a magic link instead' : 'Prefer a magic link instead?'}
                    </button>
                  </div>
                </form>
              )}

              {/* Magic link mode */}
              {mode === 'magic' && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="mb-2">
                    <h2 className="text-base font-semibold text-white">Sign in with magic link</h2>
                    <p className="mt-1 text-sm text-neutral-400">We&apos;ll email you a one-click sign-in link.</p>
                  </div>
                  <div>
                    <label htmlFor="email-magic" className="label text-neutral-300">Email address</label>
                    <input
                      id="email-magic"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com"
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
                    disabled={loading || !email.trim()}
                    className="w-full btn-primary py-2.5"
                  >
                    {loading ? 'Sending…' : 'Send magic link'}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => { setMode('signin'); resetForm() }}
                      className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                    >
                      ← Back to sign in with password
                    </button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-xs text-neutral-500 text-center">
                By continuing you agree to our{' '}
                <a href="#" className="text-neutral-400 hover:text-neutral-300 underline">Terms</a>
                {' '}and{' '}
                <a href="#" className="text-neutral-400 hover:text-neutral-300 underline">Privacy Policy</a>.
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-600">
          Built by{' '}
          <a href="https://ellocello.com" className="text-neutral-500 hover:text-neutral-400 transition-colors"
            target="_blank" rel="noopener noreferrer">
            Ello Cello LLC
          </a>
        </p>
      </div>
    </div>
  )
}
