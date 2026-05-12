const jwtInput   = document.getElementById('jwt-input')
const saveBtn    = document.getElementById('save-btn')
const clearBtn   = document.getElementById('clear-btn')
const statusDot  = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')

chrome.storage.local.get(['jwt'], ({ jwt }) => {
  if (jwt) jwtInput.value = jwt
})

chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, ({ authenticated } = {}) => {
  if (authenticated) {
    statusDot.classList.add('connected')
    statusText.textContent = 'Connected'
  } else {
    statusText.textContent = 'Not connected — paste your token below'
  }
})

saveBtn.addEventListener('click', () => {
  const jwt = jwtInput.value.trim()
  if (!jwt) {
    statusText.textContent = 'Token is required'
    return
  }
  chrome.storage.local.set({ jwt }, () => {
    statusDot.classList.add('connected')
    statusText.textContent = 'Connected'
    saveBtn.textContent = 'Saved ✓'
    setTimeout(() => { saveBtn.textContent = 'Save & connect' }, 1500)
  })
})

clearBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['jwt'], () => {
    jwtInput.value = ''
    statusDot.classList.remove('connected')
    statusText.textContent = 'Not connected — paste your token below'
  })
})
