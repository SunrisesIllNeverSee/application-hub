import { assertPublishableKey, isPlaceholderValue, PublishableKeyError } from './lib/public-catalog-config.mjs'
// IR-015 — local-first flag pairing is REQUIRED at build time. The
// server flag (AQUA_LOCAL_FIRST) gates route handlers; the public twin
// (NEXT_PUBLIC_AQUA_LOCAL_FIRST) gates direct client→Supabase writes.
// Shipping the server flag without the public twin leaves private client
// writes ungated — fail the build instead of deploying a half-closed
// boundary.
const lfServer = ['1', 'true'].includes((process.env.AQUA_LOCAL_FIRST ?? '').trim().toLowerCase())
const lfClient = ['1', 'true'].includes((process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST ?? '').trim().toLowerCase())
if (lfServer !== lfClient) {
  throw new Error(
    `local-first flag mismatch: AQUA_LOCAL_FIRST=${process.env.AQUA_LOCAL_FIRST ?? '<unset>'} ` +
      `but NEXT_PUBLIC_AQUA_LOCAL_FIRST=${process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST ?? '<unset>'}. ` +
      'Set BOTH (or neither) — a mismatched pair leaves private client writes ungated.',
  )
}
// M09 hardening H1 — production fails CLOSED. The server guard treats a
// production runtime as local-first unless AQUA_LOCAL_FIRST is explicitly
// '0'/'false' (lib/local-first-guard.ts). A Vercel production build must
// therefore carry the client twin too, or explicitly opt BOTH out with '0'.
const lfExplicitOff = (v) => ['0', 'false'].includes((v ?? '').trim().toLowerCase())
if (
  process.env.VERCEL_ENV === 'production' &&
  !lfClient &&
  !(lfExplicitOff(process.env.AQUA_LOCAL_FIRST) && lfExplicitOff(process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST))
) {
  throw new Error(
    'local-first is ON by default in production (server guard fails closed). ' +
      'Set AQUA_LOCAL_FIRST=1 and NEXT_PUBLIC_AQUA_LOCAL_FIRST=1, or explicitly opt BOTH out with 0.',
  )
}

// M09b B1.5 — /.well-known/aqua-catalog.json publishes NEXT_PUBLIC_SUPABASE_ANON_KEY
// to agents. Refuse to BUILD with a secret or service-role-shaped value there
// (it would also ship in every browser bundle). Placeholders are allowed.
{
  const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isPlaceholderValue(k)) {
    try {
      assertPublishableKey(k)
    } catch (e) {
      if (e instanceof PublishableKeyError && e.code !== 'unrecognized') {
        throw new Error(`NEXT_PUBLIC_SUPABASE_ANON_KEY refused at build time: ${e.message}. Only the publishable (anon) key belongs in a NEXT_PUBLIC_ variable.`)
      }
    }
  }
}

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
          // Local-first BYOK egress: the browser calls provider APIs directly
          // with the user's vault-held key — these origins must be reachable.
          // Ollama covers the default localhost port only; custom HTTPS
          // endpoints need an owner-approved CSP addition.
          // BYOK: users may point providers at arbitrary endpoints — https:
          // covers tunnels/WAN daemons; localhost:11434 keeps the common
          // local-Ollama path. (LAN http endpoints remain browser-blocked
          // by Private Network Access regardless.) *.supabase.co already
          // allows arbitrary projects, so the boundary is honest either way.
          // BYOK: users may point providers at arbitrary endpoints — https:
          // covers tunnels/WAN daemons; localhost:11434 keeps the common
          // local-Ollama path. (LAN http endpoints remain browser-blocked
          // by Private Network Access regardless.) *.supabase.co already
          // allows arbitrary projects, so the boundary is honest either way.
          // wss://*.supabase.co is required for WebKit/Safari: Chromium's
          // 'self' covers same-origin websockets per CSP3, WebKit's does not.
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https: http://localhost:11434 http://127.0.0.1:11434",
          "frame-src 'self' https://js.stripe.com",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    ]

    // Pages that support Markdown content negotiation (Accept: text/markdown)
    const varyPages = [
      '/', '/about', '/about/scoring', '/contact', '/privacy', '/support', '/agents',
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

    // Link headers for AI agent discovery on /.well-known/* routes
    const wellKnownLinkHeaders = [
      {
        source: '/.well-known/agent.json',
        headers: [
          ...securityHeaders,
          { key: 'Link', value: '<https://aquaidp.xyz/.well-known/agent.json>; rel="agent"' },
        ],
      },
      {
        source: '/.well-known/api-catalog',
        headers: [
          ...securityHeaders,
          { key: 'Link', value: '<https://aquaidp.xyz/.well-known/api-catalog>; rel="service-desc"; type="application/linkset+json"' },
        ],
      },
      {
        source: '/.well-known/http-message-signatures-directory',
        headers: [
          ...securityHeaders,
          { key: 'Content-Type', value: 'application/jwk-set+json' },
        ],
      },
    ]

    // Catch-all for security headers on all other routes
    const catchAll = [{
      source: '/(.*)',
      headers: securityHeaders,
    }]

    return [...varyHeaders, ...wellKnownLinkHeaders, ...catchAll]
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
