import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptKey } from '@/lib/encryption'

// GET /api/integrations/key
// Returns the decrypted API key for the user's default BYOK integration.
// Used by the AQUA browser extension to call AI providers directly.
// Requires a valid session — never returns keys unauthenticated.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'Key storage not configured' }, { status: 503 })
  }

  // Prefer Anthropic, fall back to OpenAI, take whatever is default
  const { data: integrations, error } = await supabase
    .from('user_integrations')
    .select('provider, key_encrypted, key_storage_ref, status, model_preference, base_url')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('is_default', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ error: 'No active integration found' }, { status: 404 })
  }

  // Pick preferred provider
  const preferred = ['anthropic', 'openai']
  const integration =
    integrations.find(i => i.provider === 'anthropic') ??
    integrations.find(i => i.provider === 'openai') ??
    integrations[0]

  if (!integration.key_encrypted || !integration.key_storage_ref) {
    return NextResponse.json({ error: 'Key not stored' }, { status: 404 })
  }

  let key: string
  try {
    key = decryptKey(integration.key_encrypted, integration.key_storage_ref)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt key' }, { status: 500 })
  }

  return NextResponse.json({
    provider: integration.provider,
    key,
    model_preference: integration.model_preference ?? null,
    base_url: integration.base_url ?? null,
  })
}
