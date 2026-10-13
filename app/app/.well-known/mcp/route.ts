/**
 * MCP server manifest for AQUA Application Hub.
 *
 * The AQUA MCP server is a local/stdio product surface — it runs inside the
 * user agent environment (Claude Desktop, Cursor, Windsurf) and connects to
 * the user Supabase session. There is no public hosted MCP endpoint at
 * aquaidp.xyz. This manifest tells agents where to find the server source,
 * how to install it, and what transport it supports.
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const manifest = {
    schemaVersion: '1.0',
    name: 'aqua-mcp-server',
    version: '1.0.1',
    description: 'MCP server for AQUA Application Hub — programs, questions, rankings, and applicant intelligence',
    transport: {
      stdio: {
        command: 'npx',
        args: ['-y', 'aqua-mcp-server'],
        env: {
          AQUA_LOCAL_FIRST: '1',
          SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
          SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
          SUPABASE_ACCESS_TOKEN: 'user session JWT',
        },
      },
      http: {
        url: 'http://localhost:3000/mcp',
        note: 'Self-hosted Streamable HTTP transport. Set TRANSPORT=http and PORT. Not hosted publicly by aquaidp.xyz.',
      },
    },
    npm: 'https://www.npmjs.com/package/aqua-mcp-server',
    npmStatus: 'aqua-mcp-server@1.0.1 is published with a real dist/ (201 files, ~455KB unpacked) — npx aqua-mcp-server works. 1.0.0 was a metadata-only stub; use >=1.0.1.',
    install: 'git clone https://github.com/SunrisesIllNeverSee/application-hub.git && cd application-hub/application-hub-mcp-server && npm ci && npm run build && node dist/index.js',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    toolCount: 31,
    toolCategories: {
      public: ['hub_search_programs', 'hub_get_program_detail', 'hub_get_program_by_slug', 'hub_get_program_rankings', 'hub_get_heat_scores', 'hub_get_program_questions', 'hub_find_similar_questions', 'hub_get_universal_questions', 'hub_get_program_dna', 'hub_get_question_significance', 'hub_get_acceptance_stats'],
      authenticated: ['hub_get_profile_answers', 'hub_get_application_readiness', 'hub_get_fit_score', 'hub_find_best_programs', 'hub_rank_my_answers', 'hub_log_draft_run', 'hub_save_answer', 'hub_get_answer_review_context', 'hub_save_answer_review', 'hub_stress_test_answer', 'hub_intake_application', 'hub_fill_application', 'hub_set_borrow_threshold', 'hub_search_answer_bank'],
      canonical: ['aqua.ingest_application', 'aqua.process_reward', 'aqua.get_variations', 'aqua.qualify_answer', 'aqua.get_canonical_package', 'aqua.export_package'],
    },
    resourceCategories: ['programs', 'questions', 'rankings'],
    promptTemplates: ['opportunity_scout', 'draft_answer', 'program_comparison'],
    repository: 'https://github.com/SunrisesIllNeverSee/application-hub/tree/main/application-hub-mcp-server',
    docs: 'https://aquaidp.xyz/mcp',
    auth: {
      type: 'Supabase JWT',
      description: 'User-account tools require a Supabase JWT; public discovery tools do not. Local-first mode refuses hosted private-content writes even with authentication.',
    },
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
