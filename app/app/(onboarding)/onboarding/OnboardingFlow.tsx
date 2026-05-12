'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ArchivedQuestion } from '@/lib/database.types'
import { ThemeTag } from '@/components/ThemeTag'
import { cn } from '@/lib/utils'

type StarterQuestion = Pick<
  ArchivedQuestion,
  'id' | 'text' | 'theme' | 'significance_score' | 'asked_by_count' | 'typical_word_limit'
>

interface OnboardingFlowProps {
  questions: StarterQuestion[]
}

type Step = 'choose' | 'starter' | 'upload' | 'review'

export function OnboardingFlow({ questions }: OnboardingFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [upload, setUpload] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reviewSummary, setReviewSummary] = useState<{ identity: string; themesCovered: number; topThemes: string[]; answersCount: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  function setAnswer(id: string, text: string) {
    setAnswers((prev) => ({ ...prev, [id]: text }))
  }

  const completedStarter = questions.filter((q) => (answers[q.id] ?? '').trim().length > 30).length
  const minRequired = Math.min(5, questions.length)

  async function submit(mode: 'starter' | 'upload') {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, answers, upload }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? 'Could not complete onboarding. Try again.')
          return
        }
        const body = await res.json()
        setReviewSummary(body.summary)
        setStep('review')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error. Try again.')
      }
    })
  }

  if (step === 'review' && reviewSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4">
              <span className="text-white text-xl font-bold tracking-tighter">AQ</span>
            </div>
            <h1 className="text-3xl font-semibold text-neutral-900 dark:text-white mb-2">
              Based on your answers, here&apos;s what we found
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Your AQUAscore baseline is in. The product is yours from here.
            </p>
          </div>

          <div className="card p-6 mb-6 space-y-4">
            <Row label="Detected identity" value={reviewSummary.identity} />
            <Row label="Answers captured" value={`${reviewSummary.answersCount}`} />
            <Row label="Themes covered" value={`${reviewSummary.themesCovered} of 12`} />
            {reviewSummary.topThemes.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Strongest themes</p>
                <div className="flex flex-wrap gap-2">
                  {reviewSummary.topThemes.map((t) => (
                    <ThemeTag key={t} theme={t} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/dash')}
            className="w-full px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            Enter AQUA →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4">
              <span className="text-white text-xl font-bold tracking-tighter">AQ</span>
            </div>
            <h1 className="text-3xl font-semibold text-neutral-900 dark:text-white mb-2">
              Welcome to AQUA
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              Applications. Questions. Answers. Pick a way to start — your answers seed the system and the product opens up around them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => setStep('starter')}
              className="card p-6 text-left hover:border-brand-400 dark:hover:border-brand-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-4 text-brand-600 dark:text-brand-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                Start with our questions
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Answer {minRequired}–{questions.length} high-significance questions pulled from real applications. Builds your AQUAscore baseline.
              </p>
            </button>

            <button
              onClick={() => setStep('upload')}
              className="card p-6 text-left hover:border-brand-400 dark:hover:border-brand-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-4 text-brand-600 dark:text-brand-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                Bring an application you&apos;re working on
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Paste the application text. We&apos;ll capture your starting answers and you can refine them in the app.
              </p>
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-600">
            We hide the rest of the product on purpose — fewer empty drawers, more meaningful first session.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'starter') {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => setStep('choose')}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors mb-3 inline-flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
              Your starter application
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Answer at least {minRequired} questions. {completedStarter} of {questions.length} answered so far.
            </p>
            <div className="mt-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  completedStarter >= minRequired ? 'bg-success-500' : 'bg-brand-500'
                )}
                style={{ width: `${Math.min(100, (completedStarter / questions.length) * 100)}%` }}
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-5">
            {questions.map((q, i) => {
              const answer = answers[q.id] ?? ''
              const ready = answer.trim().length > 30
              return (
                <div key={q.id} className="card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[11px] font-semibold text-neutral-500">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <ThemeTag theme={q.theme} />
                        {ready && (
                          <span className="text-[10px] text-success-600 dark:text-success-400 font-medium uppercase tracking-wider">
                            ✓ Captured
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white leading-relaxed">
                        {q.text}
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    rows={4}
                    placeholder="Answer in your own words — we'll save it as a timestamped captured moment."
                    className="w-full px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow resize-y"
                  />
                  {q.typical_word_limit && (
                    <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-600">
                      Typical limit on real applications: ~{q.typical_word_limit} words
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Submit */}
          {error && (
            <p className="mt-6 text-sm text-danger-600 dark:text-danger-500 text-center">{error}</p>
          )}
          <button
            onClick={() => submit('starter')}
            disabled={completedStarter < minRequired || isPending}
            className="mt-8 w-full px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {isPending ? 'Saving...' : completedStarter >= minRequired ? 'Finish — open AQUA' : `Answer ${minRequired - completedStarter} more to continue`}
          </button>
        </div>
      </div>
    )
  }

  // step === 'upload'
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => setStep('choose')}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors mb-3 inline-flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
            Paste an application you&apos;re working on
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Whatever you have — answers in progress, notes, raw text. We&apos;ll capture it as a starting point so the system has something to work with.
          </p>
        </div>

        <textarea
          value={upload}
          onChange={(e) => setUpload(e.target.value)}
          rows={16}
          placeholder="Paste application text here..."
          className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow resize-y"
        />
        <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-600">
          {upload.trim().length} characters · stored as a timestamped captured moment in your Answers
        </p>

        {error && (
          <p className="mt-6 text-sm text-danger-600 dark:text-danger-500 text-center">{error}</p>
        )}
        <button
          onClick={() => submit('upload')}
          disabled={upload.trim().length < 100 || isPending}
          className="mt-6 w-full px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {isPending ? 'Saving...' : upload.trim().length < 100 ? 'Add at least a paragraph to continue' : 'Finish — open AQUA'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-neutral-900 dark:text-white">{value}</span>
    </div>
  )
}
