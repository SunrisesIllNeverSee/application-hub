const DEFAULT_SETTINGS = {
  hubUrl: 'https://mos2es.xyz',
  jwt: '',
  mode: 'manual',
  automationEnabled: false,
}

const hubUrlInput = document.getElementById('hub-url-input')
const jwtInput = document.getElementById('jwt-input')
const automationToggle = document.getElementById('automation-enabled')
const modeValue = document.getElementById('mode-value')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const quickActions = document.getElementById('quick-actions')

function setStatus(message, connected) {
  statusText.textContent = message
  statusDot.classList.toggle('connected', Boolean(connected))
}

function setModeText(settings) {
  const mode = settings.mode === 'automation' ? 'Automation Assist' : 'Manual Assist'
  const state = settings.automationEnabled ? 'enabled' : 'off'
  modeValue.textContent = `${mode} • Automation ${state}`
}

async function getSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_CHECK' })
  return {
    authenticated: Boolean(response?.authenticated),
    settings: {
      ...DEFAULT_SETTINGS,
      ...(response?.settings || {}),
    },
  }
}

async function saveSettings(partial) {
  return chrome.runtime.sendMessage({
    type: 'AUTH_SAVE_SETTINGS',
    settings: partial,
  })
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id || null
}

async function refresh() {
  const { authenticated, settings } = await getSettings()
  hubUrlInput.value = settings.hubUrl
  jwtInput.value = settings.jwt
  automationToggle.checked = Boolean(settings.automationEnabled)
  setModeText(settings)
  setStatus(
    authenticated ? 'Connected to your answer bank.' : 'Paste a session token to connect.',
    authenticated
  )
  quickActions.classList.toggle('disabled', !authenticated)
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const next = await saveSettings({
    hubUrl: hubUrlInput.value.trim() || DEFAULT_SETTINGS.hubUrl,
    jwt: jwtInput.value.trim(),
    automationEnabled: automationToggle.checked,
    mode: automationToggle.checked ? 'automation' : 'manual',
  })
  setModeText(next)
  setStatus('Connection saved.', Boolean(next.jwt))
  quickActions.classList.toggle('disabled', !next.jwt)
})

document.getElementById('clear-btn').addEventListener('click', async () => {
  const next = await chrome.runtime.sendMessage({ type: 'AUTH_CLEAR' })
  hubUrlInput.value = next.hubUrl
  jwtInput.value = ''
  automationToggle.checked = false
  setModeText(next)
  setStatus('Connection cleared.', false)
  quickActions.classList.add('disabled')
})

automationToggle.addEventListener('change', async () => {
  const next = await saveSettings({
    automationEnabled: automationToggle.checked,
    mode: automationToggle.checked ? 'automation' : 'manual',
  })
  setModeText(next)
})

document.getElementById('open-panel-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'AUTH_OPEN_PANEL' })
  window.close()
})

document.getElementById('capture-btn').addEventListener('click', async () => {
  const tabId = await activeTabId()
  const response = await chrome.runtime.sendMessage({
    type: 'CANONICAL_INGEST_REQUEST',
    tabId,
    vertical: 'founder',
  })
  setStatus(response?.error ? response.error : 'Canonical capture sent.', !response?.error)
})

document.getElementById('matcher-btn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'SMART_MATCHER_REQUEST',
    vertical: 'founder',
    matchLimit: 5,
  })
  setStatus(response?.error ? response.error : 'Smart Matcher finished.', !response?.error)
})

document.getElementById('open-hub-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'APP_OPEN_HUB' })
})

document.getElementById('export-md-btn').addEventListener('click', async () => {
  const tabId = await activeTabId()
  const response = await chrome.runtime.sendMessage({
    type: 'EXPORT_MARKDOWN_REQUEST',
    tabId,
  })
  setStatus(response?.error ? response.error : 'Markdown export started.', !response?.error)
})

refresh()
