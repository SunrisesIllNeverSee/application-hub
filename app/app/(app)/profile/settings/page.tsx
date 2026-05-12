import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'
import { PricingCards } from '@/components/PricingCards'
import { BillingAlerts } from '@/components/BillingAlerts'
import { TeamSection } from '@/components/TeamSection'
import { ExtensionTokenCard } from '@/components/ExtensionTokenCard'
import type { SubscriptionTier } from '@/lib/database.types'

export const metadata = {
  title: 'Settings — Profile',
}

type SearchParams = {
  upgraded?: string
  upgrade_cancelled?: string
  session_id?: string
}

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email_notifications, profile_visibility')
    .eq('user_id', user.id)
    .single()

  const currentTier = (subscription?.tier ?? 'free') as SubscriptionTier

  // Load team data for the TeamSection (only meaningful on team tier, but fetch always)
  let teamData: {
    id: string
    name: string
    slug: string
    owner_id: string
    plan: string
    created_at: string
    member_role?: string
  } | null = null
  let memberCount = 0

  if (currentTier === 'team') {
    const { data: memberships } = await supabase
      .from('team_members')
      .select('role, joined_at, team:teams(id, name, slug, owner_id, plan, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)

    if (memberships && memberships.length > 0) {
      const m = memberships[0]
      const t = Array.isArray(m.team) ? m.team[0] : m.team
      const raw = t as { id: string; name: string; slug: string; owner_id: string; plan: string; created_at: string } | null

      if (raw) {
        teamData = { ...raw, member_role: m.role }

        const { count } = await supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', raw.id)

        memberCount = count ?? 0
      }
    }
  }

  const showUpgradeSuccess = searchParams?.upgraded === 'true'
  const showUpgradeCancelled = searchParams?.upgrade_cancelled === 'true'

  return (
    <div className="space-y-10">
      <BillingAlerts
        showUpgradeSuccess={showUpgradeSuccess}
        showUpgradeCancelled={showUpgradeCancelled}
        subscriptionStatus={subscription?.status ?? null}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        currentTier={currentTier}
      />

      <div className="max-w-2xl">
        <ProfileSettingsForm
          subscription={subscription}
          profile={profile}
          userEmail={user.email ?? ''}
        />
      </div>

      {/* Pricing */}
      <section id="plans">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
          Plans
        </h2>
        <PricingCards currentTier={currentTier} />
      </section>

      {/* Team */}
      <TeamSection
        tier={currentTier}
        initialTeam={teamData}
        initialMemberCount={memberCount}
      />

      {/* Appfeeder extension token */}
      <div className="max-w-2xl">
        <ExtensionTokenCard />
      </div>
    </div>
  )
}
