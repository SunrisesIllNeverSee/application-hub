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

// Runs inside the page context — dumps raw page text + all live field values
function scrapePage() {
  const url = window.location.href
  const title = document.title || window.location.hostname
  const rawText = document.body.innerText
  const metaDesc = document.querySelector('meta[name="description"]')?.content
    || document.querySelector('meta[property="og:description"]')?.content
    || null

  // Capture live input/textarea values (React stores these in .value, not DOM text)
  const fieldValues = []
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], textarea').forEach(el => {
    const val = el.value.trim()
    if (!val) return
    // Find associated label text
    let label = ''
    if (el.id) label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || ''
    if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
    if (!label) {
      // Walk up to find nearby label/heading
      let p = el.parentElement
      for (let i = 0; i < 5 && p; i++) {
        const h = p.querySelector('label, h1, h2, h3, h4, p, span')
        if (h && h !== el && h.textContent.trim().length > 3) {
          label = h.textContent.trim().replace(/\s+/g, ' ')
          break
        }
        p = p.parentElement
      }
    }
    fieldValues.push({ label: label || '(unlabeled)', value: val })
  })

  // Checked radio/checkbox options
  document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(el => {
    const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()
      || el.getAttribute('aria-label')
      || el.value
    fieldValues.push({ label: '(selected)', value: label })
  })

  return { url, title, rawText, metaDesc, fieldValues }
}

function buildMarkdown({ url, title, rawText, metaDesc, fieldValues }) {
  const date = new Date().toISOString().slice(0, 10)
  const lines = [
    `# ${title}`,
    '',
    `**URL:** ${url}`,
    `**Captured:** ${date}`,
  ]
  if (metaDesc) lines.push(`**Description:** ${metaDesc}`)

  if (fieldValues && fieldValues.length > 0) {
    lines.push('')
    lines.push('## Your Answers')
    lines.push('')
    fieldValues.forEach(({ label, value }) => {
      lines.push(`**${label}**`)
      lines.push(value)
      lines.push('')
    })
  }

  lines.push('')
  lines.push('## Raw Page Text')
  lines.push('')
  lines.push(rawText.trim())
  return lines.join('\n')
}
