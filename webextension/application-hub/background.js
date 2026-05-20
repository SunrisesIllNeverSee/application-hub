/**
 * background.js — Service worker
 *
 * Handles:
 * - Semantic question matching via /api/match-question
 * - Answer generation via user's BYOK key (Anthropic preferred, OpenAI fallback)
 * - Answer capture back to the answer bank
 * - Routing detected fields to the side panel
 * - Tab change notifications to the side panel
 */

const APP_URL = 'https://mos2es.xyz'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAuth() {
  return new Promise(resolve => chrome.storage.local.get(['jwt'], resolve))
}

// ── Match questions ───────────────────────────────────────────────────────────

async function matchQuestions(questions) {
  const { jwt } = await getAuth()
  if (!jwt) return []

  const results = await Promise.all(
    questions.map(async ({ fieldId, questionText }) => {
      try {
        const res = await fetch(`${APP_URL}/api/match-question`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ text: questionText, limit: 1 }),
        })
        if (!res.ok) return { fieldId, questionText, matchedAnswer: null, similarity: 0 }
        const { matches } = await res.json()
        const top = matches?.[0]
        return {
          fieldId,
          questionText,
          matchedAnswer: top?.user_answer?.answer_content ?? null,
          similarity: top?.similarity ?? 0,
          autoFillSafe: top?.auto_fill_safe ?? false,
        }
      } catch {
        return { fieldId, questionText, matchedAnswer: null, similarity: 0 }
      }
    })
  )
  return results
}

// ── BYOK key fetch ────────────────────────────────────────────────────────────

async function fetchByokKey(jwt) {
  try {
    const res = await fetch(`${APP_URL}/api/integrations/key`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!res.ok) return null
    return await res.json() // { provider, key }
  } catch {
    return null
  }
}

// ── Answer generation ─────────────────────────────────────────────────────────

async function generateAnswer(question, matchedAnswer) {
  const { jwt } = await getAuth()
  if (!jwt) return null

  const byok = await fetchByokKey(jwt)
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

// ── Capture answer back to bank ───────────────────────────────────────────────

async function captureAnswer(questionText, answerText) {
  const { jwt } = await getAuth()
  if (!jwt) return
  try {
    await fetch(`${APP_URL}/api/answers/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ questionText, answerText }),
    })
  } catch { /* best-effort */ }
}

// ── Route detected fields → side panel ───────────────────────────────────────

async function routeFieldsToPanel(tabId, pageTitle, rawFields) {
  const matched = await matchQuestions(rawFields)
  chrome.runtime.sendMessage({
    type: 'FIELDS_DETECTED',
    fields: matched,
    tabId,
    pageTitle,
  }).catch(() => { /* panel not open */ })
}

// ── Tab activated — tell panel to reset ──────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ type: 'TAB_CHANGED', tabId }).catch(() => {})
})

// ── Toolbar click → open side panel (Chrome/Firefox native, Safari injected) ──

chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel) {
    // Chrome 114+
    chrome.sidePanel.open({ tabId: tab.id })
  } else if (chrome.sidebarAction) {
    // Firefox
    chrome.sidebarAction.open()
  } else {
    // Safari — trigger the injected iframe panel via content script
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_INJECTED_PANEL' })
  }
})

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'FIELDS_DETECTED_FROM_CONTENT') {
    const tabId = sender.tab?.id
    routeFieldsToPanel(tabId, message.pageTitle, message.fields)
    // Send matches back to content script for the quick overlay
    matchQuestions(message.fields).then(matches => {
      if (tabId) chrome.tabs.sendMessage(tabId, { type: 'MATCHES_READY', matches }).catch(() => {})
    })
    return false
  }

  if (message.type === 'MATCH_QUESTIONS') {
    matchQuestions(message.questions).then(sendResponse)
    return true
  }

  if (message.type === 'GENERATE_ANSWER') {
    generateAnswer(message.question, message.matchedAnswer).then(sendResponse)
    return true
  }

  if (message.type === 'GENERATE_ALL') {
    Promise.all(
      message.fields.map(async f => ({
        fieldId: f.fieldId,
        answer: await generateAnswer(f.questionText, f.matchedAnswer),
      }))
    ).then(sendResponse)
    return true
  }

  if (message.type === 'CAPTURE_ANSWER') {
    captureAnswer(message.questionText, message.answerText)
    return false
  }

  if (message.type === 'CHECK_AUTH') {
    getAuth().then(({ jwt }) => sendResponse({ authenticated: !!jwt }))
    return true
  }

  if (message.type === 'GET_FIELDS') {
    // Panel requesting a rescan — forward to the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.tabs.sendMessage(tab.id, { type: 'GET_FIELDS' }).catch(() => {})
    })
    return false
  }
})
