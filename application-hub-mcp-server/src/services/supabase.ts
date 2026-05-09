import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS, used for all public tool queries
export const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// User-scoped client — for authenticated tools, honors RLS via user JWT
export function userClient(token: string): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
