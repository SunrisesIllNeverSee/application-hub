/**
 * app/.well-known/oauth-protected-resource/route.ts
 *
 * OAuth Protected Resource Metadata (RFC 9728) for aquaidp.xyz.
 *
 * aquaidp.xyz has both public and authenticated endpoints. This document
 * declares which endpoints are public and which require auth.
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  const metadata = {
    resource: 'https://aquaidp.xyz',
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    bearer_methods_supported: ['header', 'cookie'],
    auth_md: 'https://aquaidp.xyz/.well-known/auth.md',
    public_endpoints: [
      'https://aquaidp.xyz/',
      'https://aquaidp.xyz/about',
      'https://aquaidp.xyz/about/scoring',
      'https://aquaidp.xyz/faq',
      'https://aquaidp.xyz/developers',
      'https://aquaidp.xyz/agents',
      'https://aquaidp.xyz/llms.txt',
      'https://aquaidp.xyz/openapi.json',
      'https://aquaidp.xyz/.well-known/mcp',
    ],
    protected_endpoints: [
      'https://aquaidp.xyz/api/auth/token',
      'https://aquaidp.xyz/api/profile/identity',
      'https://aquaidp.xyz/api/profile/fundscore',
      'https://aquaidp.xyz/mcp',
    ],
    notes:
      'Public pages and the public catalog work without auth. Signed-in routes use the browser session. POST /mcp serves the public catalog unauthenticated, and serves hosted personal-workspace tools when it carries Authorization: Bearer <Supabase access token>. Private answers are local-first: they live in the user\'s encrypted browser vault and are never served by any API. See /.well-known/auth.md.',
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
