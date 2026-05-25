'use client'

import { useRef, useState } from 'react'

type HighlightEditorProps = {
  initialContent: string
  context?: string
  onChange?: (content: string) => void
}

export function HighlightEditor({ initialContent, context = '', onChange }: HighlightEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState(initialContent)
  const [selection, setSelection] = useState('')
  const [busy, setBusy] = useState(false)

  function captureSelection() {
    const selected = window.getSelection()?.toString() ?? ''
    setSelection(selected.trim())
  }

  async function refineSelection() {
    if (!selection) return
    setBusy(true)
    try {
      const resp = await fetch('/api/hub/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText: selection, context: context || content }),
      })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error ?? 'Refine failed')
      const next = content.replace(selection, payload.refinedText)
      setContent(next)
      onChange?.(next)
      if (editorRef.current) editorRef.current.innerText = next
      setSelection('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-neutral-100">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        onInput={(event) => {
          const next = event.currentTarget.innerText
          setContent(next)
          onChange?.(next)
        }}
        className="min-h-48 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm leading-6 outline-none focus:border-brand-600"
      >
        {content}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="truncate text-xs text-neutral-500">{selection ? `Selected: ${selection}` : 'Highlight text to refine only that commitment.'}</p>
        <button className="btn-primary" disabled={!selection || busy} onClick={refineSelection}>
          {busy ? 'Refining...' : 'Refine Highlighted Text Only'}
        </button>
      </div>
    </div>
  )
}
