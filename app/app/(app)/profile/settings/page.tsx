import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'

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

  return (
    <div className="max-w-2xl">
      <ProfileSettingsForm
        subscription={subscription}
        profile={profile}
        userEmail={user.email ?? ''}
      />
    </div>
  )
}
