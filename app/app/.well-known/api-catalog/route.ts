import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  // RFC 9727 linkset — API discovery
  const catalog = {
    linkset: [
      {
        anchor: 'https://aquaidp.xyz/api',
        'service-desc': [
          {
            href: 'https://aquaidp.xyz/openapi.json',
            type: 'application/json',
            title: 'AQUA Application Hub OpenAPI',
          },
        ],
        'service-doc': [
          {
            href: 'https://aquaidp.xyz/developers',
            type: 'text/html',
            title: 'AQUA Application Hub Developer Portal',
          },
          {
            href: 'https://aquaidp.xyz/.well-known/auth.md',
            type: 'text/markdown',
            title: 'AQUA Application Hub Authentication',
          },
        ],
        status: [
          {
            href: 'https://aquaidp.xyz/api/health',
            type: 'application/json',
          },
        ],
      },
      {
        anchor: 'https://aquaidp.xyz',
        'service-desc': [
          {
            href: 'https://aquaidp.xyz/openapi.json',
            type: 'application/json',
            title: 'AQUA Application Hub OpenAPI',
          },
          {
            href: 'https://aquaidp.xyz/.well-known/mcp',
            type: 'application/json',
            title: 'AQUA Application Hub MCP Server Manifest',
          },
        ],
        'service-doc': [
          {
            href: 'https://aquaidp.xyz/developers',
            type: 'text/html',
            title: 'AQUA Application Hub Developer Portal',
          },
          {
            href: 'https://aquaidp.xyz/llms.txt',
            type: 'text/plain',
            title: 'AQUA Application Hub llms.txt',
          },
        ],
      },
    ],
  }

  return new NextResponse(JSON.stringify(catalog, null, 2), {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
