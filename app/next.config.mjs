/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/today',             destination: '/dash',                   permanent: true },
      { source: '/hub',               destination: '/applications',           permanent: true },
      { source: '/hub/:path*',        destination: '/applications/:path*',    permanent: true },
      { source: '/bank',              destination: '/questions',              permanent: true },
      { source: '/bank/:path*',       destination: '/questions/:path*',       permanent: true },
      { source: '/archive/questions', destination: '/questions?view=archive', permanent: true },
      { source: '/funders',           destination: '/applications?view=funders', permanent: true },
    ]
  },
}

export default nextConfig
