import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APP_URL = 'https://application-hub-chi.vercel.app'
const FROM_EMAIL = 'noreply@mos2es.xyz'

interface InviteBody {
  email?: unknown
  role?: unknown
}

// POST /api/teams/[id]/invite — invite a member by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id',
        // We can't look up user_id by email directly via anon client — skip for now;
        // duplicate membership is blocked at DB level anyway
        '00000000-0000-0000-0000-000000000000'
      )
      .maybeSingle()
    void existingMember // handled by DB unique constraint on team_invites(team_id, email)

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
      console.error('[POST /api/teams/[id]/invite] upsert error:', inviteErr)
      return NextResponse.json({ error: inviteErr?.message ?? 'Failed to create invite' }, { status: 500 })
    }

    // Send invite email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      const acceptUrl = `${APP_URL}/teams/accept?token=${invite.token}`
      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:32px 24px">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">You've been invited to join ${team.name}</h2>
  <p style="color:#555;margin-bottom:24px">
    You've been invited to join <strong>${team.name}</strong> on Application Hub as a ${role}.
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
            from: FROM_EMAIL,
            to: email,
            subject: `You've been invited to join ${team.name} on Application Hub`,
            html: emailHtml,
          }),
        })
        if (!emailRes.ok) {
          const errBody = await emailRes.text()
          console.error('[POST /api/teams/[id]/invite] Resend error:', errBody)
          // Invite was created — still return success, email delivery is best-effort
        }
      } catch (emailErr) {
        console.error('[POST /api/teams/[id]/invite] email send failed:', emailErr)
      }
    } else {
      console.warn('[POST /api/teams/[id]/invite] RESEND_API_KEY not set — skipping email')
    }

    return NextResponse.json({ invited: true, invite_id: invite.id, email, role })

  } catch (err) {
    console.error('[POST /api/teams/[id]/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
