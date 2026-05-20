import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    action?: 'create_account_link' | 'mark_paid'
    reward_id?: string
    return_url?: string
    refresh_url?: string
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (body.action === 'create_account_link') {
    let stripe
    try {
      stripe = getStripe()
    } catch {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const { data: creditRow } = await admin
      .from('canonical_user_credits')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let accountId = creditRow?.stripe_account_id as string | undefined
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { user_id: user.id, product: 'aqua_canonical_rewards' },
      })
      accountId = account.id
      await admin
        .from('canonical_user_credits')
        .upsert({ user_id: user.id, stripe_account_id: accountId }, { onConflict: 'user_id' })
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: body.return_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://mos2es.xyz'}/profile/settings`,
      refresh_url: body.refresh_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://mos2es.xyz'}/profile/settings`,
    })

    return NextResponse.json({ url: accountLink.url, stripe_account_id: accountId })
  }

  if (body.action === 'mark_paid') {
    if (!body.reward_id) return NextResponse.json({ error: 'reward_id is required' }, { status: 400 })

    const { data: reward, error } = await admin
      .from('contribution_rewards')
      .select('id, user_id, cash_amount_cents, stripe_account_id, status')
      .eq('id', body.reward_id)
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (reward.status !== 'approved') return NextResponse.json({ error: 'Reward must be approved before payout' }, { status: 400 })

    // Real transfers should be executed from an admin-only review surface after
    // manual quality approval. This endpoint records the operator intent only.
    await admin
      .from('contribution_rewards')
      .update({ status: 'paid', metadata: { payout_note: 'Marked paid by payout scaffold; wire Stripe transfer in admin flow.' } })
      .eq('id', body.reward_id)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unsupported payout action' }, { status: 400 })
}
