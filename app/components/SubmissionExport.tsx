'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface QuestionItem {
  asked_as: string
  word_limit: number | null
  char_limit: number | null
  section: string | null
  order_index: number
  is_required: boolean
  archived_question?: { theme?: string | null } | null
}

interface AnswerItem {
  answer_content: string
  word_count: number | null
}

interface SubmissionExportProps {
  programName: string
  programUrl?: string | null
  questions: { item: QuestionItem; answer: AnswerItem | null; archived_question_id: string }[]
}

type Mode = 'plain' | 'markdown' | 'llm'

export function SubmissionExport({ programName, programUrl, questions }: SubmissionExportProps) {
  const [mode, setMode] = useState<Mode>('plain')
  const [copied, setCopied] = useState(false)

  const text = useMemo(() => buildText({ programName, programUrl, questions, mode }), [
    programName, programUrl, questions, mode,
  ])

  const stats = useMemo(() => {
    const total = questions.length
    const answered = questions.filter((q) => (q.answer?.answer_content ?? '').trim().length > 0).length
    const required = questions.filter((q) => q.item.is_required).length
    const requiredAnswered = questions.filter(
      (q) => q.item.is_required && (q.answer?.answer_content ?? '').trim().length > 0
    ).length
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
    const charCount = text.length
    return { total, answered, required, requiredAnswered, wordCount, charCount }
  }, [questions, text])

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail in non-secure context; users can still select+copy.
    }
  }

  function downloadMarkdown() {
    const filename = `${slugify(programName)}-submission.md`
    const md = buildText({ programName, programUrl, questions, mode: 'markdown' })
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isEmpty = stats.answered === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Submission · {programName}
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
            {stats.answered}/{stats.total} answered · {stats.requiredAnswered}/{stats.required} required ·{' '}
            {stats.wordCount} words · {stats.charCount} chars
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={downloadMarkdown}
            disabled={isEmpty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download as Markdown file"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download .md
          </button>
          <button
            onClick={copyAll}
            disabled={isEmpty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copy all
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-5 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1 flex-shrink-0">
        {(['plain', 'markdown', 'llm'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              mode === m
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            )}
            title={modeHint(m)}
          >
            {modeLabel(m)}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-neutral-400 dark:text-neutral-500">{modeHint(mode)}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center px-8 py-12 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                No answers yet
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-500">
                Answer questions in the Editor tab. They&apos;ll appear here compiled and ready to paste back into the application portal.
              </p>
            </div>
          </div>
        ) : (
          <pre className="px-6 py-5 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap font-mono">
            {text}
          </pre>
        )}
      </div>
    </div>
  )
}

function modeLabel(m: Mode): string {
  if (m === 'plain') return 'Plain'
  if (m === 'markdown') return 'Markdown'
  return 'LLM prompt'
}

function modeHint(m: Mode): string {
  if (m === 'plain') return 'Q + A pairs, plain text — paste straight into a form'
  if (m === 'markdown') return 'Headings + theme groups — paste into Notion / a doc'
  return 'Structured prompt for refining with Claude / ChatGPT'
}

function buildText({
  programName,
  programUrl,
  questions,
  mode,
}: {
  programName: string
  programUrl?: string | null
  questions: SubmissionExportProps['questions']
  mode: Mode
}): string {
  const sorted = [...questions].sort((a, b) => a.item.order_index - b.item.order_index)
  const answered = sorted.filter((q) => (q.answer?.answer_content ?? '').trim().length > 0)

  if (mode === 'plain') {
    return answered
      .map(({ item, answer }) => `${item.asked_as}\n\n${(answer?.answer_content ?? '').trim()}`)
      .join('\n\n———\n\n')
  }

  if (mode === 'markdown') {
    const lines: string[] = [`# ${programName}`, '']
    if (programUrl) lines.push(`_${programUrl}_`, '')
    // Group by section if present, else by theme
    const groups = new Map<string, typeof answered>()
    for (const q of answered) {
      const key = q.item.section?.trim() || q.item.archived_question?.theme || 'Application'
      const existing = groups.get(key) ?? []
      existing.push(q)
      groups.set(key, existing)
    }
    for (const [groupName, items] of groups) {
      lines.push(`## ${groupName}`, '')
      for (const { item, answer } of items) {
        lines.push(`### ${item.asked_as}`)
        if (item.word_limit) lines.push(`_${item.word_limit} word limit_`)
        else if (item.char_limit) lines.push(`_${item.char_limit} character limit_`)
        lines.push('', (answer?.answer_content ?? '').trim(), '')
      }
    }
    return lines.join('\n').trim()
  }

  // LLM prompt
  const lines: string[] = [
    `You are reviewing my draft application to ${programName}.`,
    programUrl ? `Program URL: ${programUrl}` : '',
    '',
    'For each question + answer pair below, evaluate:',
    '1. Does the answer fully address the question?',
    '2. Is the tone appropriate for this program?',
    '3. Are there any weak spots or factual gaps?',
    '4. Is the word/character limit respected?',
    '',
    'Then suggest a tightened, stronger version of any answer that needs work.',
    '',
    '---',
    '',
  ]
  answered.forEach(({ item, answer }, i) => {
    lines.push(`### Q${i + 1}: ${item.asked_as}`)
    if (item.word_limit) lines.push(`Limit: ${item.word_limit} words`)
    else if (item.char_limit) lines.push(`Limit: ${item.char_limit} chars`)
    lines.push('', `**My answer:**`, (answer?.answer_content ?? '').trim(), '', '---', '')
  })
  return lines.filter((l) => l !== undefined).join('\n').trim()
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'submission'
}
