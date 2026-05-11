import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripeCustomerId = sub?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please upgrade first.' },
        { status: 404 }
      )
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/profile/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('[/api/stripe/portal] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
