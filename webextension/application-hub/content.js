/**
 * content.js — Injected into all pages
 *
 * Responsibilities:
 * - Detect form fields on any application page
 * - Send fields to background → side panel (Chrome/Firefox native, Safari iframe)
 * - Fill fields on command from side panel
 * - Export page as markdown
 * - Capture answers back to the answer bank on blur
 */

// ── Safari / fallback: injected iframe panel ──────────────────────────────────
// Chrome and Firefox use their native side panel APIs.
// Safari has neither, so we inject the panel as a fixed iframe in the page.

const isSafari = typeof safari !== 'undefined'
let injectedPanel = null

function openInjectedPanel() {
  if (injectedPanel) {
    injectedPanel.style.display = 'flex'
    return
  }
  const wrap = document.createElement('div')
  wrap.id = 'apphub-panel-wrap'
  Object.assign(wrap.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '360px',
    height: '100vh',
    zIndex: '2147483645',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    border: 'none',
  })

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '10px',
    left: '-32px',
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: '6px 0 0 6px',
    padding: '6px 8px',
    cursor: 'pointer',
    fontSize: '13px',
    zIndex: '1',
  })
  closeBtn.addEventListener('click', () => { wrap.style.display = 'none' })

  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('sidepanel.html')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#fff',
  })

  wrap.appendChild(closeBtn)
  wrap.appendChild(iframe)
  document.body.appendChild(wrap)
  injectedPanel = wrap
}

// Expose so background can trigger it
window.__apphubOpenPanel = openInjectedPanel

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

// ── Fill commands from side panel ─────────────────────────────────────────────

function fillFieldById(fieldId, text) {
  const field = detectedFields.find(f => f.fieldId === fieldId)
  if (!field?.element) return
  const proto = field.element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(field.element, text)
  else field.element.value = text
  field.element.dispatchEvent(new Event('input', { bubbles: true }))
  field.element.dispatchEvent(new Event('change', { bubbles: true }))
  field.element.focus()
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILL_FIELD') {
    fillFieldById(msg.fieldId, msg.text)
  }
  if (msg.type === 'FILL_FIELDS') {
    msg.fills.forEach(({ fieldId, text }) => fillFieldById(fieldId, text))
  }
  if (msg.type === 'MATCHES_READY') {
    // Background has sent back matched answers — show the quick overlay
    const overlay = buildOverlay(msg.matches, detectedFields)
    if (overlay) document.body.appendChild(overlay)
  }
  if (msg.type === 'GET_FIELDS') {
    scan()
  }

  if (msg.type === 'OPEN_INJECTED_PANEL') {
    openInjectedPanel()
  }
  if (msg.type === 'EXPORT_MD') {
    const data = scrapePage()
    const md = buildMarkdown(data)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }
})

// ── Page scraper (used by EXPORT_MD and popup capture) ────────────────────────

function scrapePage() {
  const url = window.location.href
  const title = document.title || window.location.hostname
  const rawText = document.body.innerText
  const metaDesc = document.querySelector('meta[name="description"]')?.content
    || document.querySelector('meta[property="og:description"]')?.content || null
  const fieldValues = []

  document.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], textarea').forEach(el => {
    const val = el.value.trim()
    if (!val) return
    let label = ''
    if (el.id) label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || ''
    if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
    if (!label) {
      let p = el.parentElement
      for (let i = 0; i < 5 && p; i++) {
        const h = p.querySelector('label, h1, h2, h3, h4, p, span')
        if (h && h !== el && h.textContent.trim().length > 3) {
          label = h.textContent.trim().replace(/\s+/g, ' ')
          break
        }
        p = p.parentElement
      }
    }
    fieldValues.push({ label: label || '(unlabeled)', value: val })
  })

  document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(el => {
    const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()
      || el.getAttribute('aria-label') || el.value
    fieldValues.push({ label: '(selected)', value: label })
  })

  return { url, title, rawText, metaDesc, fieldValues }
}

function buildMarkdown({ url, title, rawText, metaDesc, fieldValues }) {
  const date = new Date().toISOString().slice(0, 10)
  const lines = [`# ${title}`, '', `**URL:** ${url}`, `**Captured:** ${date}`]
  if (metaDesc) lines.push(`**Description:** ${metaDesc}`)
  if (fieldValues?.length) {
    lines.push('', '## Your Answers', '')
    fieldValues.forEach(({ label, value }) => {
      lines.push(`**${label}**`, value, '')
    })
  }
  lines.push('', '## Raw Page Text', '', rawText.trim())
  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Keep detected fields accessible for fill commands
let detectedFields = []

function scan() {
  // Try portal-specific detector first, fall back to generic
  const hostname = window.location.hostname.replace('www.', '')
  const detector = Object.entries(DETECTORS).find(([key]) => hostname.includes(key))
  const fields = detector ? detector[1]() : detectGeneric()

  if (fields.length === 0) return

  detectedFields = fields
  attachCaptureListeners(fields)

  // Send to background → routes to side panel + returns overlay matches
  chrome.runtime.sendMessage({
    type: 'FIELDS_DETECTED_FROM_CONTENT',
    pageTitle: document.title,
    fields: fields.map(f => ({ fieldId: f.fieldId, questionText: f.questionText })),
  })
}

if (document.readyState === 'complete') {
  scan()
} else {
  window.addEventListener('load', scan)
}
