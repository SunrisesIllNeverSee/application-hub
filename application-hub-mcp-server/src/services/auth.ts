import { supabase } from "./supabase.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Validates a Supabase JWT and returns the authenticated user's ID.
//
// Three paths, tried in order:
//
// 1. OPERATOR_USER_ID env var — if set, skip JWT entirely and use this user ID.
//    This is for local single-operator setups where the MCP server runs on the
//    operator's machine with the service-role key. No token needed.
//
// 2. Supabase auth API — supabase.auth.getUser(token). Works for HS256 tokens.
//
// 3. Local JWKS verification — verify the JWT signature against the public key
//    from Supabase's JWKS endpoint. Works for ES256 tokens. Needed because
//    Supabase has a known platform bug rejecting ES256 JWTs at the auth API
//    gateway (github.com/supabase/supabase/issues/42810, #42244, #44530).

const SUPABASE_URL = process.env.SUPABASE_URL!;
const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? "";
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
  cacheMaxAge: 600_000,
});

export async function validateUserToken(token: string): Promise<string> {
  // 1. Operator mode — skip JWT, use configured user ID
  if (OPERATOR_USER_ID) {
    return OPERATOR_USER_ID;
  }

  // 2. Supabase auth API (works for HS256 tokens)
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    return data.user.id;
  }

  // 3. Local JWKS verification (works for ES256 tokens)
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (payload.sub) return payload.sub;
  } catch {
    // both paths failed
  }

  throw new Error(
    "Invalid or expired user token. Set OPERATOR_USER_ID in .mcp.json for local operator mode, or re-authenticate via the Application Hub."
  );
}
