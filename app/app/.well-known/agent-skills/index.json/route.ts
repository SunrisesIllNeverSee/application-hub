import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

export const revalidate = 3600

export async function GET() {
  // Agent Skills Discovery RFC v0.2.0
  // https://github.com/cloudflare/agent-skills-discovery-rfc
  const llmsTxtUrl = 'https://mos2es.xyz/llms.txt'

  const llmsTxtContent = `# AQUA Application Hub\n\nCanonical URL: https://mos2es.xyz\nOperator: Ello Cello LLC\nSource: https://github.com/SunrisesIllNeverSee/application-hub\n\nAQUA is founder-first application infrastructure for application answer reuse — the practice of writing strong answers to common application questions once and adapting them across multiple programs.`

  const llmsTxtDigest =
    'sha256:' + createHash('sha256').update(llmsTxtContent).digest('hex')

  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'aqua-application-hub',
        type: 'skill-md',
        description:
          'AQUA Application Hub — program search, question bank, answer reuse, fit scores, and MCP tooling for application infrastructure',
        url: llmsTxtUrl,
        digest: llmsTxtDigest,
      },
    ],
  }

  return new NextResponse(JSON.stringify(index, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
