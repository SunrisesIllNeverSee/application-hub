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

const captureBtn = document.getElementById('capture-btn')

captureBtn.addEventListener('click', () => {
  captureBtn.textContent = 'Capturing…'
  captureBtn.disabled = true

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: scrapePage,
      },
      (results) => {
        const data = results?.[0]?.result
        if (!data) {
          captureBtn.textContent = '⬇ Save page as Markdown'
          captureBtn.disabled = false
          return
        }
        const md = buildMarkdown(data)
        const slug = data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 40)
        const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.md`
        const blob = new Blob([md], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        chrome.downloads.download({ url, filename, saveAs: false }, () => {
          URL.revokeObjectURL(url)
          captureBtn.textContent = '✓ Saved'
          captureBtn.classList.add('done')
          setTimeout(() => {
            captureBtn.textContent = '⬇ Save page as Markdown'
            captureBtn.classList.remove('done')
            captureBtn.disabled = false
          }, 2000)
        })
      }
    )
  })
})

// Runs inside the page context — dumps raw page text + metadata
function scrapePage() {
  const url = window.location.href
  const title = document.title || window.location.hostname
  const rawText = document.body.innerText
  const metaDesc = document.querySelector('meta[name="description"]')?.content
    || document.querySelector('meta[property="og:description"]')?.content
    || null
  return { url, title, rawText, metaDesc }
}

function buildMarkdown({ url, title, rawText, metaDesc }) {
  const date = new Date().toISOString().slice(0, 10)
  const lines = [
    `# ${title}`,
    '',
    `**URL:** ${url}`,
    `**Captured:** ${date}`,
  ]
  if (metaDesc) lines.push(`**Description:** ${metaDesc}`)
  lines.push('')
  lines.push('## Raw Page Text')
  lines.push('')
  lines.push(rawText.trim())
  return lines.join('\n')
}
