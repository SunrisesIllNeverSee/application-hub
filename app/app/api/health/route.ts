import { NextResponse } from 'next/server'

// Liveness probe advertised by /.well-known/api-catalog. No auth, no data.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'aqua-application-hub',
      local_first: process.env.AQUA_LOCAL_FIRST === '1',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
