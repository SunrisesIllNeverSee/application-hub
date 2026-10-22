// Production wiring for the catalog-promotion handlers (server only).

import { getRequestUser } from '@/lib/supabase/request-auth'
import { rateLimitAllow } from '@/lib/rate-limit'
import { fetchPublicApplication } from '@/lib/catalog/fetch-public'
import type { SupabaseClient } from '@supabase/supabase-js'
import { catalogServiceClient } from './server'
import type { HandlerDeps } from './handlers'

export function routeDeps(): HandlerDeps {
  return {
    async getUser(req) {
      const { user, supabase } = await getRequestUser(req)
      return { user: user ? { id: user.id } : null, userClient: supabase as unknown as SupabaseClient }
    },
    admin: catalogServiceClient,
    rateLimit: rateLimitAllow,
    fetchSource: (url) => fetchPublicApplication(url),
  }
}
