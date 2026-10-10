// LF-13 — Local-first capture boundary helpers.
//
// Pure functions only. No chrome.*, no fetch, no DOM — so the same module is
// importable from the MV3 module service worker (background.js) and from the
// Node test harness in test/local-first.test.mjs.
//
// Contract: aquarnd LF-Architecture-Contract.md — answer bodies + capture
// content are vault-private; they may not reach ANY server (hub or LLM)
// without an explicit, recorded, per-call user consent.

export const ALLOWED_HUB_HOSTS = ['aquaidp.xyz']

// Localhost dev origins (agent, local hub dev server).
const LOCALHOST_HOST_RE = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/

export function isLocalhostUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && LOCALHOST_HOST_RE.test(url.hostname)
  } catch {
    return false
  }
}

export function isAllowedHubUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (isLocalhostUrl(rawUrl)) return true
    if (url.protocol !== 'https:') return false
    return ALLOWED_HUB_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

// Origin gate for externally-connectable messages (onMessageExternal) and for
// any future window.postMessage bridge. Only aquaidp.xyz (+ subdomains) and
// localhost dev senders are accepted.
export function isAllowedSenderOrigin(originLike) {
  if (!originLike || typeof originLike !== 'string') return false
  if (isLocalhostUrl(originLike)) return true
  try {
    const url = new URL(originLike)
    if (url.protocol === 'chrome-extension:' || url.protocol === 'safari-web-extension:') {
      return true // our own extension pages
    }
    if (url.protocol !== 'https:') return false
    return ALLOWED_HUB_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

export function senderOrigin(sender) {
  return sender?.origin || sender?.url || ''
}

// True when the local-first boundary is engaged. Default ON: any value other
// than explicit `false` keeps the boundary up (fail-closed).
export function localFirstEnabled(settings) {
  return settings?.localFirst !== false
}

// True only when the user has explicitly opted in to syncing the local answer
// bank up to the hosted hub.
export function hubSyncOptedIn(settings) {
  return settings?.syncToHub === true
}

// Strip typed-answer bodies out of a page capture before it leaves the
// device. Keeps structure (labels, selectors, counts) so the hub ingest is
// still useful, but no answer body egresses.
export function stripCaptureAnswerBodies(capture) {
  if (!capture || typeof capture !== 'object') return capture
  const questions = Array.isArray(capture.questions)
    ? capture.questions.map((q) => ({
        fieldId: q.fieldId ?? null,
        label: q.label ?? '',
        value: '',
        selector: q.selector ?? null,
        redacted: Boolean(q.value),
      }))
    : []

  const redactedCount = questions.filter((q) => q.redacted).length
  const content = [
    `# ${capture.title || ''}`,
    '',
    capture.url || '',
    '',
    ...questions.map((q) => `## ${q.label}\n\n[redacted — local-first]`),
    '',
    `_${redactedCount} answer field(s) captured locally; bodies withheld under local-first mode._`,
  ].join('\n').trim()

  return {
    ...capture,
    questions,
    content,
    redactedAnswers: redactedCount,
  }
}

// Decide whether a BYOK generate call may proceed. Under local-first the
// caller must present an explicit per-call confirm flag; without it the call
// is refused before any provider request is built.
export function evaluateGenerateConsent({ settings, confirmEgress }) {
  if (!localFirstEnabled(settings)) {
    return { allowed: true, reason: 'local_first_off' }
  }
  if (confirmEgress === true) {
    return { allowed: true, reason: 'user_confirmed' }
  }
  return { allowed: false, reason: 'consent_required' }
}

// Build an honest egress receipt recorded into extension storage.
export function buildConsentRecord({ provider, model, kind, questionText }) {
  return {
    ts: new Date().toISOString(),
    kind: kind || 'generate',
    provider: provider || 'unknown',
    model: model || 'unknown',
    questionPreview: typeof questionText === 'string' ? questionText.slice(0, 80) : '',
  }
}

// Declared egress table — the model/provider actually used per BYOK provider,
// so receipts are honest rather than guessed at call sites.
export const BYOK_EGRESS = {
  anthropic: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
}
