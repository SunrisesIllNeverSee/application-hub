// The one registry every published count comes from. TOOLS.json is generated
// from it (scripts/gen-tools.mjs) and checked in CI, and llms.txt,
// /.well-known/mcp and /agents are generated from TOOLS.json, so a tool
// count can never drift from the code again.

import { PRIVILEGED_ABSENT } from '../vendor/companion/src/mcp-tools.mjs'
import { PUBLIC_TOOLS } from '../catalog/tools.mjs'
import { CATALOG_RESOURCES, CATALOG_RESOURCE_TEMPLATES } from '../catalog/resources.mjs'
import { PROMPTS } from '../catalog/prompts.mjs'
import { PACKAGE_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '../catalog/protocol.mjs'
import { WORKSPACE_RESOURCES, companionToolDefs } from './companion.mjs'

export const MODES = Object.freeze(['stdio-workspace', 'stdio-catalog', 'hosted'])

/** 1.x tools removed in 2.0 and what replaces each. */
export const REMOVED_IN_2 = Object.freeze([
  { name: 'hub_save_answer', replacement: 'create_draft_version (workspace mode; staged, approved in the browser)' },
  { name: 'hub_get_profile_answers', replacement: 'search_answer_bank (workspace mode; reads the local encrypted workspace)' },
  { name: 'hub_search_answer_bank', replacement: 'search_answer_bank (workspace mode)' },
  { name: 'hub_intake_application', replacement: 'import_local_application (workspace mode; files from inbox/)' },
  { name: 'hub_fill_application', replacement: 'match_canonical_questions + search_answer_bank + create_draft_version (workspace mode)' },
  { name: 'hub_get_answer_review_context', replacement: 'read_review_status (workspace mode)' },
  { name: 'hub_save_answer_review', replacement: 'present_review_decisions (workspace mode); approval is approve_answer, human_only, in the browser' },
  { name: 'hub_set_borrow_threshold', replacement: 'none: reuse is a per-question Direct / Adapt / Gap recommendation in read_review_status' },
  { name: 'hub_rank_my_answers', replacement: 'read_review_status reuse recommendation (workspace mode)' },
  { name: 'hub_stress_test_answer', replacement: 'none in 2.0; the agent can critique a draft itself and stage a new version with create_draft_version' },
  { name: 'hub_log_draft_run', replacement: 'none: the companion records every tool call in its own audit log' },
  { name: 'hub_get_fit_score', replacement: 'none in 2.0 (needed private hosted answers)' },
  { name: 'hub_find_best_programs', replacement: 'hub_search_programs + hub_get_program_rankings (public), then the workspace tools' },
  { name: 'hub_get_application_readiness', replacement: 'prepare_packet (workspace mode)' },
  { name: 'aqua.ingest_application', replacement: 'import_local_application (workspace mode); public candidates via prepare_catalog_candidate + submit_catalog_candidate (human_only)' },
  { name: 'aqua.process_reward', replacement: 'none: rewards are processed by the AQUA service, never by an agent' },
  { name: 'aqua.get_variations', replacement: 'hub_find_similar_questions / hub_get_question_significance (public); match_canonical_questions (workspace mode)' },
  { name: 'aqua.qualify_answer', replacement: 'read_review_status + present_review_decisions (workspace mode)' },
  { name: 'aqua.get_canonical_package', replacement: 'prepare_packet (workspace mode)' },
  { name: 'aqua.export_package', replacement: 'export_packet (human_only: the user exports in the browser)' },
])

const oneLine = (d) => {
  const s = String(d).replace(/^\[tier: [a-z_]+\]\s*/, '').replace(/\s+/g, ' ').trim()
  const cut = s.search(/\.(\s|$)/)
  return (cut > 0 ? s.slice(0, cut + 1) : s).slice(0, 240)
}

export function buildManifest() {
  const tools = []
  const add = (def, modes, extra = {}) => tools.push({ name: def.name, tier: def.tier, modes, description: oneLine(def.description), ...extra })
  for (const d of companionToolDefs()) add(d, d.setup ? ['stdio-workspace', 'stdio-catalog'] : ['stdio-workspace'], { source: 'aqua-companion', ...(d.setup ? { setup: true } : {}) })
  for (const d of PUBLIC_TOOLS) add(d, ['stdio-workspace', 'stdio-catalog', 'hosted'], { source: 'catalog' })
  const counts = Object.fromEntries(MODES.map((m) => [m, tools.filter((t) => t.modes.includes(m)).length]))
  const tiers = Object.fromEntries(MODES.map((m) => [m, tools.filter((t) => t.modes.includes(m)).reduce((acc, t) => ({ ...acc, [t.tier]: (acc[t.tier] ?? 0) + 1 }), {})]))
  const resources = [
    ...WORKSPACE_RESOURCES.map((r) => ({ uri: r.uri, modes: ['stdio-workspace'], description: r.description })),
    ...CATALOG_RESOURCES.map((r) => ({ uri: r.uri, modes: [...MODES], description: r.description })),
    ...CATALOG_RESOURCE_TEMPLATES.map((r) => ({ uri_template: r.uriTemplate, modes: [...MODES], description: r.description })),
  ]
  return {
    format: 'aqua-mcp-tools',
    version: 1,
    generated_from: 'application-hub-mcp-server/src (npm run manifest)',
    package: 'aqua-mcp-server',
    package_version: PACKAGE_VERSION,
    protocol_versions: [...SUPPORTED_PROTOCOL_VERSIONS],
    modes: {
      'stdio-workspace': 'npx -y aqua-mcp-server --workspace <dir>: the companion tool set on one local encrypted workspace, plus the public catalog tools.',
      'stdio-catalog': 'npx -y aqua-mcp-server with no workspace open yet: public catalog tools and resources, plus the setup tools (locate_workspace, init_workspace, doctor). init_workspace switches to stdio-workspace.',
      hosted: 'https://aquaidp.xyz/mcp (Streamable HTTP, no auth, rate-limited): public catalog tools, resources and prompts only.',
    },
    counts,
    tiers,
    tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    resources,
    prompts: PROMPTS.map((p) => ({ name: p.name, modes: [...MODES], description: p.description })),
    intentionally_absent: [
      ...PRIVILEGED_ABSENT.map((p) => ({ name: p.name, why: p.why })),
      { name: 'TRANSPORT=http (self-hosted HTTP)', why: '1.x served unauthenticated write-capable HTTP. 2.0 has stdio locally and the read-only hosted endpoint only.' },
    ],
    removed_in_2: [...REMOVED_IN_2],
  }
}
