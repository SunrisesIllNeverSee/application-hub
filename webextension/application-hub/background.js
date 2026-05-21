const DEFAULT_SETTINGS = {
  hubUrl: 'https://mos2es.xyz',
  jwt: '',
  mode: 'manual',
  automationEnabled: false,
  lastActiveTab: null,
}

function normalizeHubUrl(hubUrl) {
  return (hubUrl || DEFAULT_SETTINGS.hubUrl).replace(/\/$/, '')
}

async function getSettings() {
  const raw = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS))
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    hubUrl: normalizeHubUrl(raw.hubUrl),
    mode: raw.mode === 'automation' ? 'automation' : 'manual',
    automationEnabled: Boolean(raw.automationEnabled),
  }
}

async function saveSettings(partial) {
  const next = { ...(await getSettings()), ...partial }
  if (partial.hubUrl !== undefined) next.hubUrl = normalizeHubUrl(partial.hubUrl)
  if (partial.mode !== undefined) next.mode = partial.mode === 'automation' ? 'automation' : 'manual'
  if (partial.automationEnabled !== undefined) next.automationEnabled = Boolean(partial.automationEnabled)
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
      model: 'claude-sonnet-4-6',
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
      model: 'gpt-4o',
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

async function generateAnswer(question, matchedAnswer) {
  const { hubUrl, jwt } = await getSettings()
  if (!jwt) return null

  const byok = await fetchByokKey(jwt, hubUrl)
  if (!byok?.key) return null

  const system = `You are AQUA, an AI assistant that helps people write compelling application answers.
You have access to the user's existing answer bank. When given a question and an existing answer,
improve and tailor it. When given only a question, write a strong draft.
Be concise, authentic, and specific. Never generic. Max 300 words unless the question implies more.`

  const prompt = matchedAnswer
    ? `Question: ${question}\n\nExisting answer from my bank:\n${matchedAnswer}\n\nImprove and tailor this for the current application.`
    : `Question: ${question}\n\nWrite a strong, authentic answer for this application question.`

  try {
    if (byok.provider === 'anthropic') return await callAnthropic(byok.key, system, prompt)
    if (byok.provider === 'openai') return await callOpenAI(byok.key, system, prompt)
    return null
  } catch {
    return null
  }
}

async function captureAnswer(questionText, answerText) {
  const { hubUrl, jwt } = await getSettings()
  if (!jwt) return { saved: false, reason: 'unauthorized' }

  try {
    const res = await fetch(`${hubUrl}/api/answers/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ questionText, answerText }),
    })

    return await res.json().catch(() => ({ saved: false, reason: 'invalid_response' }))
  } catch {
    return { saved: false, reason: 'network_error' }
  }
}

async function requestPageCapture(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_PAGE_REQUEST' })
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
      return generateAnswer(message.question, message.matchedAnswer)
    }

    if (message.type === 'GENERATE_BULK_REQUEST') {
      return Promise.all(
        (message.fields || []).map(async (field) => ({
          fieldId: field.fieldId,
          answer: await generateAnswer(field.questionText, field.matchedAnswer || null),
        }))
      )
    }

    if (message.type === 'FILL_FIELD_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) return { ok: false, error: 'No active application tab.' }
      await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_FIELD_REQUEST',
        fieldId: message.fieldId,
        text: message.text,
      })
      return { ok: true }
    }

    if (message.type === 'FILL_BULK_REQUEST') {
      const tabId = message.tabId || (await getSettings()).lastActiveTab
      if (!tabId) return { ok: false, error: 'No active application tab.' }
      await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_BULK_REQUEST',
        fills: message.fills || [],
      })
      return { ok: true }
    }

    if (message.type === 'CAPTURE_SAVE_ANSWER') {
      return captureAnswer(message.questionText, message.answerText)
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

      const capture = await requestPageCapture(tabId)
      return hubFetch('/api/hub/ingest', {
        vertical: message.vertical || 'founder',
        entity: capture?.entity || message.entity || 'Captured application',
        source: capture?.url || message.source || null,
        content: capture?.content || '',
        metadata: {
          url: capture?.url || null,
          title: capture?.title || null,
          questions: capture?.questions || [],
          mode: (await getSettings()).mode,
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
