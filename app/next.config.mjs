/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: false },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    const vary = 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch'

    // Security headers applied to all routes
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co https://api.stripe.com",
          "frame-src 'self' https://js.stripe.com",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    ]

    // Pages that support Markdown content negotiation (Accept: text/markdown)
    const varyPages = [
      '/', '/about', '/about/scoring', '/contact', '/privacy', '/agents',
      '/faq', '/developers', '/application-infrastructure',
      '/concepts/answer-reuse', '/concepts/fit-score', '/concepts/application-graph',
      '/concepts/answer-lineage', '/concepts/smart-matcher',
      '/guides/how-to-reuse-application-answers', '/guides/how-to-compare-accelerator-fit',
      '/guides/how-to-build-an-answer-bank',
      '/vs/founderapp', '/vs/manual-application-tracking', '/vs/spreadsheets-for-applications',
    ]

    const varyHeaders = varyPages.map((source) => ({
      source,
      headers: [{ key: 'Vary', value: vary }, ...securityHeaders],
    }))

    // Catch-all for security headers on all other routes
    const catchAll = [{
      source: '/(.*)',
      headers: securityHeaders,
    }]

    return [...varyHeaders, ...catchAll]
  },
  async redirects() {
    return [
      { source: '/today', destination: '/dash', permanent: true },
      { source: '/hub', destination: '/applications', permanent: true },
      { source: '/hub/:path*', destination: '/applications/:path*', permanent: true },
      { source: '/bank', destination: '/questions', permanent: true },
      { source: '/bank/:path*', destination: '/questions/:path*', permanent: true },
      { source: '/archive/questions', destination: '/questions?view=archive', permanent: true },
      { source: '/funders', destination: '/applications?view=funders', permanent: true },
    ]
  },
}
export default nextConfig
