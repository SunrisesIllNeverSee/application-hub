// `aqua-companion doctor [--json] [--offline]`: a self-check that never
// crashes and never changes anything (setup.mjs doctorReport).
import { out } from './io.mjs'
import { Session } from './registry.mjs'
import { doctorReport } from './setup.mjs'

const MARK = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' }

export async function cmdDoctor(ctx) {
  let report
  try {
    // Opening the workspace needs its passphrase; without one, doctor still reports everything else.
    let session = new Session(ctx, { keychain: Boolean(ctx.flags.keychain) })
    try {
      session = await session.init()
    } catch (e) {
      session.mode = 'locked'
      session.lockReason = e?.message ?? String(e)
    }
    const s = session.setupContext()
    const state = s.state
    s.state = () => (session.mode === 'locked' ? { mode: 'locked', root: null, workspace_id: null, reason: session.lockReason } : state())
    report = await doctorReport(s, { live: !ctx.flags.offline })
  } catch (e) {
    report = { status: 'ok', overall: 'fail', checks: [{ name: 'doctor', status: 'fail', message: e?.message ?? String(e) }] }
  }
  if (ctx.flags.json) out(ctx, JSON.stringify(report, null, 2))
  else {
    for (const c of report.checks) out(ctx, `${MARK[c.status] ?? c.status}  ${c.name}: ${c.message}`)
    out(ctx, `overall: ${report.overall}`)
  }
  return report.overall === 'fail' ? 1 : 0
}
