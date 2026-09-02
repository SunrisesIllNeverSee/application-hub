/**
 * app/.well-known/oauth-authorization-server/route.ts
 *
 * OAuth Authorization Server Metadata (RFC 8414) for mos2es.xyz.
 *
 * mos2es.xyz uses Supabase for auth. This metadata bridges Supabase's
 * OIDC discovery to the OAuth standard path so scanners can verify the
 * issuer chain.
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  const metadata: Record<string, unknown> = {
    issuer: `${supabaseUrl}/auth/v1`,
    authorization_endpoint: `${supabaseUrl}/auth/v1/oauth/authorize`,
    token_endpoint: `${supabaseUrl}/auth/v1/oauth/token`,
    jwks_uri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${supabaseUrl}/auth/v1/oauth/userinfo`,
    scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256', 'ES256'],
    code_challenge_methods_supported: ['S256', 'plain'],
    require_pushed_authorization_requests: false,
    auth_md: 'https://mos2es.xyz/.well-known/auth.md',
    registration_endpoint: 'https://mos2es.xyz/login',
    agent_auth: {
      skill:
        'Public tools (programs, questions, rankings) work without auth. Authenticated tools (answer bank, fit scores, application intake) require a Supabase session JWT.',
      register_uri: 'https://mos2es.xyz/login',
      methods: [
        {
          type: 'oauth_2.0',
          flow: 'authorization_code',
          authorization_endpoint: `${supabaseUrl}/auth/v1/oauth/authorize`,
          token_endpoint: `${supabaseUrl}/auth/v1/oauth/token`,
          callback: 'https://mos2es.xyz/auth/callback',
          providers: ['github', 'twitter', 'email_magic_link'],
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          session_check: 'GET https://mos2es.xyz/api/auth/session',
        },
      ],
    },
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
