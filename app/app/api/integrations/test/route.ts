import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/integrations/test
 *
 * Pings an AI provider with the given config to verify reachability.
 * Used by the integrations page before saving — gives the user a real
 * signal instead of the silent "saved = connected" lie.
 *
 * Body: { provider, api_key?, base_url?, model? }
 * Returns: 200 { ok: true, info?: string } on success
 *          200 { ok: false, error: string } on reachability/auth failure (NOT 500)
 *          400 on bad input, 401 on unauthorized
 *
 * Why 200 even on provider failure: makes it easy for the client to show
 * the error inline without parsing different HTTP error shapes. The 200 means
 * "we successfully completed the test" — `ok` tells you the outcome.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const provider = String(body.provider ?? '')
    const apiKey = String(body.api_key ?? '').trim()
    const baseUrl = String(body.base_url ?? '').trim()
    const model = String(body.model ?? '').trim()

    if (!['ollama', 'openai', 'anthropic', 'google'].includes(provider)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    // Per-provider reachability probe.
    if (provider === 'ollama') {
      const url = (baseUrl || apiKey || 'http://localhost:11434').replace(/\/$/, '')
      const result = await pingOllama(url)
      return NextResponse.json(result)
    }

    if (provider === 'openai') {
      if (!apiKey) return NextResponse.json({ ok: false, error: 'API key required' })
      const url = (baseUrl || 'https://api.openai.com').replace(/\/$/, '') + '/v1/models'
      return NextResponse.json(await pingBearer(url, apiKey))
    }

    if (provider === 'anthropic') {
      if (!apiKey) return NextResponse.json({ ok: false, error: 'API key required' })
      // Anthropic doesn't expose a no-cost list-models endpoint without auth.
      // Cheapest test: 1-token message. Costs ~$0.000003.
      return NextResponse.json(await pingAnthropic(apiKey, model || 'claude-haiku-4-5-20251001'))
    }

    if (provider === 'google') {
      if (!apiKey) return NextResponse.json({ ok: false, error: 'API key required' })
      const url = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
        + `/v1beta/models?key=${encodeURIComponent(apiKey)}`
      return NextResponse.json(await pingGoogle(url))
    }

    return NextResponse.json({ error: 'Unhandled provider' }, { status: 400 })
  } catch (err) {
    console.error('[/api/integrations/test] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function isPrivateUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/i.test(url)
}

async function pingOllama(baseUrl: string): Promise<{ ok: boolean; info?: string; error?: string }> {
  const isPrivate = isPrivateUrl(baseUrl)
  // If the test ran on production (Vercel) and the user pointed at a private URL,
  // there's no way for the serverless function to reach it — regardless of whether
  // we hit ECONNREFUSED, timeout, or something else. Give the tunnel hint upfront.
  const onProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  const productionPrivateHint = isPrivate && onProduction
    ? ` The live site cannot reach private/localhost URLs — Vercel runs the test in the cloud, not on your machine. Expose Ollama via a tunnel (ngrok, Tailscale Funnel, Cloudflare Tunnel) and save the public https URL.`
    : ''

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: ctrl.signal,
      // ngrok free tier serves an HTML interstitial unless this header is present.
      // Include it unconditionally — harmless for non-ngrok URLs.
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
    clearTimeout(timer)
    if (!resp.ok) {
      return { ok: false, error: `Ollama returned ${resp.status} — check the URL is correct and the Ollama server is running.${productionPrivateHint}` }
    }
    type TagsResp = { models?: { name: string }[] }
    const data = (await resp.json().catch(() => ({}))) as TagsResp
    const models = (data.models ?? []).map((m) => m.name)
    if (models.length === 0) {
      return { ok: true, info: 'Ollama is reachable, but no models are pulled yet. Run `ollama pull llama3.1:8b` (or similar) before drafting.' }
    }
    return { ok: true, info: `Ollama reachable. ${models.length} model${models.length === 1 ? '' : 's'} pulled: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '…' : ''}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (isPrivate && onProduction) {
      return { ok: false, error: `Cannot reach ${baseUrl} from the live site.${productionPrivateHint}` }
    }
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, error: `Timed out reaching ${baseUrl}. Check the URL and that Ollama is responsive.` }
    }
    if (/ECONNREFUSED|fetch failed/i.test(msg)) {
      return { ok: false, error: `Connection refused at ${baseUrl}. Is Ollama running? Try \`ollama serve\` first.` }
    }
    return { ok: false, error: msg }
  }
}

async function pingBearer(url: string, apiKey: string): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (resp.status === 401) return { ok: false, error: 'Authentication failed — check your API key.' }
    if (resp.status === 403) return { ok: false, error: 'Forbidden — key may be valid but lacks model permissions.' }
    if (!resp.ok) return { ok: false, error: `Provider returned ${resp.status}` }
    type ModelsResp = { data?: { id: string }[] }
    const data = (await resp.json().catch(() => ({}))) as ModelsResp
    const count = data.data?.length ?? 0
    return { ok: true, info: count > 0 ? `Connected. ${count} model${count === 1 ? '' : 's'} available.` : 'Connected.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: msg }
  }
}

async function pingAnthropic(apiKey: string, model: string): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    })
    clearTimeout(timer)
    if (resp.status === 401) return { ok: false, error: 'Authentication failed — check your API key.' }
    if (resp.status === 404) return { ok: false, error: `Model "${model}" not found for this account.` }
    if (!resp.ok) {
      type ErrShape = { error?: { message?: string } }
      const body = (await resp.json().catch(() => ({}))) as ErrShape
      return { ok: false, error: body.error?.message ?? `Anthropic returned ${resp.status}` }
    }
    return { ok: true, info: `Connected. Model "${model}" responding.` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: msg }
  }
}

async function pingGoogle(url: string): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const resp = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (resp.status === 401 || resp.status === 403) return { ok: false, error: 'Authentication failed — check your API key.' }
    if (!resp.ok) return { ok: false, error: `Google returned ${resp.status}` }
    type ModelsResp = { models?: { name: string }[] }
    const data = (await resp.json().catch(() => ({}))) as ModelsResp
    const count = data.models?.length ?? 0
    return { ok: true, info: count > 0 ? `Connected. ${count} model${count === 1 ? '' : 's'} available.` : 'Connected.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: msg }
  }
}
