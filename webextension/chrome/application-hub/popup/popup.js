// ============================================================
// AQUA Popup Script
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot')
  const statusText = document.getElementById('status-text')
  const fitContainer = document.getElementById('fit-container')
  const fitScore = document.getElementById('fit-score')
  const fitLabel = document.getElementById('fit-label')
  const btnPrefill = document.getElementById('btn-prefill')
  const btnOpenApp = document.getElementById('btn-open-app')

  // Check connection status
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
    if (status.authenticated) {
      statusDot.classList.remove('disconnected')
      statusDot.classList.add('connected')
      statusText.textContent = 'Connected · Pre-fill enabled'
    } else {
      statusText.textContent = 'Not signed in — open AQUA to connect'
    }
  } catch {
    statusText.textContent = 'Unable to connect'
  }

  // Check active tab for processed fields
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const filled = document.querySelectorAll('[data-aqua-processed="filled"]').length
          const available = document.querySelectorAll('[data-aqua-processed="available"]').length
          const total = document.querySelectorAll('[data-aqua-processed]').length
          const scores = [...document.querySelectorAll('[data-aqua-score]')]
            .map(el => parseFloat(el.dataset.aquaScore))
            .filter(s => !isNaN(s))
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
          return { filled, available, total, avgScore }
        },
      })

      if (results?.[0]?.result) {
        const { filled, available, avgScore } = results[0].result
        if (avgScore > 0 || filled > 0 || available > 0) {
          fitContainer.style.display = 'block'
          fitScore.textContent = `${Math.round(avgScore * 100)}%`
          fitLabel.textContent = `${filled} filled · ${available} ready`
        }
      }
    }
  } catch {
    // Content script may not be injected on this page
  }

  // Pre-fill button
  btnPrefill.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_PREFILL' })
        btnPrefill.textContent = 'Scanning...'
        setTimeout(() => { window.close() }, 1500)
      }
    } catch {
      btnPrefill.textContent = 'No form detected'
    }
  })

  // Open app button
  btnOpenApp.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://mos2es.xyz/dash' })
    window.close()
  })
})
