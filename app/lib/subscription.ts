import { createClient } from '@/lib/supabase/server'

export type TierName = 'free' | 'pro' | 'team'

/**
 * Returns the active subscription tier for a user.
 * Falls back to 'free' if no active/trialing row exists.
 */
export async function getUserTier(userId: string): Promise<TierName> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (!data?.tier) return 'free'
  return data.tier as TierName
}

/**
 * Returns true if the user can run another AI draft this month.
 * Pro/Team users with limit=-1 (unlimited) always return true.
 */
export async function canDraft(userId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: planRow } = await supabase
    .from('user_subscriptions')
    .select('tier, subscription_plans(ai_drafts_per_month)')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (!planRow) return false

  const planData = Array.isArray(planRow.subscription_plans)
    ? planRow.subscription_plans[0]
    : planRow.subscription_plans
  const plan = planData as { ai_drafts_per_month: number } | null

  const limit = plan?.ai_drafts_per_month ?? 0
  if (limit === -1) return true   // unlimited

  const month = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('draft_count')
    .eq('user_id', userId)
    .eq('month_year', month)
    .maybeSingle()

  return (usage?.draft_count ?? 0) < limit
}

/**
 * Returns true if the user is on Pro or Team tier.
 */
export async function isPro(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId)
  return tier === 'pro' || tier === 'team'
}
