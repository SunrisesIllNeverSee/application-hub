import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Onboarding layout — standalone, no sidebar.
 * If the user has already completed onboarding, redirect them into the app.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle<{ onboarding_completed_at: string | null }>()

  if (profile?.onboarding_completed_at) {
    redirect('/dash')
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {children}
    </div>
  )
}
