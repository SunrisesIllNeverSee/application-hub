/**
 * app/.well-known/http-message-signatures-directory/route.ts
 *
 * Web Bot Auth — serves a JWKS so other sites can verify requests
 * signed by mos2es.xyz's bot/agent.
 */

import { NextResponse } from 'next/server'

export const revalidate = 86400 // 24h

export async function GET() {
  const jwks = {
    keys: [
      {
        kty: 'OKP',
        crv: 'Ed25519',
        kid: 'mos2es-xyz-bot-1',
        use: 'sig',
        alg: 'EdDSA',
        x: 'GCJc4y2SKFAS_icpaChff43m-zqawFVCfbrgsytKjI0',
      },
    ],
  }

  return NextResponse.json(jwks, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
