/**
 * MCP manifest for AQUA (M09b, local-first).
 *
 * The agent path is the local AQUA companion: a stdio MCP server the user
 * runs on their own machine, working on one consented, encrypted workspace
 * plus the public catalog. It holds no account token and no database key;
 * approvals, signing and packet export stay with the human in the browser.
 *
 * Every tool name, tier, count and install line here comes from
 * lib/agent-guidance.generated.mjs (scripts/gen-agent-guidance.mjs), so the
 * manifest cannot drift from the registry or from llms.txt / /agents.
 */

import { NextResponse } from 'next/server'
import { AGENT_GUIDANCE as G } from '@/lib/agent-guidance.generated.mjs'

export const revalidate = 3600

export async function GET() {
  const byTier: Record<string, string[]> = {}
  for (const t of G.tools) (byTier[t.tier] ??= []).push(t.name)
  const manifest = {
    schemaVersion: '1.0',
    name: 'aqua-companion',
    version: G.companion.version,
    description:
      'Local-first AQUA agent interface: a stdio MCP server over one consented, encrypted workspace on the user\'s machine plus the public AQUA catalog. No account token, no database key; approvals happen only in the AQUA browser review.',
    transport: {
      stdio: {
        command: 'npx',
        args: ['--yes', G.companion.tarball.url, 'mcp', '--keychain'],
        env: {},
        note: 'The server starts without a workspace; locate_workspace / init_workspace set one up with the user\'s consent. The passphrase comes from the macOS Keychain, the server environment or a terminal prompt, never from the model.',
      },
      hosted: {
        url: G.hosted_mcp.url,
        status: G.hosted_mcp.status,
        scope: G.hosted_mcp.scope,
      },
    },
    install: {
      tarball: G.companion.tarball.url,
      sha256: G.companion.tarball.sha256,
      sha256Url: G.companion.tarball.sha256_url,
      latest: G.companion.tarball.latest_url,
      help: G.install.help,
      claudeCode: G.install.claude_code,
      npm: G.companion.npm_status,
    },
    mcpServerPackage: {
      name: G.mcp_server.package,
      version: G.mcp_server.version,
      status: G.mcp_server.status,
      npm: 'https://www.npmjs.com/package/aqua-mcp-server',
    },
    capabilities: { tools: true, elicitation: 'used by init_workspace when the client declares it' },
    toolCount: G.total,
    toolSource: G.tool_source,
    tiers: G.tiers,
    toolCategories: byTier,
    tools: G.tools,
    intentionallyAbsent: G.intentionally_absent,
    catalogConfig: G.catalog_config,
    journey: G.journey,
    docs: 'https://aquaidp.xyz/agents',
    markdown: 'https://aquaidp.xyz/agents.md',
    repository: 'https://github.com/SunrisesIllNeverSee/application-hub/tree/main/aqua-companion',
    auth: {
      type: 'none',
      description: 'No tool takes a password, token or JWT. Private data stays in the user\'s browser vault and local workspace; the browser is where the human approves.',
    },
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
