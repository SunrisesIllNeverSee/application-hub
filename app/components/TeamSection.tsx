'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TeamMember {
  id: string
  role: string
  joined_at: string | null
  user_id: string
}

interface Team {
  id: string
  name: string
  slug: string
  owner_id: string
  plan: string
  created_at: string
  member_role?: string
}

interface Props {
  tier: string
  initialTeam: Team | null
  initialMemberCount: number
}

export function TeamSection({ tier, initialTeam, initialMemberCount }: Props) {
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(initialTeam)
  const [memberCount, setMemberCount] = useState(initialMemberCount)

  // Create team state
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const isTeamTier = tier === 'team'

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      })
      const data = await res.json() as { team?: Team; error?: string }

      if (!res.ok || !data.team) {
        setCreateError(data.error ?? 'Failed to create team. Please try again.')
        return
      }

      setTeam({ ...data.team, member_role: 'owner' })
      setMemberCount(1)
      setTeamName('')
      router.refresh()
    } catch {
      setCreateError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!team || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch(`/api/teams/${team.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json() as { invited?: boolean; error?: string; email?: string }

      if (!res.ok || !data.invited) {
        setInviteError(data.error ?? 'Failed to send invite. Please try again.')
        return
      }

      setInviteSuccess(`Invite sent to ${data.email ?? inviteEmail}.`)
      setInviteEmail('')
    } catch {
      setInviteError('Network error. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  // Not on team tier
  if (!isTeamTier) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
          Team
        </h2>
        <div className="card p-5 flex flex-col gap-3 max-w-md">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Team features — shared answer libraries, multi-seat access, and collaborative workspaces — require the Team plan.
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Upgrade using the Plans section above to unlock team collaboration.
          </p>
        </div>
      </section>
    )
  }

  // On team tier, no team yet
  if (!team) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
          Team
        </h2>
        <div className="card p-5 max-w-md space-y-4">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              Create your team
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Set up a shared workspace for your co-founders. You can invite members after creating the team.
            </p>
          </div>
          <form onSubmit={(e) => void handleCreateTeam(e)} className="space-y-3">
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. Acme Ventures"
              className="input w-full"
              maxLength={80}
              autoComplete="off"
              required
            />
            {createError && (
              <p className="text-xs text-danger-600 dark:text-danger-400">{createError}</p>
            )}
            <button
              type="submit"
              disabled={creating || !teamName.trim()}
              className="btn-primary text-sm"
            >
              {creating ? 'Creating…' : 'Create team'}
            </button>
          </form>
        </div>
      </section>
    )
  }

  // On team tier, has a team
  return (
    <section>
      <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
        Team
      </h2>
      <div className="card p-5 max-w-md space-y-5">
        {/* Team header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {team.name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {team.member_role ?? 'member'}
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            Team plan
          </span>
        </div>

        {/* Invite form */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-3">
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Invite a member
          </p>
          <form onSubmit={(e) => void handleInvite(e)} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="co-founder@example.com"
              className="input flex-1 text-sm"
              autoComplete="off"
              required
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="btn-primary text-sm flex-shrink-0"
            >
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </form>

          {inviteSuccess && (
            <p className="text-xs text-success-600 dark:text-success-400">{inviteSuccess}</p>
          )}
          {inviteError && (
            <p className="text-xs text-danger-600 dark:text-danger-400">{inviteError}</p>
          )}
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Invites expire after 7 days. The recipient must have an Application Hub account or sign up with that email.
          </p>
        </div>
      </div>
    </section>
  )
}
