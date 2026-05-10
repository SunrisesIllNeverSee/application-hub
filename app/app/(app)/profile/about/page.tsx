import { createClient } from '@/lib/supabase/server'
import { ProfileAboutForm } from '@/components/ProfileAboutForm'

export const metadata = {
  title: 'About — Profile',
}

export default async function ProfileAboutPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="max-w-2xl">
      <ProfileAboutForm profile={profile} userEmail={user.email ?? ''} />
    </div>
  )
}
