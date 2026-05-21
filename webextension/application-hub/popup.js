const DEFAULT_SETTINGS = {
  hubUrl: 'https://mos2es.xyz',
  agentUrl: 'http://127.0.0.1:4317',
  jwt: '',
  mode: 'manual',
  automationEnabled: false,
}

const hubUrlInput = document.getElementById('hub-url-input')
const agentUrlInput = document.getElementById('agent-url-input')
const jwtInput = document.getElementById('jwt-input')
const automationToggle = document.getElementById('automation-enabled')
const modeValue = document.getElementById('mode-value')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const authOnlyActions = Array.from(document.querySelectorAll('[data-auth-required="true"]'))

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
  agentUrlInput.value = settings.agentUrl
  jwtInput.value = settings.jwt
  automationToggle.checked = Boolean(settings.automationEnabled)
  setModeText(settings)
  setStatus(
    authenticated ? 'Connected to your answer bank.' : 'Paste a session token to connect.',
    authenticated
  )
  authOnlyActions.forEach((button) => { button.disabled = !authenticated })
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const next = await saveSettings({
    hubUrl: hubUrlInput.value.trim() || DEFAULT_SETTINGS.hubUrl,
    agentUrl: agentUrlInput.value.trim() || DEFAULT_SETTINGS.agentUrl,
    jwt: jwtInput.value.trim(),
    automationEnabled: automationToggle.checked,
    mode: automationToggle.checked ? 'automation' : 'manual',
  })
  setModeText(next)
  setStatus('Connection saved.', Boolean(next.jwt))
  authOnlyActions.forEach((button) => { button.disabled = !next.jwt })
})

document.getElementById('clear-btn').addEventListener('click', async () => {
  const next = await chrome.runtime.sendMessage({ type: 'AUTH_CLEAR' })
  hubUrlInput.value = next.hubUrl
  jwtInput.value = ''
  automationToggle.checked = false
  setModeText(next)
  setStatus('Connection cleared.', false)
  authOnlyActions.forEach((button) => { button.disabled = true })
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

document.getElementById('agent-btn').addEventListener('click', async () => {
  const tabId = await activeTabId()
  const response = await chrome.runtime.sendMessage({
    type: 'AGENT_SEND_REQUEST',
    tabId,
  })
  setStatus(response?.error ? response.error : `Saved to ${response?.saved_to}`, !response?.error)
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
