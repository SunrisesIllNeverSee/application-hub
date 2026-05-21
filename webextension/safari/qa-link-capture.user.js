// ==UserScript==
// @name         QA Link Capture
// @namespace    https://applicationhub.app
// @version      0.1.0
// @description  Capture the current page into the local QA corpus with site, company, and application hints
// @author       Application Hub
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict'

  const AGENT_URL = 'http://127.0.0.1:4317'
  const PANEL_ID = 'qa-link-capture-panel'
  const TOAST_PREFIX = 'qa-link-capture-toast-'
  const BANNER_ID = 'qa-link-capture-banner'

  function gmAddStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css)
      return
    }

    const style = document.createElement('style')
    style.textContent = css
    ;(document.head || document.documentElement).appendChild(style)
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function textOrNull(value) {
    const text = cleanText(value)
    return text.length ? text : null
  }

  function getMeta(selector) {
    const node = document.querySelector(selector)
    return textOrNull(node ? node.getAttribute('content') : '')
  }

  function splitTitle(value) {
    return cleanText(value)
      .split(/\s*[|•·—–-]\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
  }

  function hostLabel(hostname) {
    return cleanText(String(hostname || '').replace(/^www\./i, ''))
      .replace(/\.[a-z]{2,}$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || hostname || null
  }

  function metaFallback() {
    return (
      getMeta('meta[property="og:site_name"]') ||
      getMeta('meta[name="application-name"]') ||
      getMeta('meta[property="og:application-name"]')
    )
  }

  function inferSiteName() {
    return metaFallback() || hostLabel(location.hostname) || null
  }

  function inferApplicationName() {
    const h1Node = document.querySelector('h1')
    const h1 = textOrNull(h1Node ? h1Node.innerText : '')
    const titleParts = splitTitle(document.title)
    const ogTitle = getMeta('meta[property="og:title"]')
    return h1 || titleParts[0] || ogTitle || textOrNull(document.title) || 'Untitled application'
  }

  function inferCompanyName() {
    const siteName = inferSiteName()
    if (siteName && siteName !== inferApplicationName()) return siteName

    const titleParts = splitTitle(document.title)
    if (titleParts[1]) return titleParts[1]
    return hostLabel(location.hostname) || null
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return rect.width >= 80 && rect.height >= 18 && style.visibility !== 'hidden' && style.display !== 'none'
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value)
    return String(value || '').replace(/["\\]/g, '\\$&')
  }

  function getLabel(element) {
    if (element.labels && element.labels[0] && element.labels[0].innerText) return cleanText(element.labels[0].innerText)

    const id = element.getAttribute('id')
    if (id) {
      const label = document.querySelector(`label[for="${cssEscape(id)}"]`)
      if (label && label.textContent) return cleanText(label.textContent)
    }

    const aria = textOrNull(element.getAttribute('aria-label'))
    if (aria) return aria

    const placeholder = textOrNull(element.getAttribute('placeholder'))
    if (placeholder) return placeholder

    const parentLabel = element.closest('label')
    if (parentLabel && parentLabel.textContent) return cleanText(parentLabel.textContent)

    const previous = element.previousElementSibling
    if (previous && ['LABEL', 'P', 'H3', 'H4', 'LEGEND'].includes(previous.tagName)) {
      return cleanText(previous.textContent)
    }

    const container = element.closest('div, section, fieldset, form')
    const containerLabel = container ? container.querySelector('label, legend, h1, h2, h3, p') : null
    return textOrNull(containerLabel ? containerLabel.textContent : '')
  }

  function getFieldValue(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return cleanText(element.value)
    }
    if (element.isContentEditable) return cleanText(element.innerText)
    return cleanText(element.textContent)
  }

  function selectorFor(element) {
    const id = element.getAttribute('id')
    if (id) return `#${cssEscape(id)}`

    const name = element.getAttribute('name')
    if (name) return `${element.tagName.toLowerCase()}[name="${cssEscape(name)}"]`

    return element.tagName.toLowerCase()
  }

  function extractFields() {
    const fields = []
    const seen = new Set()
    document.querySelectorAll('textarea, input:not([type="hidden"]), select, [contenteditable="true"]').forEach((element) => {
      if (!isVisible(element)) return
      const label = getLabel(element)
      const value = getFieldValue(element)
      const selector = selectorFor(element)
      const key = `${selector}::${label || value}`
      if (seen.has(key)) return
      if (!label && !value) return
      seen.add(key)

      fields.push({
        label: label || element.getAttribute('name') || element.id || 'Field',
        value,
        selector,
        type: element.getAttribute('type') || element.tagName.toLowerCase(),
        required: Boolean(element.required),
      })
    })
    return fields
  }

  function pageText() {
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body
    const rootText = root ? root.innerText : ''
    const bodyText = document.body ? document.body.innerText : ''
    return cleanText(rootText || bodyText || '').slice(0, 12000)
  }

  function summaryIntro() {
    const bits = [
      `Capture kind: safari-link`,
      `URL: ${location.href}`,
      `Site: ${inferSiteName() || '—'}`,
      `Company: ${inferCompanyName() || '—'}`,
      `Application: ${inferApplicationName()}`,
      `Detected fields: ${extractFields().length}`,
    ]
    return bits.join('\n')
  }

  function buildCapturePayload() {
    const fields = extractFields()
    const title = inferApplicationName()
    return {
      title,
      url: location.href,
      host: location.hostname,
      site_name: inferSiteName(),
      company_name: inferCompanyName(),
      application_name: title,
      capture_kind: 'safari-link',
      content: summaryIntro(),
      page_text: pageText(),
      questions: fields.map((field) => ({
        label: field.label,
        questionText: field.label,
        value: field.value,
        selector: field.selector,
      })),
    }
  }

  function postJson(url, payload) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(payload),
          onload: (response) => {
            let parsed = {}
            try {
              parsed = JSON.parse(response.responseText || '{}')
            } catch {
              parsed = { raw: response.responseText || '' }
            }
            if (response.status >= 200 && response.status < 300) {
              resolve(parsed)
            } else {
              reject(new Error(parsed.error || `Agent request failed (${response.status})`))
            }
          },
          onerror: () => reject(new Error('Local agent request failed')),
        })
      })
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      const parsed = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(parsed.error || `Agent request failed (${response.status})`)
      return parsed
    })
  }

  function showToast(message, isError) {
    const toast = document.createElement('div')
    toast.id = `${TOAST_PREFIX}${Date.now()}`
    toast.textContent = message
    toast.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      'background:' + (isError ? '#7f1d1d' : '#111827'),
      'color:#f8fafc',
      'border:1px solid ' + (isError ? '#ef4444' : '#334155'),
      'padding:10px 12px',
      'border-radius:10px',
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'max-width:320px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
    ].join(';')

    document.body.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 250)
    }, 2200)
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return

    const banner = document.createElement('div')
    banner.id = BANNER_ID
    banner.textContent = `QA Link Capture active · ${location.hostname}`
    banner.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:#f59e0b',
      'color:#111827',
      'border:1px solid #fbbf24',
      'padding:8px 12px',
      'border-radius:999px',
      'font:600 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'box-shadow:0 10px 24px rgba(0,0,0,0.22)',
      'display:flex',
      'align-items:center',
      'gap:10px',
    ].join(';')

    const close = document.createElement('button')
    close.textContent = 'Dismiss'
    close.style.cssText = [
      'border:none',
      'background:rgba(17,24,39,0.12)',
      'color:#111827',
      'border-radius:999px',
      'padding:4px 8px',
      'font:inherit',
      'cursor:pointer',
    ].join(';')
    close.addEventListener('click', () => banner.remove())

    banner.appendChild(close)
    document.body.appendChild(banner)
    console.log('[QA Link Capture] userscript injected on', location.href)
  }

  function ensurePanel() {
    if (document.getElementById(PANEL_ID)) return

    const panel = document.createElement('div')
    panel.id = PANEL_ID

    const title = document.createElement('div')
    title.textContent = 'QA Link Capture'
    title.style.cssText = 'font-weight:700;font-size:12px;color:#e5e7eb;'

    const subtitle = document.createElement('div')
    subtitle.textContent = 'Send the current page to the local QA agent.'
    subtitle.style.cssText = 'font-size:11px;color:#94a3b8;line-height:1.4;'

    const sendBtn = document.createElement('button')
    sendBtn.textContent = 'Send to QA'
    sendBtn.addEventListener('click', async () => {
      const original = sendBtn.textContent
      sendBtn.disabled = true
      sendBtn.textContent = 'Sending...'
      try {
        const payload = buildCapturePayload()
        const result = await postJson(`${AGENT_URL}/assist`, payload)
        const relatedCount = Array.isArray(result.related_files) ? result.related_files.length : 0
        showToast(`Saved ${result.saved_to || 'capture'} (${relatedCount} related files).`, false)
      } catch (error) {
        console.error('[QA Link Capture] send failed', error)
        showToast('Send failed. Check that the local agent is running.', true)
      } finally {
        sendBtn.disabled = false
        sendBtn.textContent = original
      }
    })

    const refreshBtn = document.createElement('button')
    refreshBtn.textContent = 'Refresh'
    refreshBtn.addEventListener('click', () => {
      subtitle.textContent = `${inferApplicationName()} · ${inferCompanyName() || 'Unknown company'}`
      showToast('Refreshed page summary.', false)
    })

    const hint = document.createElement('div')
    hint.textContent = 'Captures title, URL, site, company, application, and visible fields.'
    hint.style.cssText = 'font-size:11px;color:#94a3b8;line-height:1.4;'

    ;[sendBtn, refreshBtn].forEach((button) => {
      button.style.cssText = [
        'width:100%',
        'border-radius:8px',
        'border:1px solid #334155',
        'background:#111827',
        'color:#e2e8f0',
        'padding:8px 10px',
        'font:inherit',
        'cursor:pointer',
        'box-sizing:border-box',
      ].join(';')
      button.addEventListener('mouseenter', () => {
        button.style.background = '#1f2937'
      })
      button.addEventListener('mouseleave', () => {
        button.style.background = '#111827'
      })
    })

    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(sendBtn)
    panel.appendChild(refreshBtn)
    panel.appendChild(hint)

    panel.style.cssText = [
      'position:fixed',
      'top:50%',
      'right:20px',
      'transform:translateY(-50%)',
      'z-index:2147483647',
      'width:220px',
      'max-height:calc(100vh - 40px)',
      'overflow:auto',
      'padding:12px',
      'border-radius:12px',
      'background:#0f172a',
      'border:1px solid #1e293b',
      'box-shadow:0 12px 32px rgba(0,0,0,0.3)',
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
    ].join(';')

    document.body.appendChild(panel)
  }

  function boot() {
    if (!document.body) return false
    showBanner()
    ensurePanel()
    return true
  }

  function start() {
    if (boot()) return
    const waitForBody = () => {
      if (boot()) return
      window.setTimeout(waitForBody, 50)
    }
    waitForBody()
  }

  gmAddStyle('')
  let observer = null
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }

  const bindObserver = () => {
    if (observer || !document.body) return
    observer = new MutationObserver(() => boot())
    observer.observe(document.body, { childList: true, subtree: true })
  }

  bindObserver()
  document.addEventListener('DOMContentLoaded', bindObserver, { once: true })

  GM_registerMenuCommand('QA Link Capture — send current page', () => {
    const btn = document.querySelector(`#${PANEL_ID} button`)
    if (btn) {
      btn.click()
      return
    }
    const payload = buildCapturePayload()
    postJson(`${AGENT_URL}/assist`, payload)
      .then((result) => {
        showToast(`Saved ${result.saved_to || 'capture'}.`, false)
      })
      .catch((error) => {
        console.error('[QA Link Capture] menu send failed', error)
        showToast('Send failed. Check that the local agent is running.', true)
      })
  })
})()
