import type { MetadataRoute } from 'next'
const BASE_URL = 'https://mos2es.xyz'
export const dynamic = 'force-dynamic'

// Public, indexable pages only. Auth-protected routes (/applications/*, /hub/*,
// /questions, /dash, /profile, /workspace) are excluded from the sitemap because
// they redirect to /login, which causes "Duplicate without user-selected canonical"
// errors in Google Search Console.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trustLastModified = new Date('2026-08-21T00:00:00Z')
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: trustLastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/about/scoring`, lastModified: trustLastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/developers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/contact`, lastModified: trustLastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: trustLastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/agents`, lastModified: trustLastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/application-infrastructure`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/vs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/concepts/answer-reuse`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/concepts/fit-score`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/concepts/application-graph`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/concepts/answer-lineage`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/concepts/smart-matcher`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/guides/how-to-reuse-application-answers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/guides/how-to-compare-accelerator-fit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/guides/how-to-build-an-answer-bank`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/vs/founderapp`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/vs/manual-application-tracking`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/vs/spreadsheets-for-applications`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]
}
