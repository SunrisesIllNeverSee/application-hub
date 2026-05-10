'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  subscription: { tier: string; status: string; current_period_end: string | null } | null
  profile: { email_notifications: boolean; profile_visibility: string } | null
  userEmail: string
}

export function ProfileSettingsForm({ subscription, profile, userEmail }: Props) {
  const router = useRouter()
  const [emailNotifications, setEmailNotifications] = useState(
    profile?.email_notifications ?? true
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, email_notifications: emailNotifications }, { onConflict: 'user_id' })

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tier = subscription?.tier ?? 'free'
  const tierLabel = { free: 'Free', pro: 'Pro', team: 'Team' }[tier] ?? tier

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Subscription */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Subscription</h2>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {tierLabel} plan
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {subscription?.status === 'active' ? 'Active' : subscription?.status ?? 'Active'}
              {subscription?.current_period_end
                ? ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : ''}
            </p>
          </div>
          {tier === 'free' && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white cursor-not-allowed opacity-60">
              Upgrade to Pro — coming soon
            </span>
          )}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Notifications</h2>
        <div className="card p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-neutral-800 dark:text-neutral-200">Email notifications</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Deadline reminders and new program alerts
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailNotifications}
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={[
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                emailNotifications
                  ? 'bg-brand-600'
                  : 'bg-neutral-200 dark:bg-neutral-700',
              ].join(' ')}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  emailNotifications ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && (
          <span className="text-sm text-success-600 dark:text-success-400">Saved</span>
        )}
      </div>

      {/* Sign out */}
      <section className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Account</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{userEmail}</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-secondary text-sm text-danger-600 dark:text-danger-400 border-danger-200 dark:border-danger-800 hover:bg-danger-50 dark:hover:bg-danger-900/20"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </form>
  )
}
