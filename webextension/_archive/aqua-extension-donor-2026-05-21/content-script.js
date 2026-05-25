const AQUA_BUTTON_CLASS = 'aqua-fill-button'
const AQUA_FIELD_ATTR = 'data-aqua-field-id'
let aquaFieldCounter = 0
let detectTimer = null

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

function getLabelText(field) {
  if (field.labels?.[0]?.innerText) return field.labels[0].innerText.trim()
  const id = field.getAttribute('id')
  if (id) {
    const label = document.querySelector(`label[for="${cssEscape(id)}"]`)
    if (label?.textContent) return label.textContent.trim()
  }
  const wrappingLabel = field.closest('label')
  if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim()
  const aria = field.getAttribute('aria-label') || field.getAttribute('placeholder')
  if (aria) return aria.trim()
  const nearby = field.closest('div, section, fieldset')?.querySelector('label, legend, h1, h2, h3, p')
  return nearby?.textContent?.trim() || 'Application field'
}

function fieldValue(field) {
  if ('value' in field) return field.value || ''
  return field.innerText || ''
}

function setFieldValue(field, value) {
  if ('value' in field) field.value = value
  else field.textContent = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

function getSelector(field) {
  let id = field.getAttribute(AQUA_FIELD_ATTR)
  if (!id) {
    id = `aqua-field-${++aquaFieldCounter}`
    field.setAttribute(AQUA_FIELD_ATTR, id)
  }
  return `[${AQUA_FIELD_ATTR}="${id}"]`
}

async function matchAndFill(field) {
  const label = getLabelText(field)
  const response = await chrome.runtime.sendMessage({ type: 'AQUA_MATCH_QUESTION', text: label, limit: 1 })
  const match = response?.payload?.matches?.[0]
  const answer = match?.user_answer?.content
  if (answer) {
    setFieldValue(field, answer)
    return
  }
  alert('AQUA found the field, but no saved answer was available yet.')
}

function addPreFillButton(field) {
  if (field.dataset.aquaButtonAttached === 'true') return
  field.dataset.aquaButtonAttached = 'true'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = AQUA_BUTTON_CLASS
  button.textContent = 'AQUA Fill'
  button.title = 'Fill this field from your AQUA answer bank'
  Object.assign(button.style, {
    position: 'absolute',
    zIndex: '2147483647',
    padding: '4px 8px',
    border: '1px solid #2563eb',
    borderRadius: '6px',
    background: '#09090b',
    color: '#dbeafe',
    fontSize: '11px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
  })

  button.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    button.textContent = 'Matching...'
    try {
      await matchAndFill(field)
      button.textContent = 'Filled'
    } catch (error) {
      button.textContent = 'AQUA Fill'
      console.warn('[AQUA] fill failed', error)
    }
  })

  document.body.appendChild(button)
  positionButton(field, button)
  window.addEventListener('scroll', () => positionButton(field, button), { passive: true })
  window.addEventListener('resize', () => positionButton(field, button))
}

function positionButton(field, button) {
  const rect = field.getBoundingClientRect()
  button.style.top = `${window.scrollY + rect.top + 6}px`
  button.style.left = `${window.scrollX + rect.right - 82}px`
}

function detectForms() {
  const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable="true"]'))
    .filter((field) => {
      const rect = field.getBoundingClientRect()
      return rect.width > 80 && rect.height > 20
    })

  fields.forEach(addPreFillButton)
  return fields
}

async function captureCurrentApplication() {
  const fields = detectForms()
  const questions = fields.map((field) => ({
    label: getLabelText(field),
    value: fieldValue(field),
    selector: getSelector(field),
  }))
  const content = questions.map((item) => `Q: ${item.label}\nA: ${item.value}`).join('\n\n')
  return chrome.runtime.sendMessage({
    type: 'AQUA_CAPTURE_QUESTIONS',
    entity: document.title,
    source: location.href,
    content,
    questions,
  })
}

const observer = new MutationObserver(() => {
  window.clearTimeout(detectTimer)
  detectTimer = window.setTimeout(detectForms, 800)
})

observer.observe(document.body, { childList: true, subtree: true })
detectForms()

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.shiftKey && event.altKey) {
    event.preventDefault()
    captureCurrentApplication().catch((error) => console.warn('[AQUA] capture failed', error))
  }
})

window.AQUA_CAPTURE_CURRENT_APPLICATION = captureCurrentApplication

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'AQUA_CAPTURE_PAGE_FROM_POPUP') return false
  captureCurrentApplication()
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, error: error.message }))
  return true
})
