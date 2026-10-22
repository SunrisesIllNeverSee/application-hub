// /mcp serves the human page on browser GETs and rewrites MCP transport
// requests (non-GET/HEAD, or GET asking for an SSE stream) to /api/mcp before
// markdown content negotiation can answer 406.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mw = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8')

test('MCP transport rewrite runs before content negotiation', () => {
  const rewrite = mw.indexOf("url.pathname = '/api/mcp'")
  const negotiation = mw.indexOf('isNegotiablePath(pathname, isProtected)')
  assert.ok(rewrite > 0, 'rewrite to /api/mcp present')
  assert.ok(negotiation > rewrite, 'rewrite precedes negotiation')
})

test('transport detection: non-GET/HEAD or SSE GET', () => {
  assert.match(mw, /request\.method !== 'GET' && request\.method !== 'HEAD'\) return true/)
  assert.match(mw, /includes\('text\/event-stream'\)/)
})

test('hosted MCP has its own rate-limit action', async () => {
  const rl = await readFile(new URL('../lib/rate-limit.ts', import.meta.url), 'utf8')
  assert.match(rl, /mcp_hosted: \{ windowMs: 60 \* 1000, max: 60 \}/)
})
