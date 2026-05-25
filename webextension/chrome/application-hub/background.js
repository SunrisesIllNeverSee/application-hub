// ============================================================
// AQUA Application Hub — Background Service Worker
// ============================================================
// Handles auth, MCP queries to /api/match-question, and caching.
// Manifest V3 service worker — stateless between wake-ups.
// ============================================================

const API_BASE = 'https://mos2es.xyz'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── In-memory cache (cleared on service worker restart) ──────────────────────

const matchCache = new Map()

function getCacheKey(text) {
  return text.toLowerCase().trim().slice(0, 200)
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAuthToken() {
  const { aqua_session } = await chrome.storage.local.get('aqua_session')
  if (!aqua_session?.access_token) return null

  // Check expiry
  if (aqua_session.expires_at && Date.now() / 1000 > aqua_session.expires_at) {
    // Try refresh
    const refreshed = await refreshToken(aqua_session.refresh_token)
    return refreshed?.access_token ?? null
  }

  return aqua_session.access_token
}

async function refreshToken(refreshToken) {
  try {
    const res = await fetch(`${API_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const session = await res.json()
    await chrome.storage.local.set({ aqua_session: session })
    return session
  } catch {
    return null
  }
}

// ─── Match question API ───────────────────────────────────────────────────────

async function matchQuestion(text) {
  const cacheKey = getCacheKey(text)

  // Check cache
  const cached = matchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  const token = await getAuthToken()
  if (!token) {
    return { error: 'Not authenticated', matches: [] }
  }

  try {
    const res = await fetch(`${API_BASE}/api/match-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ text, limit: 3 }),
    })

    if (!res.ok) {
      if (res.status === 401) {
        // Clear stale session
        await chrome.storage.local.remove('aqua_session')
        return { error: 'Session expired', matches: [] }
      }
      return { error: `API error: ${res.status}`, matches: [] }
    }

    const data = await res.json()

    // Cache the result
    matchCache.set(cacheKey, { data, ts: Date.now() })

    // Prune cache if too large
    if (matchCache.size > 200) {
      const oldest = [...matchCache.entries()]
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(0, 50)
      oldest.forEach(([key]) => matchCache.delete(key))
    }

    return data
  } catch (err) {
    return { error: err.message, matches: [] }
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'MATCH_QUESTION') {
    matchQuestion(msg.payload.text).then(sendResponse)
    return true // async response
  }

  if (msg.type === 'GET_STATUS') {
    getAuthToken().then(token => {
      sendResponse({
        authenticated: !!token,
        cacheSize: matchCache.size,
      })
    })
    return true
  }

  if (msg.type === 'SET_SESSION') {
    chrome.storage.local.set({ aqua_session: msg.payload }).then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'CLEAR_SESSION') {
    chrome.storage.local.remove('aqua_session').then(() => {
      matchCache.clear()
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'CLEAR_CACHE') {
    matchCache.clear()
    sendResponse({ ok: true })
    return false
  }
})

// ─── Extension install handler ────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AQUA] Extension installed')
  }
})
