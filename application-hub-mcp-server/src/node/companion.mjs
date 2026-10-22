// stdio modes on the aqua-companion's tool registry (createAquaToolRegistry):
// the companion owns the tool set, the workspace session and tier
// enforcement (read / private_write / human_consent / human_only; privileged
// absent), so this server never re-implements any of it. This module adds
// the public catalog tools, aqua://workspace/status, the prompts, and the
// mode switch:
//
//   no workspace open ("stdio-catalog"): the companion's setup tools
//     (locate_workspace, init_workspace, doctor) + the public catalog tools;
//   workspace open ("stdio-workspace"): every companion tool + the public tools.
//
// When init_workspace opens a workspace mid-session the lists change and the
// client is notified (notifications/tools/list_changed). init_workspace is
// human_consent: the companion asks the user through MCP elicitation, wired
// here when the client declares it.

import { createAquaToolRegistry, UnknownToolError } from '../vendor/companion/src/registry.mjs'
import { SERVER_INSTRUCTIONS as COMPANION_INSTRUCTIONS } from '../vendor/companion/src/mcp-server.mjs'
import { TOOLS as COMPANION_TOOLS } from '../vendor/companion/src/mcp-tools.mjs'
import { PUBLIC_TOOLS, PUBLIC_TOOL_MAP, callPublicTool } from '../catalog/tools.mjs'
import { CATALOG_RESOURCES, CATALOG_RESOURCE_TEMPLATES, ResourceNotFound, readCatalogResource } from '../catalog/resources.mjs'
import { PROMPTS, getPrompt } from '../catalog/prompts.mjs'
import { toolEntry } from '../catalog/protocol.mjs'

export const WORKSPACE_STATUS_URI = 'aqua://workspace/status'
const MAX_STATUS_APPS = 25

export const WORKSPACE_RESOURCES = Object.freeze([
  { uri: WORKSPACE_STATUS_URI, name: 'workspace-status', title: 'Workspace review status', description: 'Review status of every application in this workspace (gap, suggested, needs evidence, under review, approved) from read_review_status.', mimeType: 'application/json' },
])

export const INSTRUCTIONS = [
  COMPANION_INSTRUCTIONS,
  'Public catalog tools (hub_*) read approved programs live from the public AQUA catalog with the public key; their catalog text is under untrusted_content too.',
].join('\n')

/** The companion's tool definitions (for the manifest). */
export const companionToolDefs = () => COMPANION_TOOLS

const modeOf = (reg) => (reg.state().mode === 'ready' ? 'stdio-workspace' : 'stdio-catalog')

/**
 * Build the stdio backend. `registry` is injectable for tests; otherwise
 * createAquaToolRegistry({ workspace, readOnly, keychain, env, cwd, fetchImpl, stderr }).
 * Throws what the registry throws (a wrong passphrase stops startup).
 */
export async function createCompanionBackend({ workspace, readOnly = false, keychain = false, env, cwd, fetchImpl, stderr, data = null, registry = null }) {
  const reg = registry ?? (await createAquaToolRegistry({ workspace, readOnly, keychain, env, cwd, fetchImpl, stderr }))
  const byName = new Map(reg.tools.map((t) => [t.name, t]))
  const defs = new Map(COMPANION_TOOLS.map((t) => [t.name, t]))
  const ready = () => reg.state().mode === 'ready'
  const visibleCompanion = () => reg.tools.filter((t) => ready() || t.setup)

  async function workspaceStatus() {
    const listed = await reg.dispatch('discover_applications', { include_workspace: true, limit: 1 })
    const ids = listed.result?.workspace_instance_ids ?? []
    const applications = []
    for (const id of ids.slice(0, MAX_STATUS_APPS)) applications.push((await reg.dispatch('read_review_status', { application_id: id })).result)
    const st = reg.state()
    return { resource: WORKSPACE_STATUS_URI, status: 'ok', workspace_id: st.workspace_id, read_only: readOnly, application_count: ids.length, truncated: ids.length > MAX_STATUS_APPS, applications }
  }

  return {
    registry: reg,
    instructions: INSTRUCTIONS,
    data,
    mode: () => modeOf(reg),
    toolDefs: () => [...visibleCompanion().map((t) => defs.get(t.name) ?? t), ...PUBLIC_TOOLS],
    onInitialize(dispatcher) {
      reg.setElicitor(dispatcher.canElicit ? (params, opts) => dispatcher.elicit(params, opts) : null)
    },
    listTools(pv) {
      const companion = visibleCompanion().map((t) => {
        const base = { name: t.name, description: t.description, inputSchema: t.inputSchema }
        return pv < '2025-03-26' ? base : { ...base, title: t.title, annotations: t.annotations, _meta: { 'aqua/tier': t.tier } }
      })
      return [...companion, ...PUBLIC_TOOLS.map((d) => toolEntry(d, pv))]
    },
    async callTool(name, args, dispatcher) {
      if (PUBLIC_TOOL_MAP.has(name)) return callPublicTool(name, args, data)
      const t = byName.get(name)
      if (!t) return { unknown: true }
      const wasReady = ready()
      let r
      try {
        r = await reg.dispatch(name, args)
      } catch (e) {
        if (e instanceof UnknownToolError) return { unknown: true }
        throw e
      }
      if (!wasReady && ready()) dispatcher?.notifyListsChanged()
      return r
    },
    listResources: () => [...(ready() ? WORKSPACE_RESOURCES : []), ...CATALOG_RESOURCES],
    listResourceTemplates: () => [...CATALOG_RESOURCE_TEMPLATES],
    async readResource(uri) {
      if (uri === WORKSPACE_STATUS_URI) {
        if (!ready()) throw new ResourceNotFound(uri)
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(await workspaceStatus(), null, 2) }] }
      }
      return readCatalogResource(uri, data)
    },
    listPrompts: () => PROMPTS.map((p) => ({ ...p })),
    getPrompt: (name, args) => getPrompt(name, args, { hasWorkspace: ready() }),
  }
}
