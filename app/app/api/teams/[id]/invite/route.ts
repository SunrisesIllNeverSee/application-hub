import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import {
  TEAMS_AVAILABLE,
  TEAMS_COMING_SOON_MESSAGE,
  buildInviteAcceptUrl,
  escapeHtml,
  mapDeliveryStatus,
  type InviteDelivery,
} from '@/lib/team-invite'

interface InviteBody {
  email?: unknown
  role?: unknown
}

// POST /api/teams/[id]/invite — invite a member by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!TEAMS_AVAILABLE) {
    return NextResponse.json({ error: TEAMS_COMING_SOON_MESSAGE }, { status: 403 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = (await params).id

    // Verify caller is an owner or admin of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only team owners and admins can invite members.' }, { status: 403 })
    }

    // Load team name for the email
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const body = await req.json() as InviteBody
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = typeof body.role === 'string' && ['admin', 'member'].includes(body.role)
      ? body.role
      : 'member'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    // Upsert invite — renews token + expiry on re-invite
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: invite, error: inviteErr } = await supabase
      .from('team_invites')
      .upsert(
        {
          team_id: teamId,
          email,
          role,
          invited_by: user.id,
          expires_at: newExpiry,
          accepted_at: null,
        },
        { onConflict: 'team_id,email' }
      )
      .select('id, token, email, role, expires_at')
      .single()

    if (inviteErr || !invite) {
      console.error('[POST /api/teams/[id]/invite] upsert error:', inviteErr?.code, inviteErr?.message)
      // team_invites writes are owner-only under RLS (ti_owner_manage), so an
      // admin who passes the role check above is still refused by the database.
      if (inviteErr?.code === '42501') {
        return NextResponse.json(
          { error: 'Only the team owner can create invitations. Ask the owner to invite this person.' },
          { status: 403 }
        )
      }
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Send invite email via Resend. 'sent' means Resend accepted the message
    // (HTTP 2xx), never that it reached the inbox; every other outcome is
    // reported as it happened so the UI can offer the link for manual sharing.
    const acceptUrl = buildInviteAcceptUrl(getSiteUrl(), invite.token)
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@aquaidp.xyz'
    const safeTeamName = escapeHtml(team.name)
    const safeRole = escapeHtml(invite.role)
    let delivery: InviteDelivery

    if (!resendApiKey) {
      console.warn('[POST /api/teams/[id]/invite] RESEND_API_KEY not set — email not sent')
      delivery = mapDeliveryStatus({ apiKeyPresent: false })
    } else {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:32px 24px">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">You've been invited to join ${safeTeamName}</h2>
  <p style="color:#555;margin-bottom:24px">
    You've been invited to join <strong>${safeTeamName}</strong> on Application Hub as a ${safeRole}.
    Click the link below to accept — the invitation expires in 7 days.
  </p>
  <a href="${acceptUrl}"
     style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
    Accept Invitation
  </a>
  <p style="margin-top:24px;font-size:12px;color:#999">
    Or copy this link: ${acceptUrl}
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0">
  <p style="font-size:12px;color:#aaa">
    Application Hub — the application intelligence layer for founders
  </p>
</body>
</html>`

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `Application Hub <${fromEmail}>`,
            to: email,
            subject: `You've been invited to join ${team.name} on Application Hub`,
            html: emailHtml,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        delivery = mapDeliveryStatus({ apiKeyPresent: true, httpStatus: emailRes.status })
        if (delivery === 'failed') {
          // Provider error bodies can echo request data; log status only.
          console.error('[POST /api/teams/[id]/invite] Resend rejected the email, status:', emailRes.status)
        }
      } catch (emailErr) {
        delivery = mapDeliveryStatus({ apiKeyPresent: true, threw: true })
        console.error('[POST /api/teams/[id]/invite] email send failed:', emailErr instanceof Error ? emailErr.name : 'unknown')
      }
    }

    // accept_url is returned only when the email did not go out, so the
    // inviter can share it by hand. Acceptance is still bound to the invited
    // email address by the accept_team_invite RPC.
    return NextResponse.json({
      invited: true,
      invite_id: invite.id,
      email,
      role: invite.role,
      delivery,
      ...(delivery === 'sent' ? {} : { accept_url: acceptUrl }),
    })

  } catch (err) {
    console.error('[POST /api/teams/[id]/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
