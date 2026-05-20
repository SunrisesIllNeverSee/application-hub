const DEFAULT_HUB_URL = 'https://mos2es.xyz'

async function getSettings() {
  const settings = await chrome.storage.local.get(['hubUrl', 'jwt'])
  return {
    hubUrl: (settings.hubUrl || DEFAULT_HUB_URL).replace(/\/$/, ''),
    jwt: settings.jwt || '',
  }
}

async function hubFetch(path, body) {
  const { hubUrl, jwt } = await getSettings()
  const res = await fetch(`${hubUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `AQUA request failed: ${res.status}`)
  return payload
}

async function exportMarkdown(tab) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const fields = Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"]'))
        .map((field, index) => {
          const label = field.labels?.[0]?.innerText || field.closest('label')?.innerText || field.getAttribute('placeholder') || `Field ${index + 1}`
          const value = field.value || field.innerText || ''
          return `## ${label}\n\n${value}`
        })
        .join('\n\n')
      return `# ${document.title}\n\n${location.href}\n\n${fields}`
    },
  })
  const url = URL.createObjectURL(new Blob([result], { type: 'text/markdown' }))
  await chrome.downloads.download({ url, filename: `aqua-capture-${Date.now()}.md`, saveAs: true })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message.type === 'AQUA_CAPTURE_QUESTIONS') {
      return hubFetch('/api/hub/ingest', {
        vertical: message.vertical || 'founder',
        entity: message.entity || sender.tab?.title || 'Captured application',
        source: sender.tab?.url,
        content: message.content,
        metadata: { url: sender.tab?.url, title: sender.tab?.title, questions: message.questions || [] },
      })
    }

    if (message.type === 'AQUA_MATCH_QUESTION') {
      return hubFetch('/api/match-question', { text: message.text, limit: message.limit || 3 })
    }

    if (message.type === 'AQUA_SMART_MATCHER') {
      return hubFetch('/api/hub/smart-matcher', { vertical_filter: message.vertical || 'founder' })
    }

    if (message.type === 'AQUA_PREFILL') {
      if (!sender.tab?.id) return { ok: false }
      await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: (selector, value) => {
          const el = document.querySelector(selector)
          if (!el) return
          if ('value' in el) el.value = value
          else el.textContent = value
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        },
        args: [message.selector, message.value],
      })
      return { ok: true }
    }

    if (message.type === 'AQUA_EXPORT_MD') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await exportMarkdown(tab)
      return { ok: true }
    }

    return { ok: false, error: 'Unknown message type' }
  })()
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, error: error.message }))

  return true
})
