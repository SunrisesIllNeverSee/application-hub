import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { execSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// fundscore is a CJS module — use dynamic import to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fundscore: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fundscore = require('fundscore')
} catch {
  fundscore = null
}

interface FundScoreResult {
  overall: number
  artifacts: number
  business: number
  quality: number
  round: string
  status: string
  top_fixes: Array<{ label: string; delta: number }>
  scanned_at: string
}

/**
 * POST /api/profile/fundscore
 *
 * Runs fundscore against the user's connected GitHub repo and stores
 * the result in user_profiles.applicant_context.fund_score.
 *
 * Requires: user has github_url set in their profile.
 * Clones the repo to a temp dir, scores it, cleans up.
 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  if (!fundscore) {
    return NextResponse.json({ error: 'fundscore package not available' }, { status: 503 })
  }

  // Get the user's GitHub URL
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('github_url')
    .eq('user_id', user.id)
    .maybeSingle<{ github_url: string | null }>()

  const githubUrl = profile?.github_url
  if (!githubUrl) {
    return NextResponse.json(
      { error: 'No GitHub URL connected. Add one in Profile → About.' },
      { status: 400 }
    )
  }

  // Normalize the URL to a clone-able form
  // Accept: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  let cloneUrl = githubUrl.trim()
  if (!cloneUrl.startsWith('http') && !cloneUrl.startsWith('git@')) {
    if (cloneUrl.includes('github.com')) {
      cloneUrl = `https://${cloneUrl}`
    } else {
      cloneUrl = `https://github.com/${cloneUrl}`
    }
  }
  // Strip trailing slash and .git
  cloneUrl = cloneUrl.replace(/\.git$/, '').replace(/\/$/, '')

  // Clone to temp dir (shallow, no history)
  let tempDir: string | null = null
  try {
    tempDir = mkdtempSync(join(tmpdir(), 'fundscore-'))
    try {
      execSync(`git clone --depth 1 ${cloneUrl} repo`, {
        cwd: tempDir,
        timeout: 30_000,
        stdio: 'pipe',
      })
    } catch {
      return NextResponse.json(
        { error: `Could not clone ${cloneUrl}. Check that the repo is public.` },
        { status: 422 }
      )
    }

    const repoPath = join(tempDir, 'repo')

    // Run fundscore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = fundscore.score(repoPath) as any

    const result: FundScoreResult = {
      overall: report.scores.overallScore,
      artifacts: report.scores.artifactsScore,
      business: report.scores.businessScore,
      quality: report.scores.qualityScore,
      round: report.lens?.round ?? 'unknown',
      status: report.status,
      top_fixes: (report.fixDeltas ?? [])
        .slice(0, 5)
        .map((f: { label: string; delta: number }) => ({
          label: f.label,
          delta: f.delta,
        })),
      scanned_at: new Date().toISOString(),
    }

    // Merge into applicant_context
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('applicant_context')
      .eq('user_id', user.id)
      .maybeSingle<{ applicant_context: Record<string, unknown> | null }>()

    const current = (existing?.applicant_context ?? {}) as Record<string, unknown>
    const next = { ...current, fund_score: result }

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, applicant_context: next },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json(result)
  } finally {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}
