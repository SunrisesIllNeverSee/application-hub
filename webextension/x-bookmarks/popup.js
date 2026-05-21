const sortModeInput = document.getElementById('sort-mode')
const statusEl = document.getElementById('status')

function setStatus(text) {
  statusEl.textContent = text
}

async function send(type) {
  const response = await chrome.runtime.sendMessage({
    type,
    sortMode: sortModeInput.value,
  })
  if (!response?.ok) {
    throw new Error(response?.error || 'Export failed')
  }
  return response
}

document.getElementById('download-md').addEventListener('click', async () => {
  setStatus('Collecting bookmarks...')
  try {
    const response = await send('XBM_EXPORT_MARKDOWN')
    setStatus(`Saved ${response.count} bookmarks as Markdown.`)
  } catch (error) {
    setStatus(error.message)
  }
})

document.getElementById('download-json').addEventListener('click', async () => {
  setStatus('Collecting bookmarks...')
  try {
    const response = await send('XBM_EXPORT_JSON')
    setStatus(`Saved ${response.count} bookmarks as JSON.`)
  } catch (error) {
    setStatus(error.message)
  }
})
