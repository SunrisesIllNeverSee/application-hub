const DEFAULT_HUB_URL = 'https://mos2es.xyz'

const hubUrlInput = document.getElementById('hubUrl')
const jwtInput = document.getElementById('jwt')
const statusEl = document.getElementById('status')

function setStatus(message) {
  statusEl.textContent = message
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function init() {
  const settings = await chrome.storage.local.get(['hubUrl', 'jwt'])
  hubUrlInput.value = settings.hubUrl || DEFAULT_HUB_URL
  jwtInput.value = settings.jwt || ''
}

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    hubUrl: hubUrlInput.value || DEFAULT_HUB_URL,
    jwt: jwtInput.value,
  })
  setStatus('Connection saved.')
})

document.getElementById('capture').addEventListener('click', async () => {
  const tab = await activeTab()
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'AQUA_CAPTURE_PAGE_FROM_POPUP' }).catch(() => null)
  if (!response) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.AQUA_CAPTURE_CURRENT_APPLICATION?.() })
  }
  setStatus('Capture sent to AQUA.')
})

document.getElementById('matcher').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'AQUA_SMART_MATCHER', vertical: 'founder' })
  setStatus(response.ok ? 'Smart Matcher complete.' : response.error)
})

document.getElementById('openHub').addEventListener('click', async () => {
  const { hubUrl } = await chrome.storage.local.get(['hubUrl'])
  await chrome.tabs.create({ url: `${(hubUrl || DEFAULT_HUB_URL).replace(/\/$/, '')}/applications` })
})

document.getElementById('exportMd').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'AQUA_EXPORT_MD' })
  setStatus(response.ok ? 'Markdown export started.' : response.error)
})

init()
