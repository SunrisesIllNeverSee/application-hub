import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { z } from 'https://esm.sh/zod@3.23.8'

type HubAction = 'ingest' | 'qualify' | 'export' | 'map_variant'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const hubRequestSchema = z.object({
  action: z.enum(['ingest', 'qualify', 'export', 'map_variant']),
  user_id: z.string().uuid().optional(),
  vertical: z.enum(['founder', 'college', 'grants', 'jobs']).default('founder'),
  entity: z.string().max(240).optional(),
  source: z.string().max(500).optional(),
  canonical_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  package_id: z.string().uuid().optional(),
  content: z.string().max(200_000).optional(),
  commitments: z.array(z.object({
    title: z.string().min(2).max(240),
    content: z.string().min(1).max(20_000),
    tags: z.array(z.string()).default([]),
  })).optional(),
  export_format: z.enum(['json', 'markdown', 'pdf']).default('json'),
  metadata: z.record(z.unknown()).default({}),
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

function clientKey(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown'
}

function rateLimit(req: Request) {
  const key = clientKey(req)
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (bucket.count >= RATE_LIMIT_MAX) return false
  bucket.count += 1
  return true
}

async function computeSHA256(input: unknown) {
  const data = new TextEncoder().encode(typeof input === 'string' ? input : JSON.stringify(input))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function calculateSimilarity(a: string, b: string) {
  // TODO: Your IP — replace this lexical fallback with the proprietary
  // Commitment Conservation / Language Quantification formula.
  const left = new Set(a.toLowerCase().split(/\W+/).filter((word) => word.length > 2))
  const right = new Set(b.toLowerCase().split(/\W+/).filter((word) => word.length > 2))
  const overlap = [...left].filter((word) => right.has(word)).length
  const union = new Set([...left, ...right]).size || 1
  return overlap / union
}

function calculateFidelity(variant: string, canonical: string) {
  // TODO: Your IP — replace with fidelity scoring that measures preservation,
  // specificity, proof density, and contextual fit.
  return Math.min(1, Math.max(0, calculateSimilarity(variant, canonical) * 0.7 + 0.2))
}

function significanceFromCommitment(title: string, content: string, tags: string[]) {
  // TODO: Your IP — replace with canonical significance / SigTune formula.
  const lengthScore = Math.min(1, (title.length + content.length) / 1200)
  const tagScore = Math.min(0.25, tags.length * 0.05)
  return Number(Math.min(1, 0.35 + lengthScore * 0.4 + tagScore).toFixed(4))
}

function extractCommitments(content: string) {
  return content
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 20)
    .slice(0, 60)
    .map((chunk, index) => ({
      title: chunk.split(/\s+/).slice(0, 10).join(' '),
      content: chunk,
      tags: index === 0 ? ['source'] : [],
    }))
}

async function getUserId(req: Request, explicitUserId?: string) {
  if (explicitUserId) return explicitUserId
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data } = await anonClient.auth.getUser(token)
  return data.user?.id ?? null
}

async function recordLineage(entity_type: string, entity_id: string, action: string, parent_hashes: string[], new_hash: string, metadata: Record<string, unknown>) {
  await supabase.from('lineage_events').insert({
    entity_type,
    entity_id,
    action,
    parent_hashes,
    new_hash,
    metadata,
  })
}

async function findOrCreateCanonical(commitment: { title: string; content: string; tags: string[] }, vertical: string, metadata: Record<string, unknown>) {
  const { data: candidates } = await supabase
    .from('canonical_commitments')
    .select('id, title, aggregate_description, hash')
    .eq('vertical', vertical)
    .limit(50)

  const best = (candidates ?? [])
    .map((candidate) => ({
      candidate,
      similarity: calculateSimilarity(`${candidate.title} ${candidate.aggregate_description ?? ''}`, `${commitment.title} ${commitment.content}`),
    }))
    .sort((a, b) => b.similarity - a.similarity)[0]

  if (best && best.similarity >= 0.78) {
    return { canonical: best.candidate, created: false, similarity: best.similarity }
  }

  const hash = await computeSHA256({ vertical, title: commitment.title, content: commitment.content })
  const { data, error } = await supabase
    .from('canonical_commitments')
    .insert({
      hash,
      vertical,
      title: commitment.title,
      aggregate_description: commitment.content,
      significance_score: significanceFromCommitment(commitment.title, commitment.content, commitment.tags),
      qualification_tags: commitment.tags,
      lineage: {
        action: 'ingest',
        source: metadata.source ?? 'canonical-hub',
        algorithm_status: 'placeholder',
      },
    })
    .select('id, title, aggregate_description, hash')
    .single()

  if (error) throw error
  await recordLineage('canonical', data.id, 'ingest', [], hash, { ...metadata, created: true })
  return { canonical: data, created: true, similarity: 1 }
}

async function handleIngest(req: Request, payload: z.infer<typeof hubRequestSchema>) {
  const userId = await getUserId(req, payload.user_id)
  const commitments = payload.commitments ?? (payload.content ? extractCommitments(payload.content) : [])
  if (commitments.length === 0) return json({ error: 'No commitments supplied or extracted' }, 400)

  const mapped = []
  const packageCommitments = []

  for (const commitment of commitments) {
    const result = await findOrCreateCanonical(commitment, payload.vertical, {
      source: payload.source,
      entity: payload.entity,
      ...payload.metadata,
    })
    const fidelity = calculateFidelity(commitment.content, result.canonical.aggregate_description ?? result.canonical.title)
    const variantHash = await computeSHA256({ canonical_id: result.canonical.id, user_id: userId, content: commitment.content, entity: payload.entity })

    const { data: variant, error: variantError } = await supabase
      .from('answer_variants')
      .insert({
        canonical_id: result.canonical.id,
        user_id: userId,
        entity: payload.entity,
        flavor_text: commitment.title,
        fidelity_score: fidelity,
        content: commitment.content,
        qualification: {
          tags: commitment.tags,
          reward_eligible: result.created && fidelity >= 0.72,
          algorithm_status: 'placeholder',
        },
        lineage: {
          parent_hashes: [result.canonical.hash],
          hash: variantHash,
          source: payload.source,
        },
      })
      .select('id, canonical_id, fidelity_score, content')
      .single()

    if (variantError) throw variantError
    await recordLineage('variant', variant.id, 'map', [result.canonical.hash], variantHash, { entity: payload.entity, fidelity })

    packageCommitments.push({
      canonical_id: result.canonical.id,
      variant_id: variant.id,
      fidelity_score: fidelity,
      title: commitment.title,
    })
    mapped.push({ ...result, variant })

    if (result.created && userId) {
      await supabase.from('contribution_rewards').insert({
        user_id: userId,
        entity_type: 'canonical',
        entity_id: result.canonical.id,
        action: 'first_load_canonical',
        credit_amount: 25,
        cash_amount_cents: fidelity >= 0.85 ? 1500 : 0,
        metadata: { entity: payload.entity, source: payload.source, fidelity },
      })
    }
  }

  const packageHash = await computeSHA256({ userId, entity: payload.entity, vertical: payload.vertical, packageCommitments })
  const { data: applicationPackage, error: packageError } = await supabase
    .from('application_packages')
    .insert({
      user_id: userId,
      program_entity: payload.entity,
      vertical: payload.vertical,
      commitments: packageCommitments,
      hash: packageHash,
      lineage: { action: 'ingest', source: payload.source },
    })
    .select('id, hash, commitments')
    .single()

  if (packageError) throw packageError
  await recordLineage('package', applicationPackage.id, 'ingest', mapped.map((item) => item.canonical.hash), packageHash, { entity: payload.entity })

  return json({ package: applicationPackage, mapped, credit_estimate: mapped.filter((item) => item.created).length * 25 })
}

async function handleQualify(req: Request, payload: z.infer<typeof hubRequestSchema>) {
  const userId = await getUserId(req, payload.user_id)
  if (!payload.variant_id && !payload.content) return json({ error: 'variant_id or content is required' }, 400)

  let variant = null
  if (payload.variant_id) {
    const { data, error } = await supabase
      .from('answer_variants')
      .select('id, canonical_id, content, user_id')
      .eq('id', payload.variant_id)
      .maybeSingle()
    if (error) throw error
    variant = data
  }

  const canonicalId = payload.canonical_id ?? variant?.canonical_id
  if (!canonicalId) return json({ error: 'canonical_id is required' }, 400)

  const { data: canonical, error: canonicalError } = await supabase
    .from('canonical_commitments')
    .select('id, title, aggregate_description, hash')
    .eq('id', canonicalId)
    .single()
  if (canonicalError) throw canonicalError

  const content = payload.content ?? variant?.content ?? ''
  const fidelity = calculateFidelity(content, canonical.aggregate_description ?? canonical.title)
  const qualification = {
    fidelity_score: fidelity,
    reward_eligible: fidelity >= 0.82,
    tags: payload.metadata.tags ?? [],
    algorithm_status: 'placeholder',
    todo: 'TODO: Your IP fidelity/qualification formula',
  }

  if (variant?.id) {
    await supabase
      .from('answer_variants')
      .update({ fidelity_score: fidelity, qualification })
      .eq('id', variant.id)
      .eq('user_id', userId)
  }

  return json({ canonical, variant_id: variant?.id ?? null, qualification })
}

async function handleExport(req: Request, payload: z.infer<typeof hubRequestSchema>) {
  const userId = await getUserId(req, payload.user_id)
  if (!userId) return json({ error: 'Unauthorized' }, 401)

  let packageRow = null
  if (payload.package_id) {
    const { data, error } = await supabase
      .from('application_packages')
      .select('*')
      .eq('id', payload.package_id)
      .eq('user_id', userId)
      .single()
    if (error) throw error
    packageRow = data
  }

  const canonicalIds = payload.canonical_id
    ? [payload.canonical_id]
    : (packageRow?.commitments ?? []).map((item: { canonical_id?: string }) => item.canonical_id).filter(Boolean)

  const packages = []
  for (const canonicalId of canonicalIds) {
    const { data } = await supabase.rpc('get_canonical_package', {
      canonical_id: canonicalId,
      user_id: userId,
    })
    packages.push(data)
  }

  const envelope = {
    format: payload.export_format,
    exported_at: new Date().toISOString(),
    package: packageRow,
    commitments: packages,
    lineage_preserved: true,
  }

  if (payload.export_format === 'markdown') {
    const markdown = packages.map((pkg) => {
      const canonical = pkg?.canonical
      const variants = pkg?.variants ?? []
      return `## ${canonical?.title ?? 'Untitled'}\n\n${canonical?.aggregate_description ?? ''}\n\n${variants.map((variant: { entity?: string; content?: string }) => `### ${variant.entity ?? 'Variant'}\n\n${variant.content ?? ''}`).join('\n\n')}`
    }).join('\n\n')
    return json({ ...envelope, markdown })
  }

  if (payload.export_format === 'pdf') {
    return json({ ...envelope, pdf_ready: true })
  }

  return json(envelope)
}

async function handleMapVariant(req: Request, payload: z.infer<typeof hubRequestSchema>) {
  const userId = await getUserId(req, payload.user_id)
  if (!userId) return json({ error: 'Unauthorized' }, 401)
  if (!payload.canonical_id || !payload.content) return json({ error: 'canonical_id and content are required' }, 400)

  const { data: canonical, error } = await supabase
    .from('canonical_commitments')
    .select('id, title, aggregate_description, hash')
    .eq('id', payload.canonical_id)
    .single()
  if (error) throw error

  const fidelity = calculateFidelity(payload.content, canonical.aggregate_description ?? canonical.title)
  const variantHash = await computeSHA256({ canonical_id: payload.canonical_id, user_id: userId, content: payload.content })
  const { data: variant, error: variantError } = await supabase
    .from('answer_variants')
    .insert({
      canonical_id: payload.canonical_id,
      user_id: userId,
      entity: payload.entity,
      content: payload.content,
      fidelity_score: fidelity,
      qualification: { reward_eligible: fidelity >= 0.82, algorithm_status: 'placeholder' },
      lineage: { parent_hashes: [canonical.hash], hash: variantHash },
    })
    .select('*')
    .single()
  if (variantError) throw variantError

  await recordLineage('variant', variant.id, 'map_variant', [canonical.hash], variantHash, { fidelity })
  return json({ variant, fidelity_score: fidelity })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Supabase environment is not configured' }, 500)
  if (!rateLimit(req)) return json({ error: 'Rate limit exceeded' }, 429)

  try {
    const raw = await req.json()
    const payload = hubRequestSchema.parse(raw)
    const idempotencyKey = req.headers.get('idempotency-key')
    if (idempotencyKey) {
      console.log('[canonical-hub] idempotency-key', idempotencyKey)
    }

    const handlers: Record<HubAction, (req: Request, payload: z.infer<typeof hubRequestSchema>) => Promise<Response>> = {
      ingest: handleIngest,
      qualify: handleQualify,
      export: handleExport,
      map_variant: handleMapVariant,
    }

    return await handlers[payload.action](req, payload)
  } catch (err) {
    console.error('[canonical-hub] error', err)
    if (err instanceof z.ZodError) return json({ error: 'Invalid request', issues: err.issues }, 400)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
