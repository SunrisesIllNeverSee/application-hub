/**
 * background.js — Service worker
 *
 * Responsibilities:
 * - Reads auth tokens from chrome.storage.local
 * - Makes Supabase REST calls to match questions against answer bank
 * - Responds to messages from content.js
 */

const SUPABASE_URL = 'https://betcyfbzsgusaghriptz.supabase.co'

async function getAuth() {
  return new Promise(resolve => {
    chrome.storage.local.get(['jwt', 'anonKey'], resolve)
  })
}

async function matchQuestions(questions) {
  const { jwt, anonKey } = await getAuth()
  if (!jwt || !anonKey) return []

  // Fetch user's saved answers
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profile_answers?select=id,question_text,answer_content,theme&limit=200`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }
  )
  if (!res.ok) return []
  const answers = await res.json()

  // TODO: replace with pgvector RPC call for semantic matching
  // For now: simple substring / keyword overlap
  return questions.map(q => {
    const questionLower = q.questionText.toLowerCase()
    let best = null
    let bestScore = 0

    for (const answer of answers) {
      const score = overlapScore(questionLower, (answer.question_text || '').toLowerCase())
      if (score > bestScore && score >= 0.3) {
        bestScore = score
        best = answer
      }
    }

    return {
      fieldId: q.fieldId,
      questionText: q.questionText,
      matchedAnswer: best,
      similarity: bestScore,
    }
  })
}

function overlapScore(a, b) {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let overlap = 0
  for (const w of wordsA) { if (wordsB.has(w)) overlap++ }
  return overlap / Math.max(wordsA.size, wordsB.size)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MATCH_QUESTIONS') {
    matchQuestions(message.questions).then(sendResponse)
    return true // async response
  }

  if (message.type === 'CHECK_AUTH') {
    getAuth().then(({ jwt, anonKey }) => {
      sendResponse({ authenticated: !!(jwt && anonKey) })
    })
    return true
  }
})
