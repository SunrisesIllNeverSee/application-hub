import type { MetadataRoute } from 'next'
import { createServerClient } from '@supabase/ssr'

const BASE_URL = 'https://mos2es.xyz'

export const dynamic = 'force-dynamic'

function supabasePublic() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = supabasePublic()

  const { data: programs } = await supabase
    .from('programs')
    .select('slug, updated_at')
    .order('heat_score', { ascending: false })
    .limit(500)

  const programUrls: MetadataRoute.Sitemap = (programs ?? []).map((p) => ({
    url: `${BASE_URL}/hub/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/hub`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/hub/timeline`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...programUrls,
  ]
}
