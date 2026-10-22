#!/usr/bin/env node
// M09b B0.2 — generate the agent guidance from DATA so tool lists, counts and
// install lines can never disagree across surfaces.
//
//   node scripts/gen-agent-guidance.mjs           regenerate the outputs
//   node scripts/gen-agent-guidance.mjs --check   exit 1 if any output is stale (CI)
//
// Tool source, in order:
//   1. application-hub-mcp-server/TOOLS.json (aqua-mcp-server 2.0 manifest) if present;
//   2. the companion registry: aqua-companion/src/mcp-tools.mjs TOOLS (+ SETUP_TOOLS).
// Install data: app/public/companion/latest.json (written by
// aqua-companion/scripts/pack-site.mjs) when present, else the companion's
// package.json version with sha256 "pending".
//
// Outputs (all generated — edit this script, not them):
//   app/lib/agent-guidance.generated.json   machine-readable guidance data
//   app/lib/agent-guidance.generated.mjs    the same data + /agents Markdown, for the app
//   app/public/llms.txt, app/public/llms-full.txt

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://aquaidp.xyz'
const rel = (p) => path.join(REPO, p)
const readJson = (p) => JSON.parse(fs.readFileSync(rel(p), 'utf8'))

const TIER_INFO = {
  read: 'Always allowed. Only reads the workspace or the public catalog cache.',
  private_write: 'Stages private records in the user\'s local workspace (drafts, imports, evidence). Refused in --read-only mode. Never approves anything.',
  human_consent: 'Acts only after the human confirms in the MCP client UI (elicitation). Without that capability it returns requires_human with the exact command for the user to run.',
  human_only: 'Never acts. Returns requires_human with the steps the user takes in the AQUA browser app (approve, sign, freeze/export, submit, attest).',
}
const TIER_ORDER = ['read', 'private_write', 'human_consent', 'human_only']

function summaryOf(description) {
  const d = String(description ?? '').replace(/^\[tier:[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim()
  const first = d.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? d
  return first.length > 220 ? `${first.slice(0, 217)}…` : first
}

async function loadTools() {
  const manifest = rel('application-hub-mcp-server/TOOLS.json')
  if (fs.existsSync(manifest)) {
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    const list = Array.isArray(m) ? m : Array.isArray(m.tools) ? m.tools : []
    const tools = list.filter((t) => t && typeof t.name === 'string').map((t) => ({
      name: t.name, tier: t.tier ?? 'read', title: t.title ?? t.name, summary: summaryOf(t.description ?? t.summary ?? ''),
      ...(Array.isArray(t.modes) ? { modes: t.modes } : {}),
    }))
    const absent = Array.isArray(m.intentionally_absent) ? m.intentionally_absent : Array.isArray(m.privileged_absent) ? m.privileged_absent : Array.isArray(m.absent) ? m.absent : null
    return { source: 'application-hub-mcp-server/TOOLS.json', tools, absent, mode_counts: m.counts ?? m.count_per_mode ?? null }
  }
  const mod = await import(pathToFileURL(rel('aqua-companion/src/mcp-tools.mjs')).href)
  const seen = new Set()
  const tools = []
  for (const t of [...(mod.SETUP_TOOLS ?? []), ...(mod.TOOLS ?? [])]) {
    if (!t?.name || seen.has(t.name)) continue
    seen.add(t.name)
    tools.push({ name: t.name, tier: t.tier, title: t.title ?? t.name, summary: summaryOf(t.description) })
  }
  return { source: 'aqua-companion/src/mcp-tools.mjs', tools, absent: mod.PRIVILEGED_ABSENT ?? null, mode_counts: null }
}

function loadCompanion() {
  const pkg = readJson('aqua-companion/package.json')
  const latestPath = 'app/public/companion/latest.json'
  let version = pkg.version
  let sha256 = 'pending'
  let packed = false
  if (fs.existsSync(rel(latestPath))) {
    const l = readJson(latestPath)
    if (typeof l.version === 'string') version = l.version
    if (typeof l.sha256 === 'string' && /^[0-9a-f]{64}$/.test(l.sha256)) sha256 = l.sha256
    packed = true
  }
  const file = `aqua-companion-${version}.tgz`
  const url = `${ORIGIN}/companion/${file}`
  return {
    package: 'aqua-companion',
    version,
    tarball: { file, url, sha256, sha256_url: `${url}.sha256`, latest_url: `${ORIGIN}/companion/latest.json`, packed },
    npm_status: 'not yet on npm: publishing aqua-companion is owner gate GB2. Until then install from the tarball above.',
  }
}

async function buildData() {
  const { source, tools, absent, mode_counts } = await loadTools()
  const companion = loadCompanion()
  const counts = {}
  for (const t of tools) counts[t.tier] = (counts[t.tier] ?? 0) + 1
  const tiers = TIER_ORDER.filter((k) => counts[k]).map((k) => ({ tier: k, count: counts[k], meaning: TIER_INFO[k] }))
  for (const k of Object.keys(counts)) if (!TIER_ORDER.includes(k)) tiers.push({ tier: k, count: counts[k], meaning: '' })
  const url = companion.tarball.url
  return {
    generated_by: 'scripts/gen-agent-guidance.mjs',
    tool_source: source,
    companion,
    mcp_server: {
      package: 'aqua-mcp-server',
      version: '2.0.0',
      status: 'aqua-mcp-server 2.0.0 is built on the companion and is not yet published. Once OWNER publishes it (gate GB1), `npx -y aqua-mcp-server` runs it; until then use the companion tarball. Versions below 2.0 are legacy and must not be used.',
    },
    hosted_mcp: {
      url: `${ORIGIN}/mcp`,
      status: 'live',
      transport: 'Streamable HTTP (POST JSON-RPC, JSON responses, stateless; no SSE stream)',
      scope: 'read-only public catalog tools, resources and prompts; no authentication, no workspace tools; rate-limited',
      claude_code: `claude mcp add --transport http aqua-public ${ORIGIN}/mcp`,
    },
    catalog_config: {
      url: `${ORIGIN}/.well-known/aqua-catalog.json`,
      fields: ['version', 'supabase_url', 'publishable_key', 'tables', 'notes'],
      rule: 'publishable/anon key only; clients refuse any other role and fetch it only from https://aquaidp.xyz (or a local override file)',
    },
    install: {
      help: `npx --yes ${url} --help`,
      init: `npx --yes ${url} init --path <folder>`,
      doctor: `npx --yes ${url} doctor`,
      claude_code: `claude mcp add aqua -- npx --yes ${url} mcp --keychain`,
      claude_code_with_workspace: `claude mcp add aqua -- npx --yes ${url} mcp --workspace <folder>/AQUA --keychain`,
      npm_later: 'npx -y aqua-mcp-server   # once aqua-mcp-server 2.0.0 is published (GB1)',
    },
    tiers,
    total: tools.length,
    ...(mode_counts ? { mode_counts } : {}),
    tools,
    intentionally_absent: (absent ?? []).map((a) => (typeof a === 'string' ? { name: a, why: '' } : { name: a.name, why: a.why ?? '' })),
    journey: [
      { step: 'Install', how: `npx --yes ${url} --help (check the published sha256 first)` },
      { step: 'Set up a workspace', how: 'init_workspace (the user confirms the folder in the MCP client) or the user runs `aqua-companion init --path <folder>`; the passphrase is typed by the user, never sent through the model' },
      { step: 'Load submitted history', how: 'the user puts past submitted applications in the workspace inbox/; import_history stages them; the user exports a backup and confirms them at https://aquaidp.xyz/history' },
      { step: 'Ingest the application', how: 'import_local_application (a file in inbox/) or get_application_details for a catalog program' },
      { step: 'Match and reuse', how: 'match_canonical_questions, search_answer_bank, read_review_status (Direct / Adapt / Gap)' },
      { step: 'Draft', how: 'create_draft_version stages unapproved drafts; request_evidence / attach_evidence' },
      { step: 'Human review and approval', how: 'the user runs export-backup, restores it at https://aquaidp.xyz/aqua-local and approves each answer on the browser review board' },
      { step: 'Return approvals to the agent', how: 'the user exports a browser backup into inbox/; sync_from_vault_export imports it; read_review_status shows approved with the hash preserved' },
      { step: 'Packet', how: 'prepare_packet (readiness), the user freezes/exports in the browser, verify_packet checks the export. Nothing is ever submitted by the agent.' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Markdown / text renderers (shared by llms.txt, llms-full.txt and /agents)
// ---------------------------------------------------------------------------

function toolsTable(d) {
  const lines = ['| Tool | Tier | What it does |', '|---|---|---|']
  for (const t of d.tools) lines.push(`| \`${t.name}\` | ${t.tier} | ${t.summary.replace(/\|/g, '\\|')} |`)
  return lines.join('\n')
}

function tierLines(d) {
  return d.tiers.map((t) => `- **${t.tier}** (${t.count}): ${t.meaning}`).join('\n')
}

function agentPathSection(d, { full = false } = {}) {
  const c = d.companion
  const shaLine = c.tarball.sha256 === 'pending'
    ? `- sha256: published at ${c.tarball.sha256_url} once the tarball is packed.`
    : `- sha256: \`${c.tarball.sha256}\` (also at ${c.tarball.sha256_url}; ${c.tarball.latest_url} lists the current version).`
  return `## The agent path: the local AQUA companion

AQUA is local-first. A user's private answers live in an encrypted vault in their browser and, if they choose, in an encrypted companion workspace folder on their own computer. They are never stored on AQUA's servers, and no AQUA service hands them to an agent. An agent helps a user by running the **AQUA companion** on the user's machine: a command-line tool and stdio MCP server that works on one consented, encrypted workspace plus the public catalog.

### 1. Install
- Today: the companion ships as a versioned tarball from this site (Node.js 22+, no dependencies):
  \`${d.install.help}\`
${shaLine}
- npm: ${c.npm_status}
- \`aqua-mcp-server\`: ${d.mcp_server.status}
- Self-check: \`${d.install.doctor}\` reports configuration, catalog connectivity, workspace and keychain status.

### 2. Connect it to the agent (MCP over stdio)
\`\`\`
${d.install.claude_code}
\`\`\`
The server starts even when no workspace exists yet. Workspace tools then return \`workspace_not_initialized\` with next steps.

### 3. Workspace setup and consent
- \`locate_workspace\` (read) reports where a workspace is or would be created.
- \`init_workspace\` (human_consent) uses MCP elicitation when the client supports it: the user confirms the folder and consent in the client UI, outside the model. Otherwise it returns \`requires_human\` with the exact command, for example \`aqua-companion init --path <folder>\`.
- The workspace passphrase is typed by the user (terminal prompt, macOS Keychain or the server's own environment). It never travels through the model or a tool argument, and no tool accepts a password, token or JWT.
- The agent reads files only from the workspace \`inbox/\` folder. Ask the user to place files there.

### 4. Tiers (enforced in code, not by asking the agent to behave)
${tierLines(d)}

### 5. Submitted history
The user copies past submitted applications (md, txt, docx, html, json, csv) into \`inbox/\`. \`import_history\` (or \`aqua-companion import-history <folder>\`) stages each answer with the exact question wording, program, source file hash and submission date. Unknown dates are flagged, never guessed. After \`aqua-companion export-backup\` and Restore in the browser, the user confirms them at ${ORIGIN}/history. Confirmed answers count as approved as of their submission date. Answers with unfilled placeholders ([CONFIRM], [ASSET NEEDED], TODO, TBD, XXX, <…>, {{…}}) can never be confirmed; the vault refuses them.

### 6. The human approves in the browser
Drafts the agent stages are unapproved. Approval binds the exact version hash and happens only in the AQUA browser review board, opened from ${ORIGIN}/aqua-local after Restore. The approval round trip:
1. The user runs \`aqua-companion export-backup <file>\`.
2. In the browser: AQUA Local, Restore backup, review and approve.
3. The user exports a browser backup and puts it in the workspace \`inbox/\`.
4. The agent runs \`sync_from_vault_export\`; \`read_review_status\` then shows the human approvals with hashes preserved.
5. \`prepare_packet\` reports readiness; the user freezes and exports the packet in the browser; \`verify_packet\` checks the export. The agent never submits anything.

### 7. Public catalog configuration
${d.catalog_config.url} returns \`{${d.catalog_config.fields.join(', ')}}\`. The key is the public publishable/anon key the web app already ships to every browser; row-level security limits it to approved canonical catalog rows. Clients must ${d.catalog_config.rule}.

### 8. Hosted read-only MCP
${d.hosted_mcp.url}: ${d.hosted_mcp.status} (${d.hosted_mcp.scope}).

### 9. Intentionally absent
${d.intentionally_absent.map((a) => `- \`${a.name}\`${a.why ? `: ${a.why}` : ''}`).join('\n')}
- There is no service-role key, no account token and no hosted private-answer tool anywhere in the agent path.
${full ? `
### Tools (${d.total} tools, from ${d.tool_source})
${toolsTable(d)}
` : `
Tool list (${d.total} tools): ${d.tools.map((t) => `\`${t.name}\``).join(', ')}. Full table: ${ORIGIN}/agents.md
`}`
}

const PUBLIC_PAGES = [
  ['Agent guide', '/agents'],
  ['Agent guide (Markdown)', '/agents.md'],
  ['Catalog configuration', '/.well-known/aqua-catalog.json'],
  ['MCP manifest', '/.well-known/mcp'],
  ['Developer portal', '/developers'],
  ['OpenAPI spec', '/openapi.json'],
  ['About', '/about'],
  ['FAQ', '/faq'],
  ['Contact', '/contact'],
  ['Privacy', '/privacy'],
  ['Scoring methodology', '/about/scoring'],
  ['Application infrastructure hub', '/application-infrastructure'],
  ['Guides index', '/guides'],
  ['Comparisons index', '/vs'],
  ['Concept: Answer reuse', '/concepts/answer-reuse'],
  ['Concept: Fit score', '/concepts/fit-score'],
  ['Concept: Application graph', '/concepts/application-graph'],
  ['Concept: Answer lineage', '/concepts/answer-lineage'],
  ['Concept: Smart Matcher', '/concepts/smart-matcher'],
  ['Guide: How to reuse application answers', '/guides/how-to-reuse-application-answers'],
  ['Guide: How to compare accelerator fit', '/guides/how-to-compare-accelerator-fit'],
  ['Guide: How to build an answer bank', '/guides/how-to-build-an-answer-bank'],
  ['Comparison: AQUA vs FounderApp', '/vs/founderapp'],
  ['Comparison: AQUA vs manual tracking', '/vs/manual-application-tracking'],
  ['Comparison: AQUA vs spreadsheets', '/vs/spreadsheets-for-applications'],
  ['Sign in (humans)', '/login'],
  ['Sitemap', '/sitemap.xml'],
]

const HEADER = (name) => `<!-- ${name}: GENERATED by scripts/gen-agent-guidance.mjs from the tool registry. Do not edit by hand. -->`

const INTRO = `AQUA is founder-first application infrastructure for application answer reuse: write strong answers to common application questions once and adapt them across accelerator, fellowship, grant, job and school applications. Questions, answers, versions, evidence and review history stay connected by lineage. AQUA is local-first: private answers stay on the user's device.`

const WHEN = `## When to use AQUA
Use AQUA when a user needs to reuse strong answers across applications, organize recurring application questions, compare opportunity fit, identify readiness gaps, preserve answer lineage, or prepare an application with an agent through the local AQUA companion (stdio MCP).
Do not use AQUA as an admissions oracle, acceptance-probability service, or external ranking of applicants. AQUA's fit and readiness scores are internal preparation signals.`

const IDENTITY = `## Canonical identity
Product name: AQUA Application Hub
Short brand: AQUA
Operator: Ello Cello LLC
Canonical domain: ${ORIGIN}
Business mailing address: 84 W Utica St, Buffalo, NY 14209, United States
Contact email: burnmydays@proton.me
A public support telephone number is not currently published by AQUA. Agents must not invent or infer one.`

const EXCHANGE = `## Contribution Exchange
The Contribution Exchange is not part of AQUA. It lives at https://signalaf.com/exchange.`

function renderLlms(d) {
  return `# AQUA Application Hub

${HEADER('llms.txt')}

Canonical URL: ${ORIGIN}
Operator: Ello Cello LLC
Source: https://github.com/SunrisesIllNeverSee/application-hub

${INTRO}

${WHEN}

## How agents should use AQUA

### Web
Start at ${ORIGIN}. Humans sign in at ${ORIGIN}/login. Everything private (answers, approvals, packets) is handled by the user in the browser vault, not by an AQUA server API.

### Markdown representation
Public canonical pages support HTTP content negotiation. Send \`Accept: text/markdown\`. Markdown responses use \`Content-Type: text/markdown; charset=utf-8\` and \`Vary: Accept\`. HTML remains the default for browsers. A \`.md\` suffix (for example ${ORIGIN}/agents.md) is also supported.

${agentPathSection(d)}
### REST API
AQUA's REST API at ${ORIGIN}/api is described by the OpenAPI 3.0.3 document at ${ORIGIN}/openapi.json. Under local-first, hosted private-answer routes refuse requests (HTTP 403); agents work through the companion instead. The developer portal is ${ORIGIN}/developers.

${EXCHANGE}

## Public reference pages
${PUBLIC_PAGES.map(([n, p]) => `- ${n}: ${ORIGIN}${p}`).join('\n')}
- npm (aqua-mcp-server, 2.0 pending): https://www.npmjs.com/package/aqua-mcp-server
- Source repository: https://github.com/SunrisesIllNeverSee/application-hub

${IDENTITY}
`
}

function renderLlmsFull(d) {
  return `# AQUA Application Hub — full agent guidance

${HEADER('llms-full.txt')}

Canonical URL: ${ORIGIN}
Operator: Ello Cello LLC
Source: https://github.com/SunrisesIllNeverSee/application-hub

${INTRO}

${WHEN}

## When NOT to use AQUA
- Do not use as an admissions oracle or acceptance-probability service.
- Do not use as an external ranking of applicants.
- Do not ask the user for passwords, tokens, JWTs or database keys. No AQUA agent path needs one.

${agentPathSection(d, { full: true })}
## The fresh-agent journey
${d.journey.map((j, i) => `${i + 1}. **${j.step}**: ${j.how}`).join('\n')}

## Key concepts
- Answer reuse: write strong answers to common application questions once and adapt them across programs.
- Application graph: questions, answers, opportunities and review history connected by lineage.
- Answer lineage: every edit is a new immutable version; approvals bind an exact version hash and never carry over.
- Fit and readiness scores: internal preparation signals, not predictions.

${EXCHANGE}

## Pages
${PUBLIC_PAGES.map(([n, p]) => `- [${n}](${ORIGIN}${p})`).join('\n')}

${IDENTITY}
`
}

function renderAgentsMarkdown(d) {
  return `# AQUA agent guide

${INTRO}

This page is for AI agents and the people who run them. It describes the only supported way for an agent to help a user finish an application: the local AQUA companion. Machine-readable versions: ${ORIGIN}/llms.txt, ${ORIGIN}/llms-full.txt, ${ORIGIN}/.well-known/mcp.

${agentPathSection(d, { full: true })}
## The fresh-agent journey
${d.journey.map((j, i) => `${i + 1}. **${j.step}**: ${j.how}`).join('\n')}

${EXCHANGE}
`
}

function renderModule(d) {
  return `// GENERATED by scripts/gen-agent-guidance.mjs. Do not edit by hand.
// Run \`node scripts/gen-agent-guidance.mjs\` after changing the tool registry.
export const AGENT_GUIDANCE = ${JSON.stringify(d, null, 2)}

export const AGENTS_MARKDOWN = ${JSON.stringify(renderAgentsMarkdown(d))}
`
}

async function main() {
  const check = process.argv.includes('--check')
  const d = await buildData()
  const outputs = {
    'app/lib/agent-guidance.generated.json': `${JSON.stringify(d, null, 2)}\n`,
    'app/lib/agent-guidance.generated.mjs': renderModule(d),
    'app/public/llms.txt': renderLlms(d),
    'app/public/llms-full.txt': renderLlmsFull(d),
  }
  const stale = []
  for (const [p, text] of Object.entries(outputs)) {
    const cur = fs.existsSync(rel(p)) ? fs.readFileSync(rel(p), 'utf8') : null
    if (cur === text) continue
    stale.push(p)
    if (!check) fs.writeFileSync(rel(p), text)
  }
  if (check) {
    if (stale.length) {
      console.error(`agent guidance is out of date: ${stale.join(', ')}\nRun: node scripts/gen-agent-guidance.mjs`)
      process.exit(1)
    }
    console.log(`agent guidance up to date (${d.total} tools from ${d.tool_source}).`)
    return
  }
  console.log(`${stale.length ? `wrote ${stale.join(', ')}` : 'no changes'} (${d.total} tools from ${d.tool_source}; companion ${d.companion.version}, sha256 ${d.companion.tarball.sha256}).`)
}

await main()
