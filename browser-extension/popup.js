const jwtInput    = document.getElementById('jwt-input')
const anonInput   = document.getElementById('anon-key-input')
const saveBtn     = document.getElementById('save-btn')
const statusDot   = document.getElementById('status-dot')
const statusText  = document.getElementById('status-text')

// Load saved values on open
chrome.storage.local.get(['jwt', 'anonKey'], ({ jwt, anonKey }) => {
  if (jwt)     jwtInput.value  = jwt
  if (anonKey) anonInput.value = anonKey
})

// Check auth status
chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, ({ authenticated } = {}) => {
  if (authenticated) {
    statusDot.classList.add('connected')
    statusText.textContent = 'Connected'
  } else {
    statusText.textContent = 'Not connected — paste your token below'
  }
})

saveBtn.addEventListener('click', () => {
  const jwt     = jwtInput.value.trim()
  const anonKey = anonInput.value.trim()
  if (!jwt || !anonKey) {
    statusText.textContent = 'Both fields are required'
    return
  }
  chrome.storage.local.set({ jwt, anonKey }, () => {
    statusDot.classList.add('connected')
    statusText.textContent = 'Connected'
    saveBtn.textContent = 'Saved ✓'
    setTimeout(() => { saveBtn.textContent = 'Save & connect' }, 1500)
  })
})
