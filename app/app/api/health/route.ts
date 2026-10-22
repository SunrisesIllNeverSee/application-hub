import { NextResponse } from 'next/server'
import { isLocalFirst } from '@/lib/local-first-guard'

// Liveness probe advertised by /.well-known/api-catalog. No auth, no data.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'aqua-application-hub',
      local_first: isLocalFirst(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
