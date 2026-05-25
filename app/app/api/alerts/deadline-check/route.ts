import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ============================================================
// POST /api/alerts/deadline-check
// ============================================================
// Called by the Supabase Edge Function cron (supabase/functions/deadline-alerts)
// or manually. Auth: Bearer token matching CRON_SECRET env var OR
// Supabase service role key.
//
// Logic:
//   1. Find all user_applications WHERE status IN ('saved','drafting')
//      joined with programs WHERE deadline_at IS NOT NULL.
//   2. For each application, check whether the deadline falls within
//      a 30d / 7d / 24h window relative to NOW().
//   3. Skip (user, program, window) combos already recorded in
//      deadline_alerts.
//   4. Insert the new alert row, then send an email via Resend.
// ============================================================

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

type AlertWindow = '30d' | '7d' | '24h'

interface ApplicationRow {
  user_id: string
  program_id: string
  programs: {
    name: string
    deadline_at: string
  } | null
}

interface DeadlineAlertRow {
  user_id: string
  program_id: string
  alert_window: AlertWindow
}

interface UserProfileRow {
  user_id: string
  deadline_alerts_enabled: boolean
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role env vars are not set')
  }
  return createSupabaseClient(url, key)
}

/** Returns which alert windows fire for a deadline that is `msUntil` ms away. */
function windowsForMs(msUntil: number): AlertWindow[] {
  const windows: AlertWindow[] = []
  const MS_30D = 30 * 24 * 60 * 60 * 1000
  const MS_7D  =  7 * 24 * 60 * 60 * 1000
  const MS_24H =      24 * 60 * 60 * 1000

  // Window fires if deadline is AT or BELOW the threshold (and still in the future)
  if (msUntil > 0 && msUntil <= MS_30D) windows.push('30d')
  if (msUntil > 0 && msUntil <= MS_7D)  windows.push('7d')
  if (msUntil > 0 && msUntil <= MS_24H) windows.push('24h')
  return windows
}

function daysHoursLabel(msUntil: number): string {
  const hours = Math.round(msUntil / (60 * 60 * 1000))
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`
  const days = Math.round(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}

async function sendDeadlineEmail(
  to: string,
  programName: string,
  timeLabel: string,
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[deadline-check] RESEND_API_KEY is not set — skipping email send')
    return false
  }

  const subject = `Your ${programName} deadline is in ${timeLabel}`
  const html = [
    '<p>Hi,</p>',
    '<p>',
    `  Your <strong>${programName}</strong> application deadline is in`,
    `  <strong>${timeLabel}</strong>.`,
    '</p>',
    '<p>',
    '  Your application is saved in Application Hub but has not been submitted.',
    '  Log in now to finish and submit before the deadline.',
    '</p>',
    '<p style="margin-top:24px;font-size:12px;color:#888;">',
    '  You are receiving this because you have an in-progress application on',
    '  Application Hub. To stop deadline alerts, visit Profile &rarr; Settings',
    '  and disable deadline notifications.',
    '</p>',
  ].join('\n')

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'alerts@mos2es.xyz',
      to,
      subject,
      html,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    console.error('[deadline-check] Resend error:', resp.status, body)
    return false
  }

  return true
}

// ------------------------------------------------------------
// Auth check
// ------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token || !cronSecret) return false
  return token === cronSecret
}

// ------------------------------------------------------------
// Route handler
// ------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()

  try {
    // 1. Fetch all in-progress applications with a program deadline
    const { data: applications, error: appsErr } = await admin
      .from('user_applications')
      .select(`
        user_id,
        program_id,
        programs!inner (
          name,
          deadline_at
        )
      `)
      .in('status', ['saved', 'drafting'])
      .not('programs.deadline_at', 'is', null)

    if (appsErr) {
      console.error('[deadline-check] fetch applications error:', appsErr)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }

    const rows = (applications ?? []) as unknown as ApplicationRow[]

    if (rows.length === 0) {
      return NextResponse.json({ checked: 0, sent: 0 })
    }

    // Collect all (user_id, program_id) pairs to batch-check existing alerts
    const userProgramPairs = rows.map((r) => ({
      user_id: r.user_id,
      program_id: r.program_id,
    }))

    // 2. Fetch already-sent alert records for these pairs
    // Build OR filter: each pair must match both user_id AND program_id
    const orFilter = userProgramPairs
      .map((p) => `and(user_id.eq.${p.user_id},program_id.eq.${p.program_id})`)
      .join(',')

    const { data: existingAlerts, error: alertsErr } = await admin
      .from('deadline_alerts')
      .select('user_id, program_id, alert_window')
      .or(orFilter)

    if (alertsErr) {
      console.error('[deadline-check] fetch existing alerts error:', alertsErr)
      return NextResponse.json({ error: 'Failed to fetch existing alerts' }, { status: 500 })
    }

    // Build a Set for O(1) dedup lookup: "userId:programId:window"
    const sentSet = new Set<string>()
    for (const a of (existingAlerts ?? []) as DeadlineAlertRow[]) {
      sentSet.add(`${a.user_id}:${a.program_id}:${a.alert_window}`)
    }

    // 3. Check which users have alerts disabled in their profile
    const allUserIds = rows.map((r) => r.user_id)
    const uniqueUserIds = allUserIds.filter((id, idx) => allUserIds.indexOf(id) === idx)

    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, deadline_alerts_enabled')
      .in('user_id', uniqueUserIds)

    const alertsDisabledSet = new Set<string>()
    for (const p of (profiles ?? []) as UserProfileRow[]) {
      if (p.deadline_alerts_enabled === false) {
        alertsDisabledSet.add(p.user_id)
      }
    }

    // 4. For each application, determine which windows need sending
    type PendingAlert = {
      userId: string
      programId: string
      programName: string
      window: AlertWindow
      msUntil: number
    }

    const pending: PendingAlert[] = []

    for (const row of rows) {
      if (!row.programs?.deadline_at) continue
      if (alertsDisabledSet.has(row.user_id)) continue

      const deadlineMs = new Date(row.programs.deadline_at).getTime()
      const msUntil = deadlineMs - now
      const windows = windowsForMs(msUntil)

      for (const w of windows) {
        const key = `${row.user_id}:${row.program_id}:${w}`
        if (!sentSet.has(key)) {
          pending.push({
            userId: row.user_id,
            programId: row.program_id,
            programName: row.programs.name,
            window: w,
            msUntil,
          })
        }
      }
    }

    if (pending.length === 0) {
      return NextResponse.json({ checked: rows.length, sent: 0 })
    }

    // 5. Fetch user emails for pending recipients via admin auth API
    const pendingUserIdList = pending.map((p) => p.userId)
    const pendingUserIds = pendingUserIdList.filter((id, idx) => pendingUserIdList.indexOf(id) === idx)

    const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (usersErr) {
      console.error('[deadline-check] fetch users error:', usersErr)
      return NextResponse.json({ error: 'Failed to fetch user emails' }, { status: 500 })
    }

    // Build userId -> email map filtered to recipients we actually need
    const emailMap = new Map<string, string>()
    for (const u of usersData?.users ?? []) {
      if (pendingUserIds.indexOf(u.id) !== -1 && u.email) {
        emailMap.set(u.id, u.email)
      }
    }

    // 6. Send emails and record alerts
    let sentCount = 0

    for (const alert of pending) {
      const email = emailMap.get(alert.userId)
      if (!email) {
        console.warn(`[deadline-check] no email found for user ${alert.userId} — skipping`)
        continue
      }

      const timeLabel = daysHoursLabel(alert.msUntil)

      // Insert alert row first (idempotent: UNIQUE constraint prevents duplicates)
      const { error: insertErr } = await admin
        .from('deadline_alerts')
        .insert({
          user_id: alert.userId,
          program_id: alert.programId,
          alert_window: alert.window,
          sent_at: new Date().toISOString(),
        })

      if (insertErr) {
        // 23505 = unique_violation — already sent, skip silently
        if (insertErr.code === '23505') continue
        console.error('[deadline-check] insert alert error:', insertErr)
        continue
      }

      const sent = await sendDeadlineEmail(email, alert.programName, timeLabel)
      if (sent) {
        sentCount++
      } else {
        // Roll back the alert row so it retries on next cron run.
        // We match on all three keys; sent_at is NOT NULL here (we set it above)
        // so we use a normal .eq() chain rather than .is(null).
        await admin
          .from('deadline_alerts')
          .delete()
          .eq('user_id', alert.userId)
          .eq('program_id', alert.programId)
          .eq('alert_window', alert.window)
      }
    }

    return NextResponse.json({
      checked: rows.length,
      pending: pending.length,
      sent: sentCount,
    })
  } catch (err) {
    console.error('[deadline-check] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
