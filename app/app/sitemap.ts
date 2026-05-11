import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  const { data: programs } = await supabase
    .from('programs')
    .select('slug, updated_at')
    .order('heat_score', { ascending: false })
    .limit(200)

  const programUrls: MetadataRoute.Sitemap = (programs ?? []).map((p) => ({
    url: `https://mos2es.xyz/hub/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: 'https://mos2es.xyz',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://mos2es.xyz/hub',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...programUrls,
  ]
}
