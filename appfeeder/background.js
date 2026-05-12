/**
 * background.js — Service worker
 *
 * Calls mos2es.xyz/api/match-question with the user's JWT.
 * The API handles embedding generation + pgvector semantic search
 * against the archived_questions table, then joins with the user's
 * saved answers. Extension only stores credentials — no local matching logic.
 */

const APP_URL = 'https://mos2es.xyz'

async function getAuth() {
  return new Promise(resolve => {
    chrome.storage.local.get(['jwt', 'anonKey'], resolve)
  })
}

async function matchQuestions(questions) {
  const { jwt } = await getAuth()
  if (!jwt) return []

  // Call each question through the semantic match API
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
          matchedAnswer: top?.user_answer ?? null,
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
  } catch {
    // Silent — capture is best-effort
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MATCH_QUESTIONS') {
    matchQuestions(message.questions).then(sendResponse)
    return true // async response
  }

  if (message.type === 'CHECK_AUTH') {
    getAuth().then(({ jwt }) => {
      sendResponse({ authenticated: !!jwt })
    })
    return true
  }

  if (message.type === 'CAPTURE_ANSWER') {
    captureAnswer(message.questionText, message.answerText)
    // Fire-and-forget — no sendResponse needed
  }
})
