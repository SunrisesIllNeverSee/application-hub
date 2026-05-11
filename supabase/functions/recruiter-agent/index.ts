// Deploy with: supabase functions deploy recruiter-agent
// Schedule via Supabase Dashboard -> Edge Functions -> Schedule (weekly, e.g. Monday 9am UTC)
// or add to pg_cron in migration 027.
//
// This edge function calls POST /api/cron/recruiter with CRON_SECRET.
// All logic (fit queries, email sending, dedup) lives in the Next.js route.

const APP_URL = Deno.env.get('APP_URL') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

Deno.serve(async (_req: Request): Promise<Response> => {
  if (!APP_URL) {
    console.error('[recruiter-agent] APP_URL env var is not set')
    return new Response(JSON.stringify({ error: 'APP_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!CRON_SECRET) {
    console.error('[recruiter-agent] CRON_SECRET env var is not set')
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const resp = await fetch(`${APP_URL}/api/cron/recruiter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    })
    const body = await resp.json()
    if (!resp.ok) {
      console.error('[recruiter-agent] recruiter route returned error:', resp.status, body)
      return new Response(JSON.stringify({ error: body }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.log('[recruiter-agent] completed:', body)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[recruiter-agent] fetch error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
