import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  // A2A Protocol Agent Card — https://a2a-protocol.org/latest/specification/
  const card = {
    name: 'AQUA Application Hub',
    version: '1.0.0',
    description:
      'Founder-first application infrastructure — portable application graph of recurring questions, reusable answers, fit signals, and review history. Local MCP server with 27 tools for agent environments.',
    url: 'https://mos2es.xyz',
    protocolVersion: '0.3.0',
    supportedInterfaces: [
      {
        url: 'https://mos2es.xyz/api',
        protocolBinding: 'HTTP+JSON',
        protocolVersion: '0.3.0',
      },
      {
        url: 'https://mos2es.xyz/.well-known/mcp',
        protocolBinding: 'MCP',
        protocolVersion: '1.0',
      },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: 'program-search',
        name: 'Program Search',
        description: 'Search accelerator, grant, fellowship, and startup programs',
      },
      {
        id: 'question-bank',
        name: 'Question Bank',
        description: 'Browse recurring application questions and universal questions',
      },
      {
        id: 'rankings',
        name: 'Program Rankings',
        description: 'Get program rankings and heat scores',
      },
      {
        id: 'answer-reuse',
        name: 'Answer Reuse',
        description: 'Save, review, and stress-test application answers for reuse across programs',
      },
      {
        id: 'fit-score',
        name: 'Fit Score',
        description: 'Compare opportunity fit between a profile and programs',
      },
    ],
    provider: {
      organization: 'Ello Cello LLC',
      url: 'https://mos2es.xyz',
    },
    authentication: {
      schemes: ['oauth2'],
      credentials: [],
      description:
        'Public tools (programs, questions, rankings) work without auth. Authenticated tools require a Supabase session JWT. See /.well-known/oauth-authorization-server.',
    },
  }

  return new NextResponse(JSON.stringify(card, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
