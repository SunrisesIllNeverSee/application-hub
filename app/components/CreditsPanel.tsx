'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import {
  CREDIT_EVENTS,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  getShareUrl,
  SHARE_CONTENT,
  type CreditEventType,
} from '@/lib/credits'

interface CreditEvent {
  event_type: string
  amount: number
  created_at: string
}

interface Achievement {
  achievement_id: string
  earned_at: string
}

interface CreditsPanelProps {
  initialBalance?: number
  initialAchievements?: Achievement[]
  initialRecentEvents?: CreditEvent[]
}

export function CreditsPanel({
  initialBalance = 0,
  initialAchievements = [],
  initialRecentEvents = [],
}: CreditsPanelProps) {
  const [balance, setBalance] = React.useState(initialBalance)
  const [achievements, setAchievements] = React.useState<Achievement[]>(initialAchievements)
  const [claimedTypes, setClaimedTypes] = React.useState<Set<string>>(
    new Set<string>(initialRecentEvents.map(e => e.event_type))
  )
  const [claiming, setClaiming] = React.useState<string | null>(null)
  const [justClaimed, setJustClaimed] = React.useState<string | null>(null)
  const [shareOpened, setShareOpened] = React.useState<string | null>(null)

  async function claim(eventType: CreditEventType) {
    setClaiming(eventType)
    try {
      const res = await fetch('/api/credits/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType }),
      })
      const data = await res.json() as {
        claimed?: boolean
        already_claimed?: boolean
        amount?: number
        balance?: number
        achievements?: Achievement[]
      }
      if (data.claimed) {
        setBalance(data.balance ?? balance + (data.amount ?? 0))
        setClaimedTypes(prev => new Set<string>([...Array.from(prev), eventType]))
        setJustClaimed(eventType)
        setTimeout(() => setJustClaimed(null), 2500)
        // Re-fetch achievements
        const achRes = await fetch('/api/credits/claim')
        const achData = await achRes.json() as { achievements?: Achievement[] }
        if (achData.achievements) setAchievements(achData.achievements)
      }
      if (data.already_claimed) {
        setClaimedTypes(prev => new Set<string>([...Array.from(prev), eventType]))
      }
    } catch {
      // fail silently
    } finally {
      setClaiming(null)
    }
  }

  function openShare(platform: 'twitter' | 'linkedin') {
    const url = getShareUrl(platform)
    window.open(url, '_blank', 'noopener,noreferrer')
    setShareOpened(platform)
  }

  const socialEvents = CREDIT_EVENTS.filter(e => e.category === 'social' && e.manual)
  const appEvents = CREDIT_EVENTS.filter(e => e.category === 'app' && e.manual)
  const earnedIds = new Set(achievements.map(a => a.achievement_id))

  return (
    <div className="space-y-8">
      {/* Balance header */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">
              {balance.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">days of Pro</span>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            Each day earned = one day of Pro access. Redeem when ready.
          </p>
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
            Achievements
          </h3>
          <div className="flex flex-wrap gap-2">
            {achievements.map(a => {
              const def = ACHIEVEMENT_MAP[a.achievement_id]
              if (!def) return null
              return (
                <div
                  key={a.achievement_id}
                  title={def.description}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 text-xs font-medium text-brand-700 dark:text-brand-300"
                >
                  <span>{def.icon}</span>
                  <span>{def.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Share pre-made posts */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
          Share Application Hub
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          We&apos;ve written the post — just hit share. Earn credits once per week.
        </p>
        <div className="space-y-3">
          {/* Twitter/X */}
          <ShareCard
            platform="twitter"
            postText={SHARE_CONTENT.twitter.text}
            eventType="social_share"
            amount={25}
            claimed={claimedTypes.has('social_share')}
            justClaimed={justClaimed === 'social_share'}
            shareOpened={shareOpened === 'twitter'}
            claiming={claiming === 'social_share'}
            onShare={() => openShare('twitter')}
            onClaim={() => claim('social_share')}
          />
          {/* LinkedIn */}
          <ShareCard
            platform="linkedin"
            postText={SHARE_CONTENT.linkedin.text}
            eventType="social_repost"
            amount={25}
            claimed={claimedTypes.has('social_repost')}
            justClaimed={justClaimed === 'social_repost'}
            shareOpened={shareOpened === 'linkedin'}
            claiming={claiming === 'social_repost'}
            onShare={() => openShare('linkedin')}
            onClaim={() => claim('social_repost')}
          />
        </div>
      </div>

      {/* Social follow actions */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
          Follow us
        </h3>
        <div className="space-y-2">
          {socialEvents.filter(e => e.type !== 'social_share' && e.type !== 'social_repost').map(event => {
            const claimed = claimedTypes.has(event.type)
            const isJust = justClaimed === event.type
            return (
              <div key={event.type}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{event.label}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{event.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">+{event.amount} days</span>
                  <button
                    onClick={() => !claimed && claim(event.type as CreditEventType)}
                    disabled={claimed || claiming === event.type}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      claimed
                        ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 cursor-default'
                        : 'bg-brand-600 hover:bg-brand-700 text-white'
                    )}
                  >
                    {isJust ? '✓ Claimed!' : claimed ? 'Claimed' : claiming === event.type ? '…' : 'Claim'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* App milestone actions */}
      {appEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
            One-time bonuses
          </h3>
          <div className="space-y-2">
            {appEvents.map(event => {
              const claimed = claimedTypes.has(event.type)
              const isJust = justClaimed === event.type
              return (
                <div key={event.type}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{event.label}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{event.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">+{event.amount} days</span>
                    <button
                      onClick={() => !claimed && claim(event.type as CreditEventType)}
                      disabled={claimed || claiming === event.type}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        claimed
                          ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 cursor-default'
                          : 'bg-brand-600 hover:bg-brand-700 text-white'
                      )}
                    >
                      {isJust ? '✓ Claimed!' : claimed ? 'Claimed' : claiming === event.type ? '…' : 'Claim'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All achievements (including unearned) */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
          All achievements
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(ach => {
            const earned = earnedIds.has(ach.id)
            return (
              <div key={ach.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  earned
                    ? 'border-brand-100 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10'
                    : 'border-neutral-100 dark:border-neutral-800 opacity-50'
                )}>
                <span className="text-lg flex-shrink-0">{ach.icon}</span>
                <div>
                  <p className={cn('text-xs font-semibold', earned ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400')}>
                    {ach.label}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{ach.description}</p>
                </div>
                {earned && (
                  <span className="ml-auto text-success-500 flex-shrink-0">✓</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── ShareCard ────────────────────────────────────────────────────────────────

function ShareCard({
  platform, postText, eventType, amount,
  claimed, justClaimed, shareOpened, claiming,
  onShare, onClaim,
}: {
  platform: 'twitter' | 'linkedin'
  postText: string
  eventType: string
  amount: number
  claimed: boolean
  justClaimed: boolean
  shareOpened: boolean
  claiming: boolean
  onShare: () => void
  onClaim: () => void
}) {
  const icon = platform === 'twitter' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Post preview */}
      <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-2 mb-2 text-neutral-500 dark:text-neutral-400">
          {icon}
          <span className="text-xs font-medium">{platform === 'twitter' ? 'X / Twitter' : 'LinkedIn'}</span>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed italic">
          &ldquo;{postText.slice(0, 120)}{postText.length > 120 ? '…' : ''}&rdquo;
        </p>
      </div>
      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {claimed ? 'Thanks for sharing!' : `+${amount} days · weekly`}
        </span>
        <div className="flex items-center gap-2">
          {!claimed && (
            <button
              onClick={onShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-100 transition-colors"
            >
              {icon}
              Share
            </button>
          )}
          {shareOpened && !claimed && (
            <button
              onClick={onClaim}
              disabled={claiming}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-success-600 hover:bg-success-700 text-white transition-colors"
            >
              {claiming ? '…' : justClaimed ? '✓ Claimed!' : 'Mark as shared → claim'}
            </button>
          )}
          {claimed && (
            <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400">
              {justClaimed ? '✓ Claimed!' : '✓ Shared'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
