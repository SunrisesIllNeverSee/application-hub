import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ============================================================
// POST /api/cron/recruiter
// ============================================================
// Called by the recruiter-agent Edge Function (or manually).
// Auth: Bearer CRON_SECRET.
//
// Logic:
//   1. Query user_program_fit for all users, filtering to
//      composite_score >= FIT_THRESHOLD and programs not yet
//      applied to by that user.
//   2. Group top N matches per user.
//   3. Skip (user, program, week) combos already in recruiter_alerts.
//   4. Send one email per user via Resend listing their top matches.
//   5. Insert deduplication rows into recruiter_alerts.
// ============================================================

const FIT_THRESHOLD = 25      // composite_score minimum to qualify
const TOP_PER_USER = 3        // max matches in one email
const BATCH_SIZE = 50         // users processed per run

type FitRow = {
  user_id: string
  program_id: string
  composite_score: number
  fit_score: number
  programs: {
    id: string
    name: string
    slug: string
    type: string
    deadline_at: string | null
    is_rolling: boolean
    check_size_max: number | null
    program_value_score: number | null
  } | null
}

type SentRow = {
  user_id: string
  program_id: string
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role env vars not set')
  return createSupabaseClient(url, key)
}

function verifyCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const secret = process.env.CRON_SECRET ?? ''
  return secret.length > 0 && token === secret
}

function deadlineLabel(deadline_at: string | null, is_rolling: boolean): string {
  if (is_rolling) return 'Rolling admissions'
  if (!deadline_at) return 'Deadline unknown'
  const d = new Date(deadline_at)
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 0) return 'Closed'
  if (daysLeft === 0) return 'Closes today!'
  if (daysLeft <= 7) return `Closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function typeLabel(type: string): string {
  const m: Record<string, string> = {
    accelerator: 'Accelerator', accel: 'Accelerator',
    grant: 'Grant', fellowship: 'Fellowship',
    vc: 'VC Fund', vc_fund: 'VC Fund',
    corp: 'Corporate', other: 'Program',
  }
  return m[type] ?? 'Program'
}

function buildEmailHtml(
  userEmail: string,
  matches: FitRow[],
  appUrl: string
): string {
  const rows = matches.map(m => {
    const p = m.programs
    if (!p) return ''
    const fitPct = Math.round((m.fit_score ?? 0) * 100)
    const composite = Math.round(m.composite_score ?? 0)
    const deadlineStr = deadlineLabel(p.deadline_at, p.is_rolling)
    const programUrl = `${appUrl}/hub/${p.slug}`
    const startUrl = `${appUrl}/workspace/${p.id}`
    const checkSize = p.check_size_max
      ? `$${(p.check_size_max / 1000).toFixed(0)}k funding`
      : ''
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <a href="${programUrl}" style="font-size:15px;font-weight:600;color:#111827;text-decoration:none;">${p.name}</a>
                <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:600;border-radius:4px;">
                  ${typeLabel(p.type)}
                </span>
              </td>
              <td style="text-align:right;white-space:nowrap;">
                <span style="font-size:13px;font-weight:700;color:#2563eb;">${fitPct}% fit</span>
                <span style="font-size:11px;color:#9ca3af;margin-left:4px;">· ${composite} composite</span>
              </td>
            </tr>
            <tr>
              <td style="padding-top:4px;">
                <span style="font-size:12px;color:#6b7280;">${deadlineStr}</span>
                ${checkSize ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">· ${checkSize}</span>` : ''}
              </td>
              <td style="text-align:right;padding-top:4px;">
                <a href="${startUrl}" style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:500;">
                  Start application →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Application Hub</span>
            <p style="color:#93c5fd;font-size:13px;margin:4px 0 0;">Your weekly opportunity brief</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="font-size:15px;color:#374151;margin:0 0 6px;">
              Here are your top ${matches.length} matched program${matches.length !== 1 ? 's' : ''} this week.
            </p>
            <p style="font-size:13px;color:#9ca3af;margin:0 0 20px;">
              Fit scores are based on your profile coverage and program DNA weights.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <a href="${appUrl}/hub" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;">
              Browse all programs →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;background:#f9fafb;">
            <p style="font-size:11px;color:#9ca3af;margin:0;">
              Application Hub by Ello Cello LLC · 
              <a href="${appUrl}/profile/settings" style="color:#9ca3af;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildEmailText(matches: FitRow[], appUrl: string): string {
  const lines = matches.map((m, i) => {
    const p = m.programs
    if (!p) return ''
    const fitPct = Math.round((m.fit_score ?? 0) * 100)
    const deadlineStr = deadlineLabel(p.deadline_at, p.is_rolling)
    return `${i + 1}. ${p.name} — ${fitPct}% fit · ${deadlineStr}\n   ${appUrl}/hub/${p.slug}`
  })
  return [
    'Your top program matches this week:\n',
    ...lines,
    `\nBrowse all: ${appUrl}/hub`,
    `\nUnsubscribe: ${appUrl}/profile/settings`,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://mos2es.xyz').replace(/\/$/, '')
  const resendKey = process.env.RESEND_API_KEY ?? ''
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@mos2es.xyz'

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createAdminClient()
  const weekBucket = new Date(
    Date.now() - ((new Date().getDay()) * 86_400_000)
  ).toISOString().split('T')[0] // ISO week start (Sunday)

  // 1. Fetch all high-fit matches (not yet applied to by the user this week)
  const { data: fitRows, error: fitErr } = await supabase
    .from('user_program_fit')
    .select('user_id, program_id, composite_score, fit_score, programs(id, name, slug, type, deadline_at, is_rolling, check_size_max, program_value_score)')
    .gte('composite_score', FIT_THRESHOLD)
    .order('composite_score', { ascending: false })
    .limit(BATCH_SIZE * TOP_PER_USER * 3) // over-fetch for dedup
    .returns<FitRow[]>()

  if (fitErr || !fitRows?.length) {
    return NextResponse.json({ sent: 0, skipped: 0, note: 'No qualifying matches found' })
  }

  // 2. Fetch programs already applied to (any status)
  const userIdsSet: Record<string, true> = {}
  for (const r of fitRows) userIdsSet[r.user_id] = true
  const userIds = Object.keys(userIdsSet)
  const { data: appliedRows } = await supabase
    .from('user_applications')
    .select('user_id, program_id')
    .in('user_id', userIds)

  const appliedSet = new Set((appliedRows ?? []).map(r => `${r.user_id}:${r.program_id}`))

  // 3. Fetch already-sent this week
  const { data: sentRows } = await supabase
    .from('recruiter_alerts')
    .select('user_id, program_id')
    .eq('week_bucket', weekBucket)
    .in('user_id', userIds)
    .returns<SentRow[]>()

  const sentSet = new Set((sentRows ?? []).map(r => `${r.user_id}:${r.program_id}`))

  // 4. Group top matches per user
  const userMatchMap: Record<string, FitRow[]> = {}
  for (const row of fitRows) {
    const key = `${row.user_id}:${row.program_id}`
    if (appliedSet.has(key) || sentSet.has(key)) continue
    if (!row.programs) continue
    // Skip closed programs
    if (row.programs.deadline_at) {
      const daysLeft = (new Date(row.programs.deadline_at).getTime() - Date.now()) / 86_400_000
      if (daysLeft < 0) continue
    }
    if (!userMatchMap[row.user_id]) userMatchMap[row.user_id] = []
    if (userMatchMap[row.user_id].length < TOP_PER_USER) {
      userMatchMap[row.user_id].push(row)
    }
  }

  // 5. Fetch user emails from auth.users via admin
  const eligibleUsers = Object.keys(userMatchMap).slice(0, BATCH_SIZE)
  if (eligibleUsers.length === 0) {
    return NextResponse.json({ sent: 0, skipped: fitRows.length, note: 'All matches already sent this week or applied to' })
  }

  const userEmailMap: Record<string, string> = {}
  for (const uid of eligibleUsers) {
    const { data: userData } = await supabase.auth.admin.getUserById(uid)
    if (userData?.user?.email) {
      userEmailMap[uid] = userData.user.email
    }
  }

  // 6. Send emails + record
  let sent = 0
  let failed = 0
  const alertInserts: { user_id: string; program_id: string; week_bucket: string; composite_score: number }[] = []

  for (const userId of eligibleUsers) {
    const email = userEmailMap[userId]
    if (!email) continue
    const matches = userMatchMap[userId]
    if (!matches.length) continue

    const subject = matches.length === 1
      ? `New match: ${matches[0].programs?.name ?? 'a program'} fits your profile`
      : `Your ${matches.length} top program matches this week`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `Application Hub <${fromEmail}>`,
          to: email,
          subject,
          html: buildEmailHtml(email, matches, appUrl),
          text: buildEmailText(matches, appUrl),
        }),
      })

      if (res.ok) {
        sent++
        for (const m of matches) {
          alertInserts.push({
            user_id: userId,
            program_id: m.program_id,
            week_bucket: weekBucket,
            composite_score: m.composite_score,
          })
        }
      } else {
        const body = await res.json()
        console.error('[recruiter] Resend error for', email, body)
        failed++
      }
    } catch (err) {
      console.error('[recruiter] fetch error for', email, err)
      failed++
    }
  }

  // 7. Insert dedup rows
  if (alertInserts.length > 0) {
    const { error: insertErr } = await supabase
      .from('recruiter_alerts')
      .upsert(alertInserts, { onConflict: 'user_id,program_id,week_bucket', ignoreDuplicates: true })
    if (insertErr) {
      console.error('[recruiter] dedup insert error:', insertErr)
    }
  }

  return NextResponse.json({
    sent,
    failed,
    eligible_users: eligibleUsers.length,
    total_matches_queued: alertInserts.length,
    week_bucket: weekBucket,
  })
}
