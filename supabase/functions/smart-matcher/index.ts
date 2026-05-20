import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { z } from 'https://esm.sh/zod@3.23.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const requestSchema = z.object({
  user_id: z.string().uuid().optional(),
  user_persona: z.record(z.unknown()).default({}),
  vertical_filter: z.string().default('founder'),
  match_limit: z.number().int().min(1).max(50).default(10),
})

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getUserId(req: Request, explicitUserId?: string) {
  if (explicitUserId) return explicitUserId
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data } = await userClient.auth.getUser(token)
  return data.user?.id ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Supabase environment is not configured' }, 500)

  try {
    const payload = requestSchema.parse(await req.json())
    const userId = await getUserId(req, payload.user_id)
    if (!userId) return json({ error: 'Unauthorized' }, 401)

    const { data: variants } = await supabase
      .from('answer_variants')
      .select('canonical_id, entity, fidelity_score, qualification')
      .eq('user_id', userId)
      .order('fidelity_score', { ascending: false })
      .limit(50)

    const enrichedPersona = {
      ...payload.user_persona,
      variant_count: variants?.length ?? 0,
      top_variant_entities: (variants ?? []).slice(0, 5).map((variant) => variant.entity).filter(Boolean),
      avg_fidelity: (variants ?? []).length
        ? (variants ?? []).reduce((sum, variant) => sum + Number(variant.fidelity_score ?? 0), 0) / (variants ?? []).length
        : 0,
    }

    const { data, error } = await supabase.rpc('smart_matcher_search', {
      user_persona: enrichedPersona,
      vertical_filter: payload.vertical_filter,
      match_limit: payload.match_limit,
    })

    if (error) throw error

    return json({
      recommendations: data ?? [],
      persona_summary: enrichedPersona,
      algorithm_status: 'placeholder',
      todo: 'TODO: Your IP — replace smart_matcher_search with SigTune/contextual persona scoring.',
    })
  } catch (err) {
    console.error('[smart-matcher] error', err)
    if (err instanceof z.ZodError) return json({ error: 'Invalid request', issues: err.issues }, 400)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
