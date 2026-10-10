import {
  BYOK_EGRESS,
  buildConsentRecord,
  evaluateGenerateConsent,
  hubSyncOptedIn,
  isAllowedSenderOrigin,
  localFirstEnabled,
  senderOrigin,
  stripCaptureAnswerBodies,
} from './local-first.js'

const DEFAULT_SETTINGS = {
  hubUrl: 'https://aquaidp.xyz',
  agentUrl: 'http://127.0.0.1:4317',
  jwt: '',
  mode: 'manual',
  automationEnabled: false,
  lastActiveTab: null,
  // LF-13: local-first capture boundary. Default ON per mission privacy
  // posture — answer bodies never leave the device implicitly.
  localFirst: true,
  // Explicit opt-in: sync the local answer bank up to the hosted hub.
  syncToHub: false,
}

function normalizeHubUrl(hubUrl) {
  return (hubUrl || DEFAULT_SETTINGS.hubUrl).replace(/\/$/, '')
}

function normalizeAgentUrl(agentUrl) {
  return (agentUrl || DEFAULT_SETTINGS.agentUrl).replace(/\/$/, '')
}

async function getSettings() {
  const raw = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS))
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    hubUrl: normalizeHubUrl(raw.hubUrl),
    agentUrl: normalizeAgentUrl(raw.agentUrl),
    mode: raw.mode === 'automation' ? 'automation' : 'manual',
    automationEnabled: Boolean(raw.automationEnabled),
    localFirst: raw.localFirst !== false,
    syncToHub: raw.syncToHub === true,
  }
}

async function saveSettings(partial) {
  const next = { ...(await getSettings()), ...partial }
  if (partial.hubUrl !== undefined) next.hubUrl = normalizeHubUrl(partial.hubUrl)
  if (partial.agentUrl !== undefined) next.agentUrl = normalizeAgentUrl(partial.agentUrl)
  if (partial.mode !== undefined) next.mode = partial.mode === 'automation' ? 'automation' : 'manual'
  if (partial.automationEnabled !== undefined) next.automationEnabled = Boolean(partial.automationEnabled)
  if (partial.localFirst !== undefined) next.localFirst = partial.localFirst !== false
  if (partial.syncToHub !== undefined) next.syncToHub = partial.syncToHub === true
  await chrome.storage.local.set(next)
  return next
}

async function clearAuth() {
  const current = await getSettings()
  const next = {
    ...current,
    jwt: '',
    mode: 'manual',
    automationEnabled: false,
  }
  await chrome.storage.local.set(next)
  return next
}

async function withActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

async function openPanelForTab(tabId) {
  if (!tabId) return
  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId }).catch(() => {})
    return
  }
  if (chrome.sidebarAction?.open) {
    await chrome.sidebarAction.open().catch(() => {})
    return
  }
  await chrome.tabs.sendMessage(tabId, { type: 'OPEN_INJECTED_PANEL' }).catch(() => {})
}

async function hubFetch(path, body) {
  const { hubUrl, jwt } = await getSettings()
  if (!jwt) throw new Error('Paste your session token to use AQUA.')

  const res = await fetch(`${hubUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `AQUA request failed (${res.status})`)
  return payload
}

async function localAgentFetch(path, body) {
  const { agentUrl } = await getSettings()
  const res = await fetch(`${agentUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Local agent failed (${res.status})`)
  return payload
}

async function checkAuth() {
  const settings = await getSettings()
  return {
    authenticated: Boolean(settings.jwt),
    settings,
  }
}

async function matchQuestions(questions) {
  const { hubUrl, jwt } = await getSettings()
  if (!jwt || !Array.isArray(questions) || questions.length === 0) return []

  const results = await Promise.all(
    questions.map(async ({ fieldId, questionText, selector }) => {
      try {
        const res = await fetch(`${hubUrl}/api/match-question`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ text: questionText, limit: 1 }),
        })

        if (!res.ok) {
          return {
            fieldId,
            questionText,
            selector: selector || null,
            matchedAnswer: null,
            similarity: 0,
            autoFillSafe: false,
          }
        }

        const { matches } = await res.json()
        const top = matches?.[0]
        const matchedAnswer =
          top?.user_answer?.answer_content ??
          top?.user_answer?.content ??
          top?.answer_content ??
          null

        return {
          fieldId,
          questionText,
          selector: selector || null,
          matchedAnswer,
          similarity: Number(top?.similarity ?? 0),
          autoFillSafe: Boolean(top?.auto_fill_safe),
        }
      } catch {
        return {
          fieldId,
          questionText,
          selector: selector || null,
          matchedAnswer: null,
          similarity: 0,
          autoFillSafe: false,
        }
      }
    })
  )

  return results
}

async function fetchByokKey(jwt, hubUrl) {
  try {
    const res = await fetch(`${hubUrl}/api/integrations/key`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function callAnthropic(apiKey, system, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: BYOK_EGRESS.anthropic.model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.content?.[0]?.text ?? null
}

async function callOpenAI(apiKey, system, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: BYOK_EGRESS.openai.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? null
}

async function recordConsent(record) {
  const { consentLog = [] } = await chrome.storage.local.get('consentLog')
  consentLog.push(record)
  // Bound the log so storage stays small; receipts are also exportable later.
  await chrome.storage.local.set({ consentLog: consentLog.slice(-500) })
}

// LF-13: per-call user confirmation is required before any answer content
// egresses to a BYOK provider. The sidepanel must pass confirmEgress: true
// only after the user approves a dialog naming provider + model.
async function generateAnswer(question, matchedAnswer, confirmEgress) {
  const settings = await getSettings()
  const { hubUrl, jwt } = settings
  if (!jwt) return { answer: null, error: 'unauthorized' }

  const byok = await fetchByokKey(jwt, hubUrl)
  if (!byok?.key) return { answer: null, error: 'no_byok_key' }

  const egress = BYOK_EGRESS[byok.provider] || { model: 'unknown' }

  // Consent is evaluated after the BYOK lookup so a refusal can honestly name
  // the provider + model the call would have egressed to.
  const consent = evaluateGenerateConsent({ settings, confirmEgress })
  if (!consent.allowed) {
    return {
      answer: null,
      error: 'consent_required',
      provider: byok.provider,
      model: egress.model,
      consent,
    }
  }

  const system = `You are AQUA, an AI assistant that helps people write compelling application answers.
You have access to the user's existing answer bank. When given a question and an existing answer,
improve and tailor it. When given only a question, write a strong draft.
Be concise, authentic, and specific. Never generic. Max 300 words unless the question implies more.`

  const prompt = matchedAnswer
    ? `Question: ${question}\n\nExisting answer from my bank:\n${matchedAnswer}\n\nImprove and tailor this for the current application.`
    : `Question: ${question}\n\nWrite a strong, authentic answer for this application question.`

  try {
    let answer = null
    if (byok.provider === 'anthropic') answer = await callAnthropic(byok.key, system, prompt)
    if (byok.provider === 'openai') answer = await callOpenAI(byok.key, system, prompt)
    if (!answer) return { answer: null, error: 'provider_failed' }

    // Honest egress receipt: provider + model recorded at send time.
    await recordConsent(buildConsentRecord({
      provider: byok.provider,
      model: egress.model,
      kind: 'generate',
      questionText: question,
    }))

    return { answer, egress: { provider: byok.provider, model: egress.model } }
  } catch {
    return { answer: null, error: 'provider_error' }
  }
}

// LF-13: captures always land in the browser-local answer bank first. Hub
// sync happens only behind the explicit `syncToHub` opt-in.
async function saveToLocalBank(questionText, answerText, provenance) {
  const { localAnswerBank = [] } = await chrome.storage.local.get('localAnswerBank')
  localAnswerBank.push({
    id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionText,
    answerText,
    method: provenance || 'manual',
    savedAt: new Date().toISOString(),
    syncedToHub: false,
  })
  await chrome.storage.local.set({ localAnswerBank })
  return { saved: true, where: 'local' }
}

async function captureAnswer(questionText, answerText) {
  const settings = await getSettings()
  const { hubUrl, jwt } = settings

  const local = await saveToLocalBank(questionText, answerText, 'manual')

  if (!hubSyncOptedIn(settings)) {
    return { ...local, syncedToHub: false, reason: 'local_first' }
  }
  if (!jwt) return { ...local, syncedToHub: false, reason: 'unauthorized' }

  try {
    const res = await fetch(`${hubUrl}/api/answers/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ questionText, answerText }),
    })

    const payload = await res.json().catch(() => ({ saved: false, reason: 'invalid_response' }))
    return { ...local, syncedToHub: Boolean(payload?.saved), hub: payload }
  } catch {
    return { ...local, syncedToHub: false, reason: 'network_error' }
  }
}

async function requestPageCapture(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_PAGE_REQUEST' })
}

async function sendToLocalAgent(tabId) {
  if (!tabId) throw new Error('No active application tab.')
  const capture = await requestPageCapture(tabId)
  return localAgentFetch('/assist', capture)
}

async function routeFieldsToConsumers(tabId, pageTitle, rawFields) {
  const matched = await matchQuestions(rawFields)
  await saveSettings({ lastActiveTab: tabId ?? null })

  chrome.runtime.sendMessage({
    type: 'FIELDS_RESULTS_READY',
    fields: matched,
    pageTitle,
    tabId,
  }).catch(() => {})

  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'MATCH_RESULTS_READY',
      matches: matched,
    }).catch(() => {})
  }

  return matched
}

// LF-13: origin gate — only aquaidp.xyz (+ subdomains) and localhost dev
// origins may pass messages to this extension. Everything else is rejected.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = senderOrigin(sender)
  if (!isAllowedSenderOrigin(origin)) {
    sendResponse({ ok: false, error: 'origin_rejected' })
    return false
  }
  sendResponse({ ok: false, error: `Unknown external message type: ${message?.type}` })
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  }
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await saveSettings({ lastActiveTab: tabId })
  chrome.runtime.sendMessage({ type: 'FIELDS_CONTEXT_RESET', tabId }).catch(() => {})
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message.type === 'AUTH_SAVE_SETTINGS') {
      return saveSettings(message.settings || {})
    }

    if (message.type === 'AUTH_CLEAR') {
      return clearAuth()
    }

    if (message.type === 'AUTH_CHECK') {
      return checkAuth()
    }

    if (message.type === 'AUTH_OPEN_PANEL') {
      const tab = await withActiveTab()
      if (tab?.id) await openPanelForTab(tab.id)
      return { ok: Boolean(tab?.id) }
    }

    if (message.type === 'FIELDS_DETECTED_FROM_PAGE') {
      const tabId = sender.tab?.id ?? null
      return routeFieldsToConsumers(tabId, message.pageTitle, message.fields || [])
    }

    if (message.type === 'FIELDS_SCAN_REQUEST') {
      const tab = await withActiveTab()
      if (!tab?.id) return { ok: false, error: 'No active tab.' }
      await chrome.tabs.sendMessage(tab.id, { type: 'FIELDS_SCAN_REQUEST' })
      return { ok: true }
    }

    if (message.type === 'MATCH_REQUEST') {
      return matchQuestions(message.questions || [])
    }

    if (message.type === 'GENERATE_REQUEST') {
      return generateAnswer(message.question, message.matchedAnswer, message.confirmEgress === true)
    }

    if (message.type === 'GENERATE_BULK_REQUEST') {
      return Promise.all(
        (message.fields || []).map(async (field) => {
          const result = await generateAnswer(
            field.questionText,
            field.matchedAnswer || null,
            field.confirmEgress === true
          )
          return {
            fieldId: field.fieldId,
            answer: result.answer,
            error: result.error || null,
            provider: result.provider || null,
            model: result.model || null,
          }
        })
      )
    }

    if (message.type === 'FILL_FIELD_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) return { ok: false, error: 'No active application tab.' }
      // LF-13: require the caller to attest user initiation; FILL_* is an
      // egress write to a third-party form and must never be implicit.
      if (message.userInitiated !== true) {
        return { ok: false, error: 'user_action_required' }
      }
      await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_FIELD_REQUEST',
        fieldId: message.fieldId,
        text: message.text,
        userInitiated: true,
      })
      return { ok: true }
    }

    if (message.type === 'FILL_BULK_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) return { ok: false, error: 'No active application tab.' }
      if (message.userInitiated !== true) {
        return { ok: false, error: 'user_action_required' }
      }
      await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_BULK_REQUEST',
        fills: message.fills || [],
        userInitiated: true,
      })
      return { ok: true }
    }

    if (message.type === 'CAPTURE_SAVE_ANSWER') {
      return captureAnswer(message.questionText, message.answerText)
    }

    if (message.type === 'BANK_LOCAL_LIST') {
      const { localAnswerBank = [] } = await chrome.storage.local.get('localAnswerBank')
      return { entries: localAnswerBank }
    }

    if (message.type === 'EXPORT_MARKDOWN_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) return { ok: false, error: 'No active application tab.' }
      await chrome.tabs.sendMessage(tabId, { type: 'EXPORT_MARKDOWN_REQUEST' })
      return { ok: true }
    }

    if (message.type === 'CANONICAL_INGEST_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) throw new Error('No active application tab.')

      const settings = await getSettings()
      let capture = await requestPageCapture(tabId)

      // LF-13: under local-first, typed answer bodies in the page capture are
      // stripped before hub ingest. Labels/selectors still travel so the
      // canonical record stays useful; bodies stay on-device.
      if (localFirstEnabled(settings) && capture) {
        capture = stripCaptureAnswerBodies(capture)
      }

      return hubFetch('/api/hub/ingest', {
        vertical: message.vertical || 'founder',
        entity: capture?.entity || message.entity || 'Captured application',
        source: capture?.url || message.source || null,
        content: capture?.content || '',
        metadata: {
          url: capture?.url || null,
          title: capture?.title || null,
          questions: capture?.questions || [],
          mode: settings.mode,
          localFirst: localFirstEnabled(settings),
          redactedAnswers: capture?.redactedAnswers || 0,
        },
      })
    }

    if (message.type === 'SMART_MATCHER_REQUEST') {
      return hubFetch('/api/hub/smart-matcher', {
        vertical_filter: message.vertical || 'founder',
        match_limit: message.matchLimit || 5,
      })
    }

    if (message.type === 'AUTOFILL_ASSESS_REQUEST') {
      return hubFetch('/api/hub/autofill-eligibility', {
        program_question_count: message.programQuestionCount,
        matched_answer_count: message.matchedAnswerCount,
        avg_fidelity: message.avgFidelity,
        outcomes_available: Boolean(message.outcomesAvailable),
      })
    }

    if (message.type === 'AGENT_SEND_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      return sendToLocalAgent(tabId)
    }

    if (message.type === 'APP_OPEN_HUB') {
      const settings = await getSettings()
      await chrome.tabs.create({ url: `${settings.hubUrl}/applications` })
      return { ok: true }
    }

    return { ok: false, error: `Unknown message type: ${message.type}` }
  })()
    .then((payload) => sendResponse(payload))
    .catch((error) => sendResponse({ ok: false, error: error.message }))

  return true
})
