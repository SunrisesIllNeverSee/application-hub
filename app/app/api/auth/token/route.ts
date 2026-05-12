import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/token
// Returns the current user's access token for use in the Appfeeder extension.
// Requires an active session cookie — cannot be called unauthenticated.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ access_token: session.access_token })
}
