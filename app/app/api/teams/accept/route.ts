import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/teams/accept?token=... — accept a team invite
// The user must be authenticated. After acceptance, redirect to /profile/settings
// or return JSON if called from a client component.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Redirect to login with return path
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }

    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    // Look up invite
    const { data: invite, error: inviteErr } = await supabase
      .from('team_invites')
      .select('id, team_id, email, role, accepted_at, expires_at, team:teams(id, name, slug)')
      .eq('token', token)
      .maybeSingle()

    if (inviteErr) {
      console.error('[GET /api/teams/accept] invite lookup error:', inviteErr)
      return NextResponse.json({ error: 'Failed to look up invite' }, { status: 500 })
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 409 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }

    const team = Array.isArray(invite.team) ? invite.team[0] : invite.team
    const teamRecord = team as { id: string; name: string; slug: string } | null

    if (!teamRecord) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Insert team_member (ignore conflict — user may already be a member)
    const { error: memberErr } = await supabase
      .from('team_members')
      .upsert(
        {
          team_id: invite.team_id,
          user_id: user.id,
          role: invite.role,
          invited_by: null,
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'team_id,user_id', ignoreDuplicates: false }
      )

    if (memberErr) {
      console.error('[GET /api/teams/accept] member upsert error:', memberErr)
      return NextResponse.json({ error: 'Failed to join team' }, { status: 500 })
    }

    // Mark invite accepted
    await supabase
      .from('team_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({
      team_id: teamRecord.id,
      team_name: teamRecord.name,
      team_slug: teamRecord.slug,
      role: invite.role,
    })

  } catch (err) {
    console.error('[GET /api/teams/accept]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
