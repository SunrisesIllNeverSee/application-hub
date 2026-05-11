// Deploy with: supabase functions deploy deadline-alerts
// Schedule via Supabase Dashboard -> Edge Functions -> Schedule (daily at 8am UTC).
//
// This edge function calls the Next.js API route POST /api/alerts/deadline-check
// with the CRON_SECRET so the route trusts the request. The actual deadline
// evaluation, alert deduplication, and Resend email delivery all happen inside
// the Next.js route -- this function is a thin cron trigger.

const APP_URL = Deno.env.get('APP_URL') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

Deno.serve(async (_req: Request): Promise<Response> => {
  if (!APP_URL) {
    console.error('[deadline-alerts] APP_URL env var is not set')
    return new Response(JSON.stringify({ error: 'APP_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!CRON_SECRET) {
    console.error('[deadline-alerts] CRON_SECRET env var is not set')
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const resp = await fetch(`${APP_URL}/api/alerts/deadline-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    })

    const body = await resp.json()

    if (!resp.ok) {
      console.error('[deadline-alerts] deadline-check returned error:', resp.status, body)
      return new Response(JSON.stringify({ error: body }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[deadline-alerts] completed:', body)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[deadline-alerts] fetch error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
