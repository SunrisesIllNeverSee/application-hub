import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { CreditToast } from '@/components/CreditToast'
import { BetaEndBanner } from '@/components/BetaEndBanner'
import { VaultProvider } from '@/lib/aqua-local-client/VaultProvider'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { isBrowseOnlyPath } from '@/lib/browse-gate'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // M08-PRD-004 (owner d5) + M08-PRD-003 (owner d4b): un-onboarded signed-in
  // users AND unauthenticated guests may browse the catalog read-only; every
  // other surface still gates (login for guests, onboarding for signed-in).
  // Path comes from the middleware-stamped x-aqua-path request header —
  // middleware unconditionally overwrites it on every matcher-covered route,
  // which is what makes trusting it here safe. If the route matcher ever
  // excludes a page, this header becomes attacker-controllable: re-derive
  // server-side instead.
  const reqPath = (await headers()).get('x-aqua-path') ?? ''
  const isBrowseOnly = isBrowseOnlyPath(reqPath)

  if (!user) {
    if (!isBrowseOnly) redirect('/login')
    // Guest browse: catalog content without app chrome (no sidebar/vault).
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <a href="/" className="text-sm font-semibold text-neutral-900 dark:text-white">AQUA</a>
          <a href="/login" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Sign in</a>
        </header>
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">{children}</div>
        </main>
      </div>
    )
  }

  // Onboarding gate — block all (app) routes until user completes /onboarding.
  // Legacy users with existing profile_answers were backfilled in migration 040.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle<{ onboarding_completed_at: string | null }>()

  if (!profile?.onboarding_completed_at && !isBrowseOnly) {
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
        <BetaEndBanner />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
          {/* IN-01: shared vault session — unlock survives in-app navigation.
              Lazy: no IndexedDB open until a surface actually uses it.
              Flag-off renders children unwrapped (legacy path unchanged). */}
          {LOCAL_FIRST ? <VaultProvider>{children}</VaultProvider> : children}
        </div>
      </main>
      <CreditToast userId={user.id} />
    </div>
  )
}
