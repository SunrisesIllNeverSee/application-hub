import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export async function getRequestUser(req: Request) {
  let supabase = await createClient()
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (cookieUser) {
    return {
      supabase,
      user: cookieUser,
      accessToken: session?.access_token ?? null,
      authSource: 'cookie' as const,
    }
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      supabase,
      user: null,
      accessToken: null,
      authSource: null,
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return {
      supabase,
      user: null,
      accessToken: null,
      authSource: null,
    }
  }

  const jwt = authHeader.slice(7)
  const extClient = createSupabaseClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const {
    data: { user: bearerUser },
  } = await extClient.auth.getUser(jwt)

  if (!bearerUser) {
    return {
      supabase,
      user: null,
      accessToken: null,
      authSource: null,
    }
  }

  supabase = extClient as typeof supabase
  return {
    supabase,
    user: bearerUser,
    accessToken: jwt,
    authSource: 'bearer' as const,
  }
}
