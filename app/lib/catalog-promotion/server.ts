// Server-only: creates the service-role client. The client never leaves the
// server and is used only after the caller's identity has been established
// with the user-scoped client (auth.getUser()). Never import this from a
// client component (it reads SUPABASE_SERVICE_ROLE_KEY).

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export function catalogServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export { json, unavailable, dbError, isCatalogCurator, readJsonBody, CANDIDATE_COLUMNS, SOURCE_COLUMNS } from './http.ts'
