/**
 * content.js — Injected into supported application portals
 *
 * Responsibilities:
 * - Detect which portal we're on
 * - Scan the DOM for question labels / textarea prompts
 * - Send questions to background.js for matching
 * - Inject matched answers into form fields (Suggest mode: overlay first)
 */

// ── Portal detectors ──────────────────────────────────────────────────────────

const DETECTORS = {
  'ycombinator.com': detectGeneric,
  'apply.techstars.com': detectGeneric,
  'speedrun.a16z.com': detectGeneric,
  '500.co': detectGeneric,
  'solofounders.com': detectGeneric,
  'acceleratorapp.co': detectAcceleratorApp,
}

function detectGeneric() {
  const fields = []
  document.querySelectorAll('textarea, input[type="text"]').forEach((el, i) => {
    const label = getLabel(el)
    if (label && label.length > 10) {
      fields.push({ fieldId: `field-${i}`, questionText: label, element: el })
    }
  })
  return fields
}

function detectAcceleratorApp() {
  const fields = []
  document.querySelectorAll('.form-group').forEach((group, i) => {
    const label = group.querySelector('label')
    const input = group.querySelector('textarea, input[type="text"]')
    if (label && input) {
      fields.push({
        fieldId: `field-${i}`,
        questionText: label.textContent.trim(),
        element: input,
      })
    }
  })
  return fields
}

function getLabel(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label) return label.textContent.trim()
  }
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim()
  const parent = el.closest('label')
  if (parent) return parent.textContent.trim()
  const prev = el.previousElementSibling
  if (prev && ['LABEL', 'P', 'H3', 'H4'].includes(prev.tagName)) {
    return prev.textContent.trim()
  }
  return null
}

// ── Overlay UI (DOM-built — no innerHTML) ─────────────────────────────────────

function buildOverlay(matches, fields) {
  const filled = matches.filter(m => m.matchedAnswer && m.similarity >= 0.72)
  if (filled.length === 0) return null

  // Attach elements back
  filled.forEach(m => {
    const field = fields.find(f => f.fieldId === m.fieldId)
    if (field) m.element = field.element
  })

  const overlay = document.createElement('div')
  overlay.id = 'apphub-overlay'

  const header = document.createElement('div')
  header.className = 'apphub-header'

  const title = document.createElement('span')
  title.textContent = 'Application Hub'

  const fillBtn = document.createElement('button')
  fillBtn.id = 'apphub-fill-all'
  fillBtn.textContent = `Fill ${filled.length} field${filled.length > 1 ? 's' : ''}`
  fillBtn.addEventListener('click', () => {
    filled.forEach(fillField)
    overlay.remove()
  })

  const dismissBtn = document.createElement('button')
  dismissBtn.id = 'apphub-dismiss'
  dismissBtn.textContent = '✕'
  dismissBtn.addEventListener('click', () => overlay.remove())

  header.appendChild(title)
  header.appendChild(fillBtn)
  header.appendChild(dismissBtn)

  const body = document.createElement('div')
  body.className = 'apphub-body'

  filled.forEach(m => {
    const row = document.createElement('div')
    row.className = 'apphub-match'

    const q = document.createElement('div')
    q.className = 'apphub-q'
    q.textContent = m.questionText.slice(0, 80)

    const a = document.createElement('div')
    a.className = 'apphub-a'
    a.textContent = (m.matchedAnswer.answer_content || '').slice(0, 120)

    row.appendChild(q)
    row.appendChild(a)
    body.appendChild(row)
  })

  overlay.appendChild(header)
  overlay.appendChild(body)
  return overlay
}

function fillField(match) {
  const el = match.element
  if (!el) return
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(el, match.matchedAnswer.answer_content || '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    el.value = match.matchedAnswer.answer_content || ''
  }
}

// ── Capture on blur (save new answer version when user finishes typing) ────────

function attachCaptureListeners(fields) {
  fields.forEach(({ questionText, element }) => {
    if (!element || element.dataset.apphubCapture) return
    element.dataset.apphubCapture = '1'

    element.addEventListener('blur', () => {
      const answerText = element.value.trim()
      // Only capture if the user actually wrote something meaningful
      if (answerText.length < 10) return
      chrome.runtime.sendMessage({
        type: 'CAPTURE_ANSWER',
        questionText,
        answerText,
      })
    })
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  const hostname = window.location.hostname.replace('www.', '')
  const detector = Object.entries(DETECTORS).find(([key]) => hostname.includes(key))
  if (!detector) return

  const fields = detector[1]()
  if (fields.length === 0) return

  // Attach capture listeners immediately so answers are saved as you type
  attachCaptureListeners(fields)

  const questions = fields.map(f => ({ fieldId: f.fieldId, questionText: f.questionText }))

  chrome.runtime.sendMessage({ type: 'MATCH_QUESTIONS', questions }, matches => {
    if (!matches || matches.length === 0) return
    const overlay = buildOverlay(matches, fields)
    if (overlay) document.body.appendChild(overlay)
  })
}

if (document.readyState === 'complete') {
  run()
} else {
  window.addEventListener('load', run)
}
