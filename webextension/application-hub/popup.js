const jwtInput  = document.getElementById('jwt-input')
const saveBtn   = document.getElementById('save-btn')
const clearBtn  = document.getElementById('clear-btn')
const panelBtn  = document.getElementById('open-panel-btn')
const statusDot = document.getElementById('status-dot')
const statusTxt = document.getElementById('status-text')

// ── Load saved token ──────────────────────────────────────────────────────────

chrome.storage.local.get(['jwt'], ({ jwt }) => {
  if (jwt) jwtInput.value = jwt
})

chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, ({ authenticated } = {}) => {
  if (authenticated) {
    statusDot.classList.add('connected')
    statusTxt.textContent = 'Connected'
  } else {
    statusTxt.textContent = 'Not connected — paste your token below'
  }
})

// ── Save / clear ──────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const jwt = jwtInput.value.trim()
  if (!jwt) return
  chrome.storage.local.set({ jwt }, () => {
    statusDot.classList.add('connected')
    statusTxt.textContent = 'Connected'
    saveBtn.textContent = 'Saved ✓'
    setTimeout(() => { saveBtn.textContent = 'Save' }, 1500)
  })
})

clearBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['jwt'], () => {
    jwtInput.value = ''
    statusDot.classList.remove('connected')
    statusTxt.textContent = 'Not connected — paste your token below'
  })
})

// ── Open side panel ───────────────────────────────────────────────────────────

panelBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.sidePanel.open({ tabId: tab.id })
    window.close()
  })
})
