import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProfileAboutForm } from '@/components/ProfileAboutForm'
import type { UserContributionSummary } from '@/lib/database.types'

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

  // Pull contribution credits earned via /hub/submit (migration 027).
  // The view is RLS-restricted to the owner; if it's missing (migration not
  // applied yet) we treat it as zero credits.
  let summary: UserContributionSummary | null = null
  const { data: summaryRow } = await supabase
    .from('user_contribution_summary')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<UserContributionSummary>()
  summary = summaryRow

  return (
    <div className="max-w-2xl space-y-6">
      {summary && summary.contribution_count > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold mb-1">
              Contribution credits earned
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-medium">{summary.total_credits_earned}</span> drip unlocks from{' '}
              <span className="font-medium">{summary.contribution_count}</span> accepted submission{summary.contribution_count !== 1 ? 's' : ''}.
              {' '}Keep building the archive in sparse verticals to earn more.
            </p>
          </div>
          <Link
            href="/hub/submit"
            className="flex-shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline"
          >
            Submit another
          </Link>
        </div>
      )}
      <ProfileAboutForm profile={profile} userEmail={user.email ?? ''} />
    </div>
  )
}
