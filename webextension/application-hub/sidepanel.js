const DEFAULT_SETTINGS = {
  hubUrl: 'https://mos2es.xyz',
  jwt: '',
  mode: 'manual',
  automationEnabled: false,
}

let settings = { ...DEFAULT_SETTINGS }
let detectedFields = []
let generatedAnswers = {}
let activeTabId = null

const $ = (id) => document.getElementById(id)

const sections = {
  auth: $('panel-auth'),
  idle: $('panel-idle'),
  main: $('panel-main'),
  generating: $('panel-generating'),
}

function clearEl(element) {
  while (element.firstChild) element.removeChild(element.firstChild)
}

function showSection(name) {
  Object.entries(sections).forEach(([key, element]) => {
    element.classList.toggle('hidden', key !== name)
  })
}

function modeLabel(mode) {
  return mode === 'automation' ? 'Automation Assist' : 'Manual Assist'
}

function modeCopy(mode) {
  if (mode === 'automation') {
    return 'Automation Assist adds capture, Smart Matcher, and threshold-gated bulk help. It still leaves final control in your hands.'
  }

  return 'Manual Assist keeps the loop simple: detect, review, generate, fill, export, and save edits back to your bank.'
}

function setModeBadge() {
  $('panel-mode-badge').textContent = modeLabel(settings.mode)
  $('panel-mode-copy').textContent = modeCopy(settings.mode)
  $('mode-manual').classList.toggle('active', settings.mode === 'manual')
  $('mode-automation').classList.toggle('active', settings.mode === 'automation')
  $('automation-panel').classList.toggle('hidden', settings.mode !== 'automation')
}

function setStatus(connected) {
  $('panel-status').classList.toggle('connected', connected)
}

function setAutomationFeedback(message, tone = 'muted') {
  const el = $('automation-feedback')
  el.textContent = message
  el.className = `callout callout-${tone}`
}

function normalizeText(text) {
  return typeof text === 'string' ? text.trim() : ''
}

async function requestSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_CHECK' })
  settings = {
    ...DEFAULT_SETTINGS,
    ...(response?.settings || {}),
  }
  return response?.authenticated || false
}

async function saveSettings(partial) {
  const next = await chrome.runtime.sendMessage({
    type: 'AUTH_SAVE_SETTINGS',
    settings: partial,
  })
  settings = {
    ...DEFAULT_SETTINGS,
    ...(next || {}),
  }
  setModeBadge()
  return settings
}

async function requestFieldsFromActiveTab() {
  const response = await chrome.runtime.sendMessage({ type: 'FIELDS_SCAN_REQUEST' })
  return response?.ok !== false
}

function buildFieldCard(field) {
  const card = document.createElement('div')
  card.className = 'field-card'
  card.dataset.fieldId = field.fieldId

  const question = document.createElement('div')
  question.className = 'field-question'
  question.textContent = field.questionText

  const meta = document.createElement('div')
  meta.className = 'field-meta'
  meta.textContent = field.matchedAnswer
    ? `Bank match ${(field.similarity * 100).toFixed(0)}%`
    : 'No bank match yet'

  const answerWrap = document.createElement('div')
  answerWrap.className = 'field-answer-wrap'

  const textarea = document.createElement('textarea')
  textarea.className = 'field-answer-input'
  textarea.placeholder = 'Answer will appear here…'
  textarea.rows = 5

  const initialValue = generatedAnswers[field.fieldId] || field.matchedAnswer || ''
  if (initialValue) {
    textarea.value = initialValue
    card.classList.add(generatedAnswers[field.fieldId] ? 'has-generated' : 'has-match')
  }

  textarea.addEventListener('input', () => {
    generatedAnswers[field.fieldId] = textarea.value
  })

  const actions = document.createElement('div')
  actions.className = 'field-actions'

  const generateBtn = document.createElement('button')
  generateBtn.className = 'btn-primary btn-xs'
  generateBtn.textContent = 'Generate'
  generateBtn.addEventListener('click', () => generateOne(field, textarea, generateBtn))

  const fillBtn = document.createElement('button')
  fillBtn.className = 'btn-secondary btn-xs'
  fillBtn.textContent = 'Fill field'
  fillBtn.addEventListener('click', () => fillOne(field.fieldId, textarea.value))

  const saveBtn = document.createElement('button')
  saveBtn.className = 'btn-ghost btn-xs'
  saveBtn.textContent = 'Save to bank'
  saveBtn.addEventListener('click', () => saveToBank(field.questionText, textarea.value))

  actions.appendChild(generateBtn)
  actions.appendChild(fillBtn)
  actions.appendChild(saveBtn)
  answerWrap.appendChild(textarea)
  answerWrap.appendChild(actions)

  card.appendChild(question)
  card.appendChild(meta)
  card.appendChild(answerWrap)
  return card
}

function renderFields(fields) {
  const container = $('panel-fields')
  clearEl(container)
  fields.forEach((field) => container.appendChild(buildFieldCard(field)))
}

async function generateOne(field, textarea, button) {
  const original = button.textContent
  button.textContent = 'Working…'
  button.disabled = true

  const answer = await chrome.runtime.sendMessage({
    type: 'GENERATE_REQUEST',
    question: field.questionText,
    matchedAnswer: field.matchedAnswer || null,
  })

  if (answer) {
    textarea.value = answer
    generatedAnswers[field.fieldId] = answer
    textarea.closest('.field-card')?.classList.add('has-generated')
  } else {
    textarea.placeholder = 'Generation failed. Check your saved token and BYOK integration.'
  }

  button.textContent = original
  button.disabled = false
}

async function generateAll() {
  $('generating-label').textContent = 'AQUA is drafting…'
  showSection('generating')

  const results = await chrome.runtime.sendMessage({
    type: 'GENERATE_BULK_REQUEST',
    fields: detectedFields.map((field) => ({
      fieldId: field.fieldId,
      questionText: field.questionText,
      matchedAnswer: generatedAnswers[field.fieldId] || field.matchedAnswer || null,
    })),
  })

  ;(results || []).forEach(({ fieldId, answer }) => {
    if (answer) generatedAnswers[fieldId] = answer
  })

  showSection('main')
  renderFields(detectedFields)
}

async function fillOne(fieldId, text) {
  if (!normalizeText(text)) return
  await chrome.runtime.sendMessage({
    type: 'FILL_FIELD_REQUEST',
    tabId: activeTabId,
    fieldId,
    text,
  })
}

async function fillAllMatched() {
  const fills = detectedFields
    .map((field) => ({
      fieldId: field.fieldId,
      text: generatedAnswers[field.fieldId] || field.matchedAnswer || '',
    }))
    .filter((fill) => normalizeText(fill.text))

  if (fills.length === 0) return

  await chrome.runtime.sendMessage({
    type: 'FILL_BULK_REQUEST',
    tabId: activeTabId,
    fills,
  })
}

async function saveToBank(questionText, answerText) {
  if (!normalizeText(answerText)) return
  const response = await chrome.runtime.sendMessage({
    type: 'CAPTURE_SAVE_ANSWER',
    questionText,
    answerText,
  })

  if (settings.mode === 'automation') {
    setAutomationFeedback(
      response?.saved
        ? 'Saved this answer back to your bank.'
        : `Save skipped: ${response?.reason || 'unknown result'}.`,
      response?.saved ? 'success' : 'muted'
    )
  }
}

async function exportMd() {
  await chrome.runtime.sendMessage({
    type: 'EXPORT_MARKDOWN_REQUEST',
    tabId: activeTabId,
  })
}

function updateFieldContext(fields, pageTitle, tabId) {
  detectedFields = fields || []
  activeTabId = tabId || activeTabId

  $('panel-page-title').textContent = pageTitle || ''
  $('panel-field-count').textContent = `${detectedFields.length} field${detectedFields.length === 1 ? '' : 's'}`

  showSection(detectedFields.length > 0 ? 'main' : 'idle')
  renderFields(detectedFields)
}

function renderSmartMatcherResults(items) {
  const container = $('smart-matcher-results')
  clearEl(container)

  if (!items || items.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'callout callout-muted'
    empty.textContent = 'No Smart Matcher results came back for this pass.'
    container.appendChild(empty)
    return
  }

  items.forEach((item) => {
    const card = document.createElement('div')
    card.className = 'smart-match-card'

    const title = document.createElement('div')
    title.className = 'smart-match-title'
    title.textContent = item.entity_name || item.entity || 'Suggested program'

    const meta = document.createElement('div')
    meta.className = 'smart-match-meta'
    meta.textContent = `Fit ${(Number(item.fit_score || 0) * 100).toFixed(0)}% • Significance ${(Number(item.significance_score || 0) * 100).toFixed(0)}%`

    const why = document.createElement('div')
    why.className = 'smart-match-why'
    why.textContent = item.reasoning_snippet || 'Strong alignment with your current answer bank.'

    card.appendChild(title)
    card.appendChild(meta)
    card.appendChild(why)
    container.appendChild(card)
  })
}

async function runCaptureToHub() {
  setAutomationFeedback('Capturing this page into Canonical Hub…')
  const response = await chrome.runtime.sendMessage({
    type: 'CANONICAL_INGEST_REQUEST',
    tabId: activeTabId,
    vertical: 'founder',
  })

  if (response?.error) {
    setAutomationFeedback(response.error, 'error')
    return
  }

  setAutomationFeedback('Canonical capture sent. Review and qualification can continue in the hub.', 'success')
}

async function runSmartMatcher() {
  setAutomationFeedback('Running Smart Matcher against your current persona…')
  const response = await chrome.runtime.sendMessage({
    type: 'SMART_MATCHER_REQUEST',
    vertical: 'founder',
    matchLimit: 5,
  })

  if (response?.error) {
    setAutomationFeedback(response.error, 'error')
    renderSmartMatcherResults([])
    return
  }

  const results = response?.results || response?.matches || response?.recommendations || []
  renderSmartMatcherResults(results)
  setAutomationFeedback('Smart Matcher finished. Review the strongest-fit opportunities below.', 'success')
}

async function runBulkAssist() {
  const matched = detectedFields.filter((field) => normalizeText(generatedAnswers[field.fieldId] || field.matchedAnswer)).length
  const total = detectedFields.length
  const fidelityValues = detectedFields
    .filter((field) => normalizeText(generatedAnswers[field.fieldId] || field.matchedAnswer))
    .map((field) => Number(field.similarity || 0))
  const avgFidelity = fidelityValues.length
    ? fidelityValues.reduce((sum, value) => sum + value, 0) / fidelityValues.length
    : 0

  const response = await chrome.runtime.sendMessage({
    type: 'AUTOFILL_ASSESS_REQUEST',
    programQuestionCount: total,
    matchedAnswerCount: matched,
    avgFidelity,
    outcomesAvailable: false,
  })

  if (response?.error) {
    setAutomationFeedback(response.error, 'error')
    return
  }

  const coveragePct = `${Math.round((response.coverage || 0) * 100)}%`
  const fidelityPct = `${Math.round((response.avg_fidelity || 0) * 100)}%`

  if (response.level_1_manual_prefill) {
    await fillAllMatched()
    setAutomationFeedback(`Bulk Assist filled the matched answers. Coverage ${coveragePct}, average fidelity ${fidelityPct}.`, 'success')
    return
  }

  setAutomationFeedback(`Bulk Assist held the line. Coverage is ${coveragePct} with ${fidelityPct} average fidelity, below the manual prefill threshold.`, 'muted')
}

async function connectFromPanel() {
  const jwt = $('panel-jwt').value.trim()
  const hubUrl = $('panel-hub-url').value.trim() || DEFAULT_SETTINGS.hubUrl
  if (!jwt) return

  await saveSettings({ jwt, hubUrl })
  setStatus(true)
  showSection('idle')
  await requestFieldsFromActiveTab()
}

async function switchMode(mode) {
  const next = mode === 'automation'
    ? { mode: 'automation', automationEnabled: true }
    : { mode: 'manual' }
  await saveSettings(next)

  if (settings.mode === 'automation' && !settings.automationEnabled) {
    setAutomationFeedback('Automation Assist is waiting for you to enable it from the popup.', 'muted')
  }

  setModeBadge()
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FIELDS_RESULTS_READY') {
    updateFieldContext(message.fields, message.pageTitle, message.tabId)
  }

  if (message.type === 'FIELDS_CONTEXT_RESET') {
    detectedFields = []
    generatedAnswers = {}
    activeTabId = message.tabId || null
    showSection('idle')
  }
})

$('panel-connect-btn').addEventListener('click', connectFromPanel)
$('btn-generate-all').addEventListener('click', generateAll)
$('btn-fill-matched').addEventListener('click', fillAllMatched)
$('btn-export-md').addEventListener('click', exportMd)
$('btn-rescan').addEventListener('click', requestFieldsFromActiveTab)
$('btn-rescan-idle').addEventListener('click', requestFieldsFromActiveTab)
$('btn-open-hub-idle').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'APP_OPEN_HUB' }))
$('btn-capture-hub').addEventListener('click', runCaptureToHub)
$('btn-smart-matcher').addEventListener('click', runSmartMatcher)
$('btn-bulk-assist').addEventListener('click', runBulkAssist)
$('mode-manual').addEventListener('click', () => switchMode('manual'))
$('mode-automation').addEventListener('click', () => switchMode('automation'))

async function init() {
  const authenticated = await requestSettings()
  setStatus(authenticated)
  setModeBadge()
  $('panel-hub-url').value = settings.hubUrl

  if (!authenticated) {
    showSection('auth')
    return
  }

  if (settings.mode === 'automation') {
    setAutomationFeedback('Automation Assist is ready. Capture, match, or bulk assist from here.', 'muted')
  }

  showSection('idle')
  await requestFieldsFromActiveTab()
}

init()
