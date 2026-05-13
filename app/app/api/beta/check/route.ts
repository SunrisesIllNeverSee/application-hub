import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isBetaOver } from '@/lib/beta'
import { rateLimitAllow } from '@/lib/rate-limit'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role env vars not set')
  return createAdminClient(url, key)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!rateLimitAllow(user.id, 'beta_check')) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const betaOver = await isBetaOver()
  if (!betaOver) {
    return NextResponse.json({ status: 'beta_active' })
  }

  const admin = getAdminClient()
  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('beta_participant, beta_payment_method_id, beta_grace_period_days')
    .eq('user_id', user.id)
    .maybeSingle<{
      beta_participant: boolean | null
      beta_payment_method_id: string | null
      beta_grace_period_days: number | null
    }>()

  if (sub?.beta_participant && sub.beta_payment_method_id) {
    const days = sub.beta_grace_period_days ?? 30
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    await admin
      .from('user_subscriptions')
      .update({
        tier: 'pro',
        grace_period_ends_at: endsAt,
        beta_participant: false,
      })
      .eq('user_id', user.id)
    return NextResponse.json({ status: 'grace_period', ends_at: endsAt })
  }

  await admin
    .from('user_subscriptions')
    .update({ tier: 'free', beta_participant: false })
    .eq('user_id', user.id)
  return NextResponse.json({ status: 'basic' })
}
