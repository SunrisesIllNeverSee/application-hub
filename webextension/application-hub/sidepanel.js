/**
 * sidepanel.js — AQUA agent panel
 *
 * Receives detected fields from content.js via background.
 * Generates tailored answers using the user's BYOK key.
 * Sends fill commands back to content.js.
 */

const APP_URL = 'https://mos2es.xyz'

// ── State ─────────────────────────────────────────────────────────────────────

let detectedFields = []
let generatedAnswers = {}
let activeTabId = null

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id)

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

const sections = {
  auth:       $('panel-auth'),
  idle:       $('panel-idle'),
  main:       $('panel-main'),
  generating: $('panel-generating'),
}

function showSection(name) {
  Object.entries(sections).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name)
  })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getJwt() {
  return new Promise(resolve => chrome.storage.local.get(['jwt'], r => resolve(r.jwt || null)))
}

async function checkAuth() {
  const jwt = await getJwt()
  const dot = $('panel-status')
  if (jwt) { dot.classList.add('connected'); return true }
  dot.classList.remove('connected')
  showSection('auth')
  return false
}

$('panel-connect-btn').addEventListener('click', async () => {
  const val = $('panel-jwt').value.trim()
  if (!val) return
  await chrome.storage.local.set({ jwt: val })
  $('panel-status').classList.add('connected')
  showSection('idle')
  requestFieldsFromActiveTab()
})

// ── Field rendering ───────────────────────────────────────────────────────────

function buildFieldCard(field) {
  const card = document.createElement('div')
  card.className = 'field-card'
  card.dataset.fieldId = field.fieldId

  const q = document.createElement('div')
  q.className = 'field-question'
  q.textContent = field.questionText

  const answerWrap = document.createElement('div')
  answerWrap.className = 'field-answer-wrap'

  const textarea = document.createElement('textarea')
  textarea.className = 'field-answer-input'
  textarea.placeholder = 'Answer will appear here…'
  textarea.rows = 4

  const savedText = generatedAnswers[field.fieldId] || field.matchedAnswer || ''
  if (savedText) {
    textarea.value = savedText
    card.classList.add(generatedAnswers[field.fieldId] ? 'has-generated' : 'has-match')
  }

  textarea.addEventListener('input', () => {
    generatedAnswers[field.fieldId] = textarea.value
  })

  const actions = document.createElement('div')
  actions.className = 'field-actions'

  const generateBtn = document.createElement('button')
  generateBtn.className = 'btn-aqua btn-xs'
  generateBtn.textContent = '✦ Generate'
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
  card.appendChild(q)
  card.appendChild(answerWrap)
  return card
}

function renderFields(fields) {
  const container = $('panel-fields')
  clearEl(container)
  fields.forEach(f => container.appendChild(buildFieldCard(f)))
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generateOne(field, textarea, btn) {
  const original = btn.textContent
  btn.textContent = '…'
  btn.disabled = true

  const answer = await chrome.runtime.sendMessage({
    type: 'GENERATE_ANSWER',
    question: field.questionText,
    matchedAnswer: field.matchedAnswer || null,
  })

  if (answer) {
    textarea.value = answer
    generatedAnswers[field.fieldId] = answer
    textarea.closest('.field-card').classList.add('has-generated')
  } else {
    textarea.placeholder = 'Generation failed — check your API key in Profile → Settings.'
  }

  btn.textContent = original
  btn.disabled = false
}

async function generateAll() {
  $('generating-label').textContent = 'AQUA is thinking…'
  showSection('generating')

  const results = await chrome.runtime.sendMessage({
    type: 'GENERATE_ALL',
    fields: detectedFields.map(f => ({
      fieldId: f.fieldId,
      questionText: f.questionText,
      matchedAnswer: f.matchedAnswer || null,
    })),
  })

  if (results) {
    results.forEach(({ fieldId, answer }) => {
      if (answer) generatedAnswers[fieldId] = answer
    })
  }

  showSection('main')
  renderFields(detectedFields)
}

// ── Fill ──────────────────────────────────────────────────────────────────────

function fillOne(fieldId, text) {
  if (!text.trim() || !activeTabId) return
  chrome.tabs.sendMessage(activeTabId, { type: 'FILL_FIELD', fieldId, text })
}

function fillAllMatched() {
  if (!activeTabId) return
  const fills = detectedFields
    .filter(f => f.matchedAnswer || generatedAnswers[f.fieldId])
    .map(f => ({ fieldId: f.fieldId, text: generatedAnswers[f.fieldId] || f.matchedAnswer }))
  if (fills.length) chrome.tabs.sendMessage(activeTabId, { type: 'FILL_FIELDS', fills })
}

// ── Save to bank ──────────────────────────────────────────────────────────────

async function saveToBank(questionText, answerText) {
  if (!answerText.trim()) return
  await chrome.runtime.sendMessage({ type: 'CAPTURE_ANSWER', questionText, answerText })
}

// ── Export MD ─────────────────────────────────────────────────────────────────

function exportMd() {
  if (!activeTabId) return
  chrome.tabs.sendMessage(activeTabId, { type: 'EXPORT_MD' })
}

// ── Messages from background ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FIELDS_DETECTED') {
    detectedFields = msg.fields
    activeTabId = msg.tabId

    const titleEl = $('panel-page-title')
    const countEl = $('panel-field-count')
    titleEl.textContent = msg.pageTitle || ''
    countEl.textContent = `${msg.fields.length} field${msg.fields.length !== 1 ? 's' : ''}`

    showSection(msg.fields.length > 0 ? 'main' : 'idle')
    renderFields(detectedFields)
  }

  if (msg.type === 'TAB_CHANGED') {
    detectedFields = []
    generatedAnswers = {}
    activeTabId = msg.tabId
    showSection('idle')
  }
})

// ── Button wiring ─────────────────────────────────────────────────────────────

$('btn-generate-all').addEventListener('click', generateAll)
$('btn-fill-matched').addEventListener('click', fillAllMatched)
$('btn-export-md').addEventListener('click', exportMd)

// ── Init ──────────────────────────────────────────────────────────────────────

async function requestFieldsFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return
  activeTabId = tab.id
  chrome.tabs.sendMessage(tab.id, { type: 'GET_FIELDS' }, () => {
    if (chrome.runtime.lastError) { /* tab not ready yet */ }
  })
}

async function init() {
  const authed = await checkAuth()
  if (!authed) return
  showSection('idle')
  requestFieldsFromActiveTab()
}

init()
