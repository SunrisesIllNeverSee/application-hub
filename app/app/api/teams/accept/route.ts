import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  TEAM_UI_PATH,
  buildInviteAcceptPath,
  isValidInviteToken,
  rpcResultToStatus,
  type TeamAcceptStatus,
} from '@/lib/team-invite'

export const dynamic = 'force-dynamic'

// GET /api/teams/accept?token=... — accept a team invite (the link emailed to
// invitees). Always answers with a redirect:
//   - signed out  -> /login?next=<this URL>, so the invite survives login
//   - signed in   -> accept_team_invite RPC (SECURITY DEFINER, validates token,
//                    expiry and that the invited email matches the account),
//                    then /profile/settings?team=<status>, which shows the result
// The token is never logged.
export async function GET(req: NextRequest) {
  const redirectToTeamUi = (status: TeamAcceptStatus) => {
    const url = new URL(TEAM_UI_PATH, req.url)
    url.searchParams.set('team', status)
    return NextResponse.redirect(url)
  }

  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return redirectToTeamUi('missing_token')
    if (!isValidInviteToken(token)) return redirectToTeamUi('invalid_or_used')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', buildInviteAcceptPath(token))
      return NextResponse.redirect(loginUrl)
    }

    const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token })
    if (error) {
      console.error('[GET /api/teams/accept] rpc error:', error.code, error.message)
      return redirectToTeamUi('error')
    }

    const result: unknown = data
    if (
      result && typeof result === 'object' &&
      (result as { ok?: unknown; error?: unknown }).ok === false &&
      (result as { error?: unknown }).error === 'not_authenticated'
    ) {
      // Session vanished between getUser() and the RPC: send back to login.
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', buildInviteAcceptPath(token))
      return NextResponse.redirect(loginUrl)
    }

    return redirectToTeamUi(rpcResultToStatus(result))
  } catch (err) {
    console.error('[GET /api/teams/accept]', err instanceof Error ? err.message : 'unknown error')
    return redirectToTeamUi('error')
  }
}
