'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tier = 'free' | 'pro' | 'team'

interface Props {
  currentTier: Tier
}

interface Plan {
  id: Tier
  name: string
  monthlyPrice: number | null
  annualPrice: number | null
  description: string
  features: string[]
  cta: string
  badge?: string
  highlight?: boolean
  comingSoon?: boolean[]
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Get started for free',
    features: [
      '3 active applications',
      '10 AI drafts per month',
      'Full question archive access',
      'MCP server access',
    ],
    cta: 'Current plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 19,
    annualPrice: 159,
    description: 'For serious applicants',
    features: [
      'Unlimited applications',
      'Unlimited AI drafts',
      'Export answers',
      'Acceptance rate data',
      'Heat scores',
      'MCP server access',
    ],
    cta: 'Upgrade to Pro',
    badge: 'Most popular',
    highlight: true,
  },
]

// Team tier exists in Stripe + schema but is not marketed pre-100-users.
// Re-add to PLANS when founder wedge validates. See ADR-001, docs/AFTER_LAUNCH.md.

export function PricingCards({ currentTier }: Props) {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<Tier | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade(tier: 'pro' | 'team') {
    setError(null)
    setLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval: annual ? 'annual' : 'monthly' }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to start checkout. Please try again.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setError(null)
    setLoading('pro') // reuse loading state
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to open billing portal.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const annualSavingsPct = 30

  return (
    <div className="space-y-6">
      {/* Annual toggle */}
      <div className="flex items-center gap-3">
        <span className={[
          'text-sm',
          !annual ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500 dark:text-neutral-400',
        ].join(' ')}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className={[
            'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
            annual ? 'bg-brand-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              annual ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
        <span className={[
          'text-sm',
          annual ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500 dark:text-neutral-400',
        ].join(' ')}>
          Annual
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-success-50 text-success-600 dark:bg-success-600/10 dark:text-success-400">
            Save {annualSavingsPct}%
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id
          const price = annual ? plan.annualPrice : plan.monthlyPrice
          const perPeriod = annual ? '/yr' : '/mo'

          return (
            <div
              key={plan.id}
              className={[
                'card relative flex flex-col p-5 transition-shadow',
                plan.highlight
                  ? 'ring-2 ring-brand-500 dark:ring-brand-400'
                  : '',
              ].join(' ')}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-brand-600 text-white whitespace-nowrap">
                  {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {plan.name}
                  </h3>
                  {isCurrent && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      Current plan
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {plan.description}
                </p>
              </div>

              <div className="mb-5">
                {price === 0 ? (
                  <span className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                    Free
                  </span>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                      ${price}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {perPeriod}
                    </span>
                  </div>
                )}
              </div>

              <ul className="flex-1 space-y-2 mb-5">
                {plan.features.map((feature, i) => {
                  const isComingSoon = plan.comingSoon?.[i] ?? false
                  return (
                    <li key={feature} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                      <span>
                        {feature}
                        {isComingSoon && (
                          <span className="ml-1 text-2xs text-neutral-400 dark:text-neutral-500">(soon)</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* CTA */}
              {isCurrent && plan.id === 'free' && (
                <span className="btn-secondary text-center text-sm opacity-50 cursor-default select-none">
                  Current plan
                </span>
              )}

              {isCurrent && plan.id !== 'free' && (
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={loading !== null}
                  className="btn-secondary text-sm w-full"
                >
                  {loading !== null ? 'Loading…' : 'Manage billing'}
                </button>
              )}

              {!isCurrent && plan.id !== 'free' && (
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan.id as 'pro' | 'team')}
                  disabled={loading !== null}
                  className={[
                    'text-sm w-full',
                    plan.highlight ? 'btn-primary' : 'btn-secondary',
                  ].join(' ')}
                >
                  {loading === plan.id ? 'Loading…' : plan.cta}
                </button>
              )}

              {!isCurrent && plan.id === 'free' && (
                <span className="btn-secondary text-center text-sm opacity-40 cursor-default select-none">
                  Downgrade
                </span>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}
    </div>
  )
}
