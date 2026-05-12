import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { CreditToast } from '@/components/CreditToast'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Onboarding gate — block all (app) routes until user completes /onboarding.
  // Legacy users with existing profile_answers were backfilled in migration 040.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle<{ onboarding_completed_at: string | null }>()

  if (!profile?.onboarding_completed_at) {
    redirect('/onboarding')
  }

  // Fetch user's applications for sidebar list
  const { data: appRows } = await supabase
    .from('user_applications')
    .select('id, program_id, status, programs(id, name, slug)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  const applications = (appRows ?? []).map((a) => {
    const prog = (Array.isArray(a.programs) ? a.programs[0] : a.programs) as unknown as { name?: string; slug?: string } | null
    return {
      id: a.id as string,
      program_id: a.program_id as string,
      status: a.status as string,
      program_name: prog?.name ?? 'Unknown',
      program_slug: prog?.slug ?? '',
    }
  })

  // Fetch credit balance for sidebar badge
  const { data: balanceRow } = await supabase
    .from('user_credit_balance')
    .select('balance')
    .eq('user_id', user.id)
    .single()
  const creditBalance = (balanceRow as { balance: number } | null)?.balance ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <Sidebar user={user} applications={applications} creditBalance={creditBalance} />
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">{children}</div>
      </main>
      <CreditToast userId={user.id} />
    </div>
  )
}
