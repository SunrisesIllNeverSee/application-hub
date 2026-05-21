function makeFilename(kind, ext) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `x-bookmarks-${kind}-${stamp}.${ext}`
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const downloadPromise = Promise.resolve(chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  }))
  return downloadPromise.finally(() => {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}

async function getActiveBookmarksTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) throw new Error('Open X bookmarks first.')
  if (!/^https:\/\/(x|twitter)\.com\/i\/bookmarks/.test(tab.url)) {
    throw new Error('Open your X bookmarks page first.')
  }
  return tab
}

async function collectBookmarks(sortMode) {
  const tab = await getActiveBookmarksTab()
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'XBM_COLLECT',
    sortMode,
  })
  if (!response?.ok) throw new Error(response?.error || 'Could not extract bookmarks.')
  return response
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message.type === 'XBM_EXPORT_MARKDOWN') {
      const data = await collectBookmarks(message.sortMode || 'page')
      const filename = makeFilename('export', 'md')
      await downloadText(filename, data.markdown, 'text/markdown')
      return { ok: true, filename, count: data.items.length }
    }

    if (message.type === 'XBM_EXPORT_JSON') {
      const data = await collectBookmarks(message.sortMode || 'page')
      const filename = makeFilename('export', 'json')
      await downloadText(filename, JSON.stringify(data.json, null, 2), 'application/json')
      return { ok: true, filename, count: data.items.length }
    }

    if (message.type === 'XBM_PING') {
      return { ok: true }
    }

    return { ok: false, error: `Unknown message: ${message.type}` }
  })()
    .then((payload) => sendResponse(payload))
    .catch((error) => sendResponse({ ok: false, error: error.message }))

  return true
})
