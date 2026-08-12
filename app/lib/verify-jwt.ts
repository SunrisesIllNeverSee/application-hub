import { createRemoteJWKSet, jwtVerify } from 'jose'

// Local JWT verification using Supabase's JWKS endpoint.
//
// Supabase's /auth/v1/user endpoint has a known bug rejecting ES256 JWTs
// (github.com/supabase/supabase/issues/42810, #42244, #44530). The token
// is valid — the browser session works via cookie — but
// supabase.auth.getUser(token) fails with "bad_jwt: verification error".
//
// Fix: verify the JWT locally using the JWKS public key endpoint, which
// works correctly. This is the recommended approach for asymmetric keys
// per Supabase docs: "Verify JWTs locally without server calls."
//
// Used by: all Bearer JWT auth paths (extension, MCP, API routes).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
  cacheMaxAge: 600_000, // 10 min cache
})

export type VerifiedUser = {
  id: string
  email: string | null
  role: string | null
}

/**
 * Verify a Supabase JWT locally using JWKS.
 * Returns the user ID if valid, throws if invalid/expired.
 */
export async function verifySupabaseJWT(token: string): Promise<VerifiedUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  })
  return {
    id: payload.sub as string,
    email: (payload as any).email ?? null,
    role: (payload as any).role ?? null,
  }
}
