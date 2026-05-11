import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'
import { PricingCards } from '@/components/PricingCards'
import type { SubscriptionTier } from '@/lib/database.types'

export const metadata = {
  title: 'Settings — Profile',
}

export default async function ProfileSettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email_notifications, profile_visibility')
    .eq('user_id', user.id)
    .single()

  const currentTier = (subscription?.tier ?? 'free') as SubscriptionTier

  return (
    <div className="space-y-10">
      <div className="max-w-2xl">
        <ProfileSettingsForm
          subscription={subscription}
          profile={profile}
          userEmail={user.email ?? ''}
        />
      </div>

      {/* Pricing */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
          Plans
        </h2>
        <PricingCards currentTier={currentTier} />
      </section>
    </div>
  )
}
