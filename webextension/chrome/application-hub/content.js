// ============================================================
// AQUA Application Hub — Content Script
// ============================================================
// Detects form fields on application portals (React/JS forms),
// matches them against the user's answer bank via /api/match-question,
// and pre-fills with proper event dispatching.
// ============================================================

(() => {
  'use strict'

  const AQUA_ATTR = 'data-aqua-processed'
  const MIN_LABEL_LENGTH = 8
  const DEBOUNCE_MS = 500

  // ─── Event dispatching for React/JS forms ───────────────────────────────────

  function dispatchInputEvents(el) {
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, el.value)
    }

    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
  }

  // ─── Label extraction ───────────────────────────────────────────────────────

  function getFieldLabel(field) {
    // 1. Explicit <label> via for/id
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`)
      if (label?.textContent?.trim()) return label.textContent.trim()
    }

    // 2. Wrapping <label>
    const parentLabel = field.closest('label')
    if (parentLabel?.textContent?.trim()) {
      const labelText = parentLabel.textContent.replace(field.value || '', '').trim()
      if (labelText.length >= MIN_LABEL_LENGTH) return labelText
    }

    // 3. aria-label or aria-labelledby
    if (field.getAttribute('aria-label')) return field.getAttribute('aria-label')
    const labelledBy = field.getAttribute('aria-labelledby')
    if (labelledBy) {
      const refEl = document.getElementById(labelledBy)
      if (refEl?.textContent?.trim()) return refEl.textContent.trim()
    }

    // 4. Placeholder
    if (field.placeholder && field.placeholder.length >= MIN_LABEL_LENGTH) return field.placeholder

    // 5. Previous sibling text node or heading
    const prev = field.previousElementSibling
    if (prev?.textContent?.trim()?.length >= MIN_LABEL_LENGTH) return prev.textContent.trim()

    // 6. Parent container heading
    const container = field.closest('[class*="question"], [class*="field"], [class*="form-group"]')
    if (container) {
      const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .question-text, .field-label, [class*="label"]')
      if (heading?.textContent?.trim()) return heading.textContent.trim()
    }

    return null
  }

  // ─── Form field detection ───────────────────────────────────────────────────

  function findFormFields() {
    const selectors = [
      'textarea:not([data-aqua-processed])',
      'input[type="text"]:not([data-aqua-processed])',
      '[contenteditable="true"]:not([data-aqua-processed])',
      '[role="textbox"]:not([data-aqua-processed])',
    ]
    return document.querySelectorAll(selectors.join(', '))
  }

  // ─── Pre-fill logic ─────────────────────────────────────────────────────────

  async function prefillField(field, matchResult) {
    const answer = matchResult.user_answer
    if (!answer?.content) return false

    field.focus()

    if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
      field.value = answer.content
      dispatchInputEvents(field)
    } else if (field.getAttribute('contenteditable') === 'true' || field.getAttribute('role') === 'textbox') {
      field.textContent = answer.content
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }

    field.setAttribute(AQUA_ATTR, 'filled')
    field.style.outline = '2px solid rgba(99, 102, 241, 0.5)'
    setTimeout(() => { field.style.outline = '' }, 2000)

    return true
  }

  // ─── Match + prefill orchestration ──────────────────────────────────────────

  async function processField(field) {
    if (field.getAttribute(AQUA_ATTR)) return

    const label = getFieldLabel(field)
    if (!label || label.length < MIN_LABEL_LENGTH) {
      field.setAttribute(AQUA_ATTR, 'skipped')
      return
    }

    field.setAttribute(AQUA_ATTR, 'pending')

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MATCH_QUESTION',
        payload: { text: label },
      })

      if (response?.matches?.length > 0) {
        const topMatch = response.matches[0]
        if (topMatch.auto_fill_safe && topMatch.user_answer) {
          await prefillField(field, topMatch)
        } else {
          // Mark as available but don't auto-fill
          field.setAttribute(AQUA_ATTR, 'available')
          field.dataset.aquaMatchId = topMatch.question_id
          field.dataset.aquaScore = String(topMatch.similarity)
        }
      } else {
        field.setAttribute(AQUA_ATTR, 'no-match')
      }
    } catch (err) {
      console.warn('[AQUA] Match failed:', err)
      field.setAttribute(AQUA_ATTR, 'error')
    }
  }

  // ─── Scan and process all fields ────────────────────────────────────────────

  let scanTimeout = null

  function scanPage() {
    if (scanTimeout) clearTimeout(scanTimeout)
    scanTimeout = setTimeout(() => {
      const fields = findFormFields()
      fields.forEach(processField)
    }, DEBOUNCE_MS)
  }

  // ─── Manual trigger (from popup) ────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'TRIGGER_PREFILL') {
      // Reset all fields and rescan
      document.querySelectorAll(`[${AQUA_ATTR}]`).forEach(el => {
        el.removeAttribute(AQUA_ATTR)
        delete el.dataset.aquaMatchId
        delete el.dataset.aquaScore
      })
      scanPage()
      sendResponse({ ok: true })
    }
    return true
  })

  // ─── MutationObserver for React/SPA forms ───────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true
        break
      }
    }
    if (hasNewNodes) scanPage()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Initial scan
  scanPage()
})()
