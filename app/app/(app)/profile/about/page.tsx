import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProfileAboutForm } from '@/components/ProfileAboutForm'
import type { UserContributionSummary } from '@/lib/database.types'

export const metadata = {
  title: 'About — Profile',
}

export default async function ProfileAboutPage() {
  const supabase = await createClient()
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
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold mb-1">
            Contribution credits
          </p>
          {(summary && (summary.contribution_count ?? 0) > 0) ? (
            <p className="text-sm text-neutral-800 dark:text-neutral-200">
              <span className="font-medium text-amber-700 dark:text-amber-300">{summary.total_credits_earned}</span> drip unlocks from{' '}
              <span className="font-medium">{summary.contribution_count}</span> accepted submission{(summary.contribution_count ?? 0) !== 1 ? 's' : ''}.
            </p>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No accepted submissions yet. Submit a program in a sparse vertical and earn drip unlocks when it&apos;s accepted.
            </p>
          )}
        </div>
        <Link
          href="/applications/submit"
          className="flex-shrink-0 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
        >
          Submit a program →
        </Link>
      </div>
      <ProfileAboutForm profile={profile} userEmail={user.email ?? ''} />
    </div>
  )
}
