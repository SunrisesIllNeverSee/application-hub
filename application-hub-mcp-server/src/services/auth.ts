import { supabase } from "./supabase.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Validates a Supabase JWT and returns the authenticated user's ID.
//
// Supabase's /auth/v1/user endpoint has a known bug rejecting ES256 JWTs
// (github.com/supabase/supabase/issues/42810, #42244, #44530). The token
// is valid but supabase.auth.getUser(token) fails with "bad_jwt".
//
// Fix: try Supabase auth API first, then fall back to local JWKS
// verification using the public key from the JWKS endpoint. This is the
// recommended approach for asymmetric keys per Supabase docs.

const SUPABASE_URL = process.env.SUPABASE_URL!;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
  cacheMaxAge: 600_000,
});

export async function validateUserToken(token: string): Promise<string> {
  // Try Supabase auth API first (works for HS256 tokens)
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    return data.user.id;
  }

  // Fallback: local JWKS verification (works for ES256 tokens)
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (payload.sub) return payload.sub;
  } catch {
    // both paths failed
  }

  throw new Error("Invalid or expired user token. Please re-authenticate via the Application Hub.");
}
