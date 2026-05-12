import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile/',
          '/workspace/',
          '/questions',
          '/applications/submit',
        ],
      },
    ],
    sitemap: 'https://mos2es.xyz/sitemap.xml',
    host: 'https://mos2es.xyz',
  }
}
