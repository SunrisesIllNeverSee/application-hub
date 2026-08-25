import { NextRequest, NextResponse } from 'next/server'

// POST /api/indexnow
// Forwards URL submission to IndexNow API for Bing, DuckDuckGo, Yandex, Seznam.
// Accepts a JSON body: { urls: ["https://mos2es.xyz/faq", ...] }
// Or a single URL string: "https://mos2es.xyz/faq"
// Only mos2es.xyz URLs are accepted — this endpoint is not a proxy for arbitrary domains.

const INDEXNOW_KEY = 'f1f880e1830342be8c1180ee9a7cfb41'
const HOST = 'mos2es.xyz'
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS = 10000

export async function POST(request: NextRequest) {
  let urls: string[]

  try {
    const body = await request.json()
    if (typeof body === 'string') {
      urls = [body]
    } else if (Array.isArray(body?.urls)) {
      urls = body.urls
    } else if (typeof body?.url === 'string') {
      urls = [body.url]
    } else {
      return NextResponse.json(
        { error: 'Expected { urls: string[] } or { url: string } or a string' },
        { status: 400 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No URLs provided' }, { status: 400 })
  }

  // Validate: only mos2es.xyz URLs, reject anything else
  const validUrls: string[] = []
  const rejected: string[] = []
  for (const u of urls) {
    if (typeof u !== 'string') {
      rejected.push(String(u))
      continue
    }
    try {
      const parsed = new URL(u)
      if (parsed.hostname === HOST || parsed.hostname === `www.${HOST}`) {
        validUrls.push(u)
      } else {
        rejected.push(u)
      }
    } catch {
      rejected.push(u)
    }
  }

  if (validUrls.length === 0) {
    return NextResponse.json(
      { error: `No valid ${HOST} URLs provided`, rejected },
      { status: 400 },
    )
  }

  if (validUrls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `Too many URLs: ${validUrls.length} (max ${MAX_URLS})` },
      { status: 413 },
    )
  }

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: validUrls,
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    // IndexNow returns 200 (OK) or 202 (Accepted) on success
    if (response.status === 200 || response.status === 202) {
      return NextResponse.json({
        status: 'submitted',
        count: validUrls.length,
        rejected: rejected.length > 0 ? rejected : undefined,
      })
    }

    // 422 = invalid key, 429 = too many requests, etc.
    return NextResponse.json(
      {
        error: 'IndexNow API rejected the submission',
        status: response.status,
        rejected: rejected.length > 0 ? rejected : undefined,
      },
      { status: response.status === 429 ? 429 : 502 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach IndexNow API', detail: String(err) },
      { status: 502 },
    )
  }
}

// GET /api/indexnow — returns the IndexNow key and status for verification
export async function GET() {
  return NextResponse.json({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    endpoint: INDEXNOW_ENDPOINT,
    status: 'active',
  })
}
