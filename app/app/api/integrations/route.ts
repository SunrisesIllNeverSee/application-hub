import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptKey, keyFingerprint } from '@/lib/encryption'

// POST /api/integrations — save a provider key
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { provider, api_key, base_url, model_preference, label } = await req.json()

    if (!provider || !api_key) {
      return NextResponse.json({ error: 'provider and api_key are required' }, { status: 400 })
    }

    if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
      return NextResponse.json({ error: 'Key storage not configured on this server' }, { status: 503 })
    }

    // Encrypt the key server-side
    const { encrypted, iv } = encryptKey(api_key.trim())
    const fingerprint = keyFingerprint(api_key.trim())

    // Upsert — one row per user per provider
    const { data, error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        provider,
        label: label || provider,
        status: 'active',
        key_encrypted: encrypted,
        key_storage_ref: iv,        // reuse iv column
        key_fingerprint: fingerprint,
        base_url: base_url || null,
        model_preference: model_preference || null,
        last_verified_at: new Date().toISOString(),
        is_default: true,
      }, { onConflict: 'user_id,provider' })
      .select('id, provider, key_fingerprint, status, last_verified_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ integration: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[POST /api/integrations]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/integrations — list user's integrations (no keys returned)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_integrations')
    .select('id, provider, label, status, key_fingerprint, base_url, model_preference, last_verified_at, is_default')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ integrations: data ?? [] })
}
