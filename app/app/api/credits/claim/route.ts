import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import {
  CREDIT_EVENT_MAP,
  resolveDedupKey,
  type CreditEventType,
} from '@/lib/credits'

// POST /api/credits/claim
// Manual credit claims: social follows, shares, profile complete, first_draft.
// DB triggers handle automatic credits (answer milestones, program submissions).
// Honor system for social — dedup_key prevents double-claiming per user.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { event_type, action_id, metadata = {} } = body as {
    event_type?: string
    action_id?: string
    metadata?: Record<string, unknown>
  }

  if (!event_type) return NextResponse.json({ error: 'event_type required' }, { status: 400 })

  const def = CREDIT_EVENT_MAP[event_type as CreditEventType]
  if (!def) return NextResponse.json({ error: 'Unknown event_type' }, { status: 400 })
  if (!def.manual) return NextResponse.json({ error: 'This event is auto-awarded by the system' }, { status: 400 })

  const dedup_key = resolveDedupKey(event_type as CreditEventType, action_id)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Insert credit event (dedup_key prevents double-claiming)
  const { error: insertErr } = await admin
    .from('credit_events')
    .insert({
      user_id: user.id,
      event_type,
      amount: def.amount,
      metadata,
      dedup_key,
    })

  if (insertErr) {
    // Unique violation = already claimed
    if (insertErr.code === '23505') {
      return NextResponse.json({
        already_claimed: true,
        message: 'Already claimed',
      })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Award achievements — upsert with ignoreDuplicates
  const achievementsToAward: string[] = []
  const socialEvents: CreditEventType[] = [
    'social_twitter_follow', 'social_linkedin_follow', 'social_github_star',
  ]
  if (socialEvents.includes(event_type as CreditEventType)) achievementsToAward.push('social_connected')
  if (event_type === 'first_draft') achievementsToAward.push('first_draft')
  if (event_type === 'profile_complete') achievementsToAward.push('profile_complete')
  for (const achievement_id of achievementsToAward) {
    await admin.from('user_achievements')
      .upsert({ user_id: user.id, achievement_id }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
  }

  // Fetch updated balance
  const { data: balanceRow } = await admin
    .from('user_credit_balance')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    claimed: true,
    event_type,
    amount: def.amount,
    balance: (balanceRow as { balance: number } | null)?.balance ?? def.amount,
  })
}

// GET /api/credits/claim — returns user's balance + achievements
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [balanceRes, achievementsRes, recentEventsRes] = await Promise.all([
    admin.from('user_credit_balance').select('balance, event_count, last_earned_at').eq('user_id', user.id).single(),
    admin.from('user_achievements').select('achievement_id, earned_at').eq('user_id', user.id).order('earned_at', { ascending: false }),
    admin.from('credit_events').select('event_type, amount, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    balance: (balanceRes.data as { balance: number } | null)?.balance ?? 0,
    event_count: (balanceRes.data as { event_count: number } | null)?.event_count ?? 0,
    achievements: achievementsRes.data ?? [],
    recent_events: recentEventsRes.data ?? [],
  })
}
