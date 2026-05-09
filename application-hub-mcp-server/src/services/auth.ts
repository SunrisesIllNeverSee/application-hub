import { supabase } from "./supabase.js";

/**
 * Validates a Supabase JWT and returns the authenticated user's ID.
 * Throws if the token is invalid or expired.
 */
export async function validateUserToken(token: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid or expired user token. Please re-authenticate via the Application Hub.");
  }
  return data.user.id;
}
