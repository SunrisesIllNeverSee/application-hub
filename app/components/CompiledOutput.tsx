'use client'

import { useState } from 'react'

interface CompiledOutputProps {
  question: string
  answer: string
  wordLimit?: number | null
  charLimit?: number | null
}

/**
 * Right-panel "Compiled Output" view.
 * Shows the answer formatted for copy-paste, with a one-click copy button.
 * Lightweight inline markdown rendering — paragraphs, bold, italic, bullets.
 * Heavier markdown can be swapped in (react-markdown) later without changing the API.
 */
export function CompiledOutput({ question, answer, wordLimit, charLimit }: CompiledOutputProps) {
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in non-secure contexts — silent fallback to selection.
    }
  }

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const charCount = answer.length

  if (!answer.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8 py-12">
        <div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-3 text-neutral-400 dark:text-neutral-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            No answer yet
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 max-w-xs">
            Write your answer in the Editor tab. The compiled output will appear here, ready to paste into the application portal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compiled header */}
      <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Compiled output
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'char' : 'chars'}
            {wordLimit ? ` · limit ${wordLimit} words` : ''}
            {charLimit ? ` · limit ${charLimit} chars` : ''}
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors flex-shrink-0"
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
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Compiled body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-500 mb-2 italic">
            {question}
          </p>
          <div className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
            {renderInlineMarkdown(answer)}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Tiny inline markdown renderer — paragraphs, bold (**), italic (*), inline code (`).
 * Bulleted lines (lines starting with "- " or "* ") get bullet rendering.
 * Good enough for application answers — swap in react-markdown later if needed.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((block, i) => {
    const lines = block.split('\n')
    const isList = lines.every((l) => /^[-*]\s+/.test(l))
    if (isList) {
      return (
        <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
          {lines.map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      )
    }
    return (
      <p key={i} className="mb-3 last:mb-0">
        {renderInline(block)}
      </p>
    )
  })
}

function renderInline(text: string): React.ReactNode {
  // Splits on bold/italic/code markers and renders inline.
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const m = match[0]
    if (m.startsWith('**')) {
      parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>)
    } else if (m.startsWith('*')) {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>)
    } else if (m.startsWith('`')) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[0.9em] font-mono">
          {m.slice(1, -1)}
        </code>
      )
    }
    lastIndex = match.index + m.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
