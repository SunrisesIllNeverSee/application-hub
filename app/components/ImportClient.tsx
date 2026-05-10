'use client'

import { useState } from 'react'
import { ThemeTag } from '@/components/ThemeTag'
import { truncate } from '@/lib/utils'
import type { QuestionTheme } from '@/lib/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedPair {
  question: string
  answer: string
  theme: string
  archived_question_id: string | null
}

type ActiveTab = 'application' | 'program'

// ─── Past Applications Tab ─────────────────────────────────────────────────

function PastApplicationTab() {
  const [text, setText] = useState('')
  const [programName, setProgramName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pairs, setPairs] = useState<ExtractedPair[]>([])
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [savedCount, setSavedCount] = useState<number | null>(null)

  const charCount = text.length
  const charMin = 50
  const charMax = 15000

  function togglePair(index: number) {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  function selectAll(value: boolean) {
    const next: Record<number, boolean> = {}
    pairs.forEach((p, i) => {
      if (p.archived_question_id) next[i] = value
    })
    setChecked(next)
  }

  async function handleExtract() {
    if (charCount < charMin) {
      setError(`Paste at least ${charMin} characters of your application.`)
      return
    }
    if (charCount > charMax) {
      setError(`Text must be under ${charMax.toLocaleString()} characters.`)
      return
    }

    setLoading(true)
    setError(null)
    setPairs([])
    setChecked({})
    setSavedCount(null)
    setSessionId(null)

    try {
      const res = await fetch('/api/import/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, program_name: programName || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong extracting answers.')
        return
      }

      setSessionId(data.session_id)
      setPairs(data.pairs ?? [])

      // Pre-check all matched pairs
      const initial: Record<number, boolean> = {}
      ;(data.pairs ?? []).forEach((p: ExtractedPair, i: number) => {
        if (p.archived_question_id) initial[i] = true
      })
      setChecked(initial)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!sessionId || pairs.length === 0) return

    const selectedPairs = pairs
      .filter((p, i) => checked[i] && p.archived_question_id)
      .map((p) => ({
        archived_question_id: p.archived_question_id as string,
        answer: p.answer,
        confidence: 'draft',
      }))

    if (selectedPairs.length === 0) {
      setError('Select at least one matched answer to save.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/import/application/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, pairs: selectedPairs }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to save answers.')
        return
      }

      setSavedCount(data.saved)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const matched = pairs.filter((p) => p.archived_question_id)
  const unmatched = pairs.filter((p) => !p.archived_question_id)
  const selectedCount = matched.filter((_, i) => {
    const globalIdx = pairs.indexOf(matched[i])
    return checked[globalIdx]
  }).length

  // Re-compute selected count properly
  const realSelectedCount = pairs.filter((p, i) => checked[i] && p.archived_question_id).length

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5">
          Paste an old application you submitted anywhere — YC, Techstars, a grant, anything.
          We&apos;ll extract your answers into your Answer Bank.
        </p>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="app-text">
              Application text
            </label>
            <textarea
              id="app-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="input resize-none font-mono text-xs leading-relaxed"
              placeholder="Paste your application here — questions and answers together"
              disabled={loading}
            />
            <p
              className={[
                'mt-1 text-xs',
                charCount > charMax
                  ? 'text-red-600 dark:text-red-400'
                  : charCount > 0 && charCount < charMin
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-neutral-400 dark:text-neutral-600',
              ].join(' ')}
            >
              {charCount.toLocaleString()} / {charMax.toLocaleString()} characters
              {charCount > 0 && charCount < charMin && ` (minimum ${charMin})`}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="program-name">
              Which program was this for? <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="program-name"
              type="text"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="input"
              placeholder="e.g. Y Combinator S25, Techstars NYC, Mozilla Grant"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            onClick={handleExtract}
            disabled={loading || charCount < charMin || charCount > charMax}
            className="btn-primary w-full sm:w-auto"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Reading your application…
              </span>
            ) : (
              'Extract Answers'
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {pairs.length > 0 && savedCount === null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              Extracted {pairs.length} question{pairs.length !== 1 ? 's' : ''}
            </h3>
            {matched.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => selectAll(true)}
                  className="text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Select all
                </button>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <button
                  onClick={() => selectAll(false)}
                  className="text-neutral-500 dark:text-neutral-400 hover:underline"
                >
                  Deselect all
                </button>
              </div>
            )}
          </div>

          {/* Matched pairs */}
          {matched.length > 0 && (
            <div className="space-y-3">
              {pairs.map((pair, i) => {
                if (!pair.archived_question_id) return null
                return (
                  <label
                    key={i}
                    className={[
                      'card p-4 flex gap-4 cursor-pointer transition-colors',
                      checked[i]
                        ? 'ring-2 ring-brand-500 dark:ring-brand-400'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={() => togglePair(i)}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white leading-snug mb-1">
                        {pair.question}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2">
                        {truncate(pair.answer, 200)}
                      </p>
                      <ThemeTag theme={pair.theme as QuestionTheme} size="sm" />
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {/* Unmatched pairs */}
          {unmatched.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                Not matched to archived questions — copy manually if needed
              </p>
              <div className="space-y-3 opacity-60">
                {pairs.map((pair, i) => {
                  if (pair.archived_question_id) return null
                  return (
                    <div key={i} className="card p-4 border-dashed">
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-snug mb-1">
                        {pair.question}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2">
                        {truncate(pair.answer, 200)}
                      </p>
                      <ThemeTag theme={pair.theme as QuestionTheme} size="sm" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {matched.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || realSelectedCount === 0}
              className="btn-primary w-full sm:w-auto"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                `Save ${realSelectedCount} answer${realSelectedCount !== 1 ? 's' : ''} to Answer Bank`
              )}
            </button>
          )}

          {matched.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
              None of the extracted questions matched our archived question bank.
              The answers above can be copied manually.
            </p>
          )}
        </div>
      )}

      {/* Success state */}
      {savedCount !== null && (
        <div className="card p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-600 dark:text-green-400">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            {savedCount} answer{savedCount !== 1 ? 's' : ''} saved to your Answer Bank
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            You&apos;ll find them in the Answer Bank tab under their respective themes.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="/profile/answers" className="btn-primary text-sm">
              View Answer Bank
            </a>
            <button
              onClick={() => {
                setText('')
                setProgramName('')
                setPairs([])
                setChecked({})
                setSavedCount(null)
                setSessionId(null)
                setError(null)
              }}
              className="btn-secondary text-sm"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Submit Program Tab ────────────────────────────────────────────────────

function SubmitProgramTab() {
  const [url, setUrl] = useState('')
  const [questionsText, setQuestionsText] = useState('')
  const [programName, setProgramName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function isValidUrl(str: string): boolean {
    try {
      const u = new URL(str)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function handleSubmit() {
    if (!url.trim()) {
      setError('Application page URL is required.')
      return
    }
    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid http or https URL.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/import/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          program_name: programName.trim() || undefined,
          questions_text: questionsText.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="card p-8 text-center max-w-lg">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-brand-600 dark:text-brand-400">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
          Submitted — we&apos;ll review and add it within 48 hours.
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
          Once added, the program will appear in the Hub and its questions will be available for matching.
        </p>
        <button
          onClick={() => {
            setUrl('')
            setQuestionsText('')
            setProgramName('')
            setSubmitted(false)
          }}
          className="btn-secondary text-sm"
        >
          Submit Another
        </button>
      </div>
    )
  }

  return (
    <div className="card p-6 max-w-lg">
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5">
        Know a program we&apos;re missing? Submit its application page and we&apos;ll extract
        the questions and add it to the Hub.
      </p>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="program-url">
            Application page URL
          </label>
          <input
            id="program-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
            placeholder="https://www.ycombinator.com/apply"
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="questions-text">
            Paste the questions directly{' '}
            <span className="font-normal text-neutral-400">(optional — helps if the page requires login)</span>
          </label>
          <textarea
            id="questions-text"
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            rows={6}
            className="input resize-none"
            placeholder="Paste the application questions here if the page is behind a login…"
            disabled={loading}
          />
        </div>

        <div>
          <label className="label" htmlFor="submit-program-name">
            Program name{' '}
            <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            id="submit-program-name"
            type="text"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="input"
            placeholder="e.g. Y Combinator W26"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting…
            </span>
          ) : (
            'Submit for Review'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ImportClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('application')

  return (
    <div>
      {/* Sub-tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('application')}
          className={[
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'application'
              ? 'border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600',
          ].join(' ')}
        >
          Past Applications
        </button>
        <button
          onClick={() => setActiveTab('program')}
          className={[
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'program'
              ? 'border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600',
          ].join(' ')}
        >
          Submit a Program
        </button>
      </div>

      {activeTab === 'application' ? <PastApplicationTab /> : <SubmitProgramTab />}
    </div>
  )
}
