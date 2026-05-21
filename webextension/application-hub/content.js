const isSafari = typeof safari !== 'undefined'
const FIELD_ATTR = 'data-apphub-field-id'

let injectedPanel = null
let detectedFields = []
let detectTimer = null

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

function ensureFieldId(element) {
  let fieldId = element.getAttribute(FIELD_ATTR)
  if (!fieldId) {
    fieldId = `field-${Math.random().toString(36).slice(2, 10)}`
    element.setAttribute(FIELD_ATTR, fieldId)
  }
  return fieldId
}

function selectorFor(element) {
  return `[${FIELD_ATTR}="${ensureFieldId(element)}"]`
}

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

const DETECTORS = {
  'ycombinator.com': detectGeneric,
  'apply.techstars.com': detectGeneric,
  'speedrun.a16z.com': detectGeneric,
  '500.co': detectGeneric,
  'solofounders.com': detectGeneric,
  'acceleratorapp.co': detectAcceleratorApp,
}

function getLabel(element) {
  if (element.labels?.[0]?.innerText) return element.labels[0].innerText.trim()

  const id = element.getAttribute('id')
  if (id) {
    const label = document.querySelector(`label[for="${cssEscape(id)}"]`)
    if (label?.textContent) return label.textContent.trim()
  }

  if (element.getAttribute('aria-label')) return element.getAttribute('aria-label').trim()
  if (element.getAttribute('placeholder')) return element.getAttribute('placeholder').trim()

  const parentLabel = element.closest('label')
  if (parentLabel?.textContent) return parentLabel.textContent.trim()

  const previous = element.previousElementSibling
  if (previous && ['LABEL', 'P', 'H3', 'H4', 'LEGEND'].includes(previous.tagName)) {
    return previous.textContent.trim()
  }

  const containerLabel = element.closest('div, section, fieldset')?.querySelector('label, legend, h1, h2, h3, p')
  return containerLabel?.textContent?.trim() || null
}

function getFieldValue(element) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value || ''
  }
  return element.innerText || ''
}

function setFieldValue(element, value) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')?.set
    if (setter) setter.call(element, value)
    else element.value = value
  } else if (element instanceof HTMLSelectElement) {
    element.value = value
  } else {
    element.textContent = value
  }

  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function detectGeneric() {
  const fields = []
  document.querySelectorAll('textarea, input[type="text"], input:not([type]), select, [contenteditable="true"]').forEach((element) => {
    const label = getLabel(element)
    const rect = element.getBoundingClientRect()
    if (!label || label.length < 4 || rect.width < 80 || rect.height < 20) return

    fields.push({
      fieldId: ensureFieldId(element),
      questionText: label,
      selector: selectorFor(element),
      element,
    })
  })
  return fields
}

function detectAcceleratorApp() {
  const fields = []
  document.querySelectorAll('.form-group').forEach((group) => {
    const label = group.querySelector('label')
    const input = group.querySelector('textarea, input[type="text"], select')
    if (!label || !input) return
    fields.push({
      fieldId: ensureFieldId(input),
      questionText: label.textContent.trim(),
      selector: selectorFor(input),
      element: input,
    })
  })
  return fields
}

function detectFields() {
  const detector = Object.entries(DETECTORS).find(([host]) => location.hostname.includes(host))?.[1]
  const raw = detector ? detector() : detectGeneric()

  const seen = new Set()
  return raw.filter((field) => {
    if (!field.questionText || seen.has(field.fieldId)) return false
    seen.add(field.fieldId)
    return true
  })
}

function fillFieldById(fieldId, text) {
  const field = detectedFields.find((entry) => entry.fieldId === fieldId)
  if (!field?.element) return
  setFieldValue(field.element, text)
  field.element.focus()
}

function buildOverlay(matches) {
  const filled = matches.filter((match) => match.matchedAnswer && match.similarity >= 0.72)
  if (filled.length === 0) return null

  filled.forEach((match) => {
    const field = detectedFields.find((entry) => entry.fieldId === match.fieldId)
    if (field) match.element = field.element
  })

  const overlay = document.createElement('div')
  overlay.id = 'apphub-overlay'

  const header = document.createElement('div')
  header.className = 'apphub-header'

  const title = document.createElement('span')
  title.textContent = 'AQUA'

  const fillBtn = document.createElement('button')
  fillBtn.id = 'apphub-fill-all'
  fillBtn.textContent = `Fill ${filled.length} field${filled.length === 1 ? '' : 's'}`
  fillBtn.addEventListener('click', () => {
    filled.forEach((match) => fillFieldById(match.fieldId, match.matchedAnswer))
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

  filled.forEach((match) => {
    const row = document.createElement('div')
    row.className = 'apphub-match'

    const q = document.createElement('div')
    q.className = 'apphub-q'
    q.textContent = match.questionText.slice(0, 90)

    const a = document.createElement('div')
    a.className = 'apphub-a'
    a.textContent = (match.matchedAnswer || '').slice(0, 140)

    row.appendChild(q)
    row.appendChild(a)
    body.appendChild(row)
  })

  overlay.appendChild(header)
  overlay.appendChild(body)
  return overlay
}

function attachCaptureListeners(fields) {
  fields.forEach(({ questionText, element }) => {
    if (!element || element.dataset.apphubCapture === '1') return
    element.dataset.apphubCapture = '1'

    element.addEventListener('blur', () => {
      const answerText = getFieldValue(element).trim()
      if (answerText.length < 10) return

      chrome.runtime.sendMessage({
        type: 'CAPTURE_SAVE_ANSWER',
        questionText,
        answerText,
      }).catch(() => {})
    })
  })
}

function toMarkdown(pageCapture) {
  const sections = pageCapture.questions
    .map(({ label, value }) => `## ${label}\n\n${value || ''}`)
    .join('\n\n')

  return `# ${pageCapture.title}\n\n${pageCapture.url}\n\n${sections}`.trim()
}

function downloadMarkdown(markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aqua-capture-${Date.now()}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildPageCapture() {
  const questions = detectedFields.map(({ questionText, element, selector, fieldId }) => ({
    fieldId,
    label: questionText,
    value: getFieldValue(element).trim(),
    selector,
  }))

  return {
    title: document.title,
    entity: document.title,
    url: location.href,
    questions,
    content: toMarkdown({
      title: document.title,
      url: location.href,
      questions,
    }),
  }
}

async function dispatchDetectedFields() {
  detectedFields = detectFields()
  attachCaptureListeners(detectedFields)

  const payload = detectedFields.map(({ fieldId, questionText, selector }) => ({
    fieldId,
    questionText,
    selector,
  }))

  await chrome.runtime.sendMessage({
    type: 'FIELDS_DETECTED_FROM_PAGE',
    pageTitle: document.title,
    fields: payload,
  }).catch(() => {})

  return payload
}

function queueScan() {
  clearTimeout(detectTimer)
  detectTimer = window.setTimeout(() => {
    dispatchDetectedFields().catch(() => {})
  }, 500)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_FIELD_REQUEST') {
    fillFieldById(message.fieldId, message.text)
  }

  if (message.type === 'FILL_BULK_REQUEST') {
    ;(message.fills || []).forEach(({ fieldId, text }) => fillFieldById(fieldId, text))
  }

  if (message.type === 'MATCH_RESULTS_READY') {
    const existing = document.getElementById('apphub-overlay')
    if (existing) existing.remove()
    const overlay = buildOverlay(message.matches || [])
    if (overlay) document.body.appendChild(overlay)
  }

  if (message.type === 'FIELDS_SCAN_REQUEST') {
    dispatchDetectedFields().then(sendResponse)
    return true
  }

  if (message.type === 'CAPTURE_PAGE_REQUEST') {
    sendResponse(buildPageCapture())
    return false
  }

  if (message.type === 'EXPORT_MARKDOWN_REQUEST') {
    downloadMarkdown(buildPageCapture().content)
  }

  if (message.type === 'OPEN_INJECTED_PANEL') {
    openInjectedPanel()
  }

  return false
})

const observer = new MutationObserver(() => queueScan())

function init() {
  if (!document.body) return
  observer.observe(document.body, { childList: true, subtree: true })
  dispatchDetectedFields().catch(() => {})
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

if (isSafari) {
  window.__apphubOpenPanel = openInjectedPanel
}
