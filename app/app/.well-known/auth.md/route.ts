import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  const md = `# AQUA Application Hub — Agent Authentication

## Overview

AQUA Application Hub (mos2es.xyz) uses Supabase for authentication. Public
tools (programs, questions, rankings) work without auth. Authenticated tools
(answer bank, fit scores, application intake) require a Supabase session JWT.

## Public endpoints (no auth required)

- GET / — homepage
- GET /about — about page
- GET /about/scoring — scoring methodology
- GET /faq — FAQ
- GET /developers — developer portal
- GET /agents — agent guide
- GET /llms.txt — LLM instructions
- GET /openapi.json — OpenAPI spec
- GET /.well-known/mcp — MCP server manifest
- GET /api/programs — program search (public)
- GET /api/questions — question bank (public)
- GET /api/rankings — program rankings (public)

## Authenticated endpoints (Supabase JWT required)

- POST /api/answers — save an answer
- GET /api/answers — list saved answers
- POST /api/applications — submit an application
- GET /api/profile — get user profile
- GET /api/workspace — get workspace data
- All MCP tools in the "authenticated" category

## Authentication methods

### Browser (cookie-based)
Users sign in via the web UI at https://mos2es.xyz/login. Supabase sets a
session cookie that authenticates subsequent requests.

### Agent / extension (Bearer JWT)
Agents obtain a JWT via the OAuth flow described in
/.well-known/oauth-authorization-server, then send it as:

\`\`\`
Authorization: Bearer <jwt>
\`\`\`

### MCP server
The local MCP server (npx aqua-mcp-server) accepts a Supabase
access token via the SUPABASE_ACCESS_TOKEN environment variable.

## OAuth discovery

- Authorization server metadata: /.well-known/oauth-authorization-server
- Protected resource metadata: /.well-known/oauth-protected-resource
- Issuer: ${supabaseUrl}/auth/v1
- Registration: https://mos2es.xyz/login

## Web Bot Auth

mos2es.xyz signs outgoing bot/agent requests using Ed25519. Verification keys
are published at /.well-known/http-message-signatures-directory.
`

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
