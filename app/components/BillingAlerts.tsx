'use client'

import { useState } from 'react'

interface Props {
  showUpgradeSuccess: boolean
  showUpgradeCancelled: boolean
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  currentTier: 'free' | 'pro' | 'team'
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return 'the end of the current period'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function BillingAlerts({
  showUpgradeSuccess,
  showUpgradeCancelled,
  subscriptionStatus,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  currentTier,
}: Props) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  async function openPortal() {
    setPortalError(null)
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setPortalError(data.error ?? 'Failed to open billing portal.')
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Network error. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  const isPastDue = subscriptionStatus === 'past_due'
  const hasPendingCancel = cancelAtPeriodEnd && currentTier !== 'free'

  if (
    !showUpgradeSuccess &&
    !showUpgradeCancelled &&
    !isPastDue &&
    !hasPendingCancel
  ) {
    return null
  }

  return (
    <div className="space-y-3">
      {showUpgradeSuccess && (
        <div
          role="status"
          className="card border-l-4 border-l-success-500 bg-success-50 dark:bg-success-600/10 p-4"
        >
          <h3 className="text-sm font-semibold text-success-600 dark:text-success-500">
            Subscription activated
          </h3>
          <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
            {currentTier === 'free'
              ? 'Your upgrade is processing — it may take a moment to appear here. Refresh in a few seconds if it still shows Free.'
              : `Welcome to ${currentTier}. Your features are unlocked.`}
          </p>
        </div>
      )}

      {showUpgradeCancelled && !showUpgradeSuccess && (
        <div
          role="status"
          className="card border-l-4 border-l-neutral-400 dark:border-l-neutral-600 p-4"
        >
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            No problem
          </h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            You closed checkout before completing the upgrade. You can come back anytime.
          </p>
        </div>
      )}

      {isPastDue && (
        <div
          role="alert"
          className="card border-l-4 border-l-danger-500 bg-danger-50 dark:bg-danger-600/10 p-4"
        >
          <h3 className="text-sm font-semibold text-danger-600 dark:text-danger-500">
            Payment failed — your subscription is past due
          </h3>
          <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
            Stripe will keep retrying for a few days. To avoid losing access, update your payment method now.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="btn-primary text-xs"
            >
              {portalLoading ? 'Opening…' : 'Update payment method'}
            </button>
            {portalError && (
              <span className="text-xs text-danger-600 dark:text-danger-500">{portalError}</span>
            )}
          </div>
        </div>
      )}

      {hasPendingCancel && !isPastDue && (
        <div
          role="status"
          className="card border-l-4 border-l-warning-500 bg-warning-50 dark:bg-warning-600/10 p-4"
        >
          <h3 className="text-sm font-semibold text-warning-600 dark:text-warning-500">
            Cancellation scheduled
          </h3>
          <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
            Your {currentTier} subscription cancels on {formatPeriodEnd(currentPeriodEnd)}. You keep full access until then.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="btn-secondary text-xs"
            >
              {portalLoading ? 'Opening…' : 'Reactivate or change plan'}
            </button>
            {portalError && (
              <span className="text-xs text-danger-600 dark:text-danger-500">{portalError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
