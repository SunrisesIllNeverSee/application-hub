// Pure helpers for team invitations (EI-01..EI-03, EI-06, EI-11).
// No framework imports so they can be unit-tested with `node --test`.

export type InviteDelivery = 'sent' | 'not_configured' | 'failed'

/** Path of the real accept handler (a route handler, not a page). */
export const INVITE_ACCEPT_PATH = '/api/teams/accept'

/** Where the accept handler sends users; shows the status banner. */
export const TEAM_UI_PATH = '/profile/settings'

export function buildInviteAcceptUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`
}

/** Same-origin path used as the login `next` value. */
export function buildInviteAcceptPath(token: string): string {
  return `${INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`
}

// Tokens are hex (encode(gen_random_bytes(24),'hex')); accept a slightly wider
// url-safe alphabet and length range so the format can evolve.
export function isValidInviteToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(token)
}

/**
 * Maps the outcome of the Resend call to a truthful delivery state.
 * 'sent' means Resend accepted the message (HTTP 2xx), not that it was
 * delivered to the inbox.
 */
export function mapDeliveryStatus(input: {
  apiKeyPresent: boolean
  httpStatus?: number | null
  threw?: boolean
}): InviteDelivery {
  if (!input.apiKeyPresent) return 'not_configured'
  if (input.threw) return 'failed'
  const status = input.httpStatus
  if (typeof status === 'number' && status >= 200 && status < 300) return 'sent'
  return 'failed'
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface InviteNotice {
  tone: 'success' | 'warning'
  message: string
  showLink: boolean
}

/** UI copy for the invite form; mirrors the delivery state exactly. */
export function inviteDeliveryNotice(delivery: unknown, email: string): InviteNotice {
  if (delivery === 'sent') {
    return { tone: 'success', message: `Invite created and email sent to ${email}.`, showLink: false }
  }
  if (delivery === 'not_configured') {
    return {
      tone: 'warning',
      message: `Invite created for ${email}, but the email was not sent (email provider not configured). Share this link with them:`,
      showLink: true,
    }
  }
  return {
    tone: 'warning',
    message: `Invite created for ${email}, but the email could not be sent. Share this link with them:`,
    showLink: true,
  }
}

// Teams are deferred (owner decision, 2026-10-21): the UI shows "Coming soon"
// and every team route and Team checkout refuses. Flip only when Teams launch,
// together with re-granting client writes revoked by migration 056.
export const TEAMS_AVAILABLE = false
export const TEAMS_COMING_SOON_MESSAGE = 'Teams are coming soon. Contact us for more information.'

export type TeamAcceptStatus =
  | 'coming_soon'
  | 'joined'
  | 'already_member'
  | 'invalid_or_used'
  | 'expired'
  | 'email_mismatch'
  | 'missing_token'
  | 'error'

const ACCEPT_STATUSES: readonly string[] = [
  'coming_soon',
  'joined',
  'already_member',
  'invalid_or_used',
  'expired',
  'email_mismatch',
  'missing_token',
  'error',
]

/**
 * Converts the accept_team_invite RPC result (jsonb) into a status string.
 * Contract: {ok:true, team_id, status:'joined'|'already_member'} or
 * {ok:false, error:'not_authenticated'|'invalid_or_used'|'expired'|'email_mismatch'}.
 * Anything unexpected becomes 'error'.
 */
export function rpcResultToStatus(result: unknown): TeamAcceptStatus {
  if (!result || typeof result !== 'object') return 'error'
  const r = result as { ok?: unknown; status?: unknown; error?: unknown }
  if (r.ok === true) {
    return r.status === 'already_member' ? 'already_member' : 'joined'
  }
  if (r.ok === false && typeof r.error === 'string') {
    if (r.error === 'invalid_or_used' || r.error === 'expired' || r.error === 'email_mismatch') {
      return r.error
    }
  }
  return 'error'
}

export interface TeamStatusBanner {
  tone: 'success' | 'error'
  message: string
}

/** Banner for /profile/settings?team=<status>. Unknown values show nothing. */
export function teamStatusBanner(value: unknown): TeamStatusBanner | null {
  if (typeof value !== 'string' || !ACCEPT_STATUSES.includes(value)) return null
  switch (value as TeamAcceptStatus) {
    case 'coming_soon':
      return { tone: 'error', message: TEAMS_COMING_SOON_MESSAGE }
    case 'joined':
      return { tone: 'success', message: 'You joined the team.' }
    case 'already_member':
      return { tone: 'success', message: 'You are already a member of this team.' }
    case 'invalid_or_used':
      return { tone: 'error', message: 'This invitation link is invalid or has already been used. Ask the team owner for a new one.' }
    case 'expired':
      return { tone: 'error', message: 'This invitation has expired. Ask the team owner to send a new one.' }
    case 'email_mismatch':
      return { tone: 'error', message: 'This invitation was sent to a different email address. Sign in with the invited email to accept it.' }
    case 'missing_token':
      return { tone: 'error', message: 'This invitation link is incomplete. Ask the team owner to send it again.' }
    default:
      return { tone: 'error', message: 'We could not accept the invitation. Please try the link again or ask the team owner to resend it.' }
  }
}
