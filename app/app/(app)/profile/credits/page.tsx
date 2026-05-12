import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { CreditsPanel } from '@/components/CreditsPanel'

export const metadata = { title: 'Days & Achievements' }

export default async function CreditsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [balanceRes, achievementsRes, recentRes] = await Promise.all([
    admin.from('user_credit_balance').select('balance').eq('user_id', user.id).single(),
    admin.from('user_achievements').select('achievement_id, earned_at').eq('user_id', user.id).order('earned_at', { ascending: false }),
    admin.from('credit_events').select('event_type, amount, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])

  const balance = (balanceRes.data as { balance: number } | null)?.balance ?? 0
  const achievements = (achievementsRes.data ?? []) as { achievement_id: string; earned_at: string }[]
  const recentEvents = (recentRes.data ?? []) as { event_type: string; amount: number; created_at: string }[]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Days & Achievements</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Earn days of Pro access. Every day earned extends your Pro clock when you&apos;re ready to upgrade.
        </p>
      </div>
      <CreditsPanel
        initialBalance={balance}
        initialAchievements={achievements}
        initialRecentEvents={recentEvents}
        userEmail={user.email}
      />
    </div>
  )
}
