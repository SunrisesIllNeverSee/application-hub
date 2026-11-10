// Pure helper for /api/import/application: turn a Messages API reply into text or a specific error.
// No imports, so plain-node tests can load it.

export type ImportReply = {
  stop_reason?: string | null
  content: Array<{ type: string; text?: string }>
}

export type ImportTextResult = { ok: true; text: string } | { ok: false; error: string }

export function importReplyText(reply: ImportReply): ImportTextResult {
  if (reply.stop_reason === 'max_tokens') {
    return { ok: false, error: 'The AI response was cut off before it finished. Try importing a shorter application.' }
  }
  if (reply.stop_reason === 'refusal') {
    return { ok: false, error: 'The AI provider declined to process this text.' }
  }
  // Haiku 5.5 may lead with a thinking block: find the text block by type, not position.
  const block = reply.content.find((b) => b.type === 'text' && typeof b.text === 'string')
  if (!block || !block.text || !block.text.trim()) {
    return { ok: false, error: 'The AI response contained no text. Please try again.' }
  }
  return { ok: true, text: block.text.trim() }
}
