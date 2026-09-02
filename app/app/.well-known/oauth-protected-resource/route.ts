/**
 * app/.well-known/oauth-protected-resource/route.ts
 *
 * OAuth Protected Resource Metadata (RFC 9728) for mos2es.xyz.
 *
 * mos2es.xyz has both public and authenticated endpoints. This document
 * declares which endpoints are public and which require auth.
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  const metadata = {
    resource: 'https://mos2es.xyz',
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    bearer_methods_supported: ['header', 'cookie'],
    auth_md: 'https://mos2es.xyz/.well-known/auth.md',
    public_endpoints: [
      'https://mos2es.xyz/',
      'https://mos2es.xyz/about',
      'https://mos2es.xyz/about/scoring',
      'https://mos2es.xyz/faq',
      'https://mos2es.xyz/developers',
      'https://mos2es.xyz/agents',
      'https://mos2es.xyz/llms.txt',
      'https://mos2es.xyz/openapi.json',
      'https://mos2es.xyz/.well-known/mcp',
    ],
    protected_endpoints: [
      'https://mos2es.xyz/api/answers',
      'https://mos2es.xyz/api/applications',
      'https://mos2es.xyz/api/profile',
      'https://mos2es.xyz/api/workspace',
    ],
    notes:
      'Public tools (programs, questions, rankings) work without auth. Authenticated tools (answer bank, fit scores, application intake) require a Supabase session JWT.',
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
