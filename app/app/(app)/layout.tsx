import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { CreditToast } from '@/components/CreditToast'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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
