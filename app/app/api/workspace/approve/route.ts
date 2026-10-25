// Hosted human-approval write path (m10): the client renders the exact
// wording, hashes the version record it was shown, and posts that claim
// plus its encrypted approval record file. The server re-checks
// stored-vs-claimed and writes the record row only on a match.
// Logic and rules: ./_lib/approve.ts.
import { handleHostedApprove } from './_lib/approve.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  return handleHostedApprove(req)
}
