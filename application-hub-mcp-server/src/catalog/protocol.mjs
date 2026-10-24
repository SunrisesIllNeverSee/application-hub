// MCP JSON-RPC 2.0 dispatcher, transport-agnostic: the stdio server feeds it
// newline-delimited messages, the hosted /mcp route feeds it one POST body.
// Methods: initialize (version negotiation), ping, tools/list, tools/call,
// resources/list, resources/templates/list, resources/read, prompts/list,
// prompts/get. Everything mode-specific lives in the backend:
//
//   backend = {
//     instructions: string,
//     listTools(protocolVersion) -> Tool[],
//     callTool(name, args) -> { result, isError } | { unknown: true },
//     listResources() -> Resource[], listResourceTemplates() -> ResourceTemplate[],
//     readResource(uri) -> { contents } (throws ResourceNotFound),
//     listPrompts() -> Prompt[], getPrompt(name, args) -> { description, messages } (throws PromptError),
//     onInitialize?(dispatcher)  (optional: e.g. wire elicitation when the client supports it),
//   }
//
// With a `send` function (stdio) the dispatcher can also talk back to the
// client: server-to-client requests (elicitation/create) and notifications
// (notifications/tools/list_changed). The hosted endpoint passes no `send`.

import { ResourceNotFound } from './resources.mjs'
import { PromptError } from './prompts.mjs'

/** Newest first. The server answers with the client's version when supported, else the newest. */
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'])
export const PACKAGE_VERSION = '2.0.3'

const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } })
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result })

/** MCP tools/list entry for a tool definition { name, tier, title, description, inputSchema, network?, writes? }. */
export function toolEntry(def, protocolVersion) {
  const base = { name: def.name, description: def.description, inputSchema: def.inputSchema }
  if (protocolVersion < '2025-03-26') return base
  return {
    ...base,
    title: def.title,
    annotations: {
      title: def.title,
      readOnlyHint: def.tier === 'read' && !def.writes,
      destructiveHint: false,
      idempotentHint: def.tier !== 'private_write',
      openWorldHint: Boolean(def.network),
    },
    _meta: { 'aqua/tier': def.tier },
  }
}

export class McpDispatcher {
  /**
   * requireInitialize: stdio sessions must initialize first; the hosted
   *   endpoint is stateless (each POST stands alone) and does not.
   * allowBatch: JSON-RPC batches (removed from MCP in 2025-06-18; stdio keeps
   *   them for older clients, hosted refuses them).
   */
  constructor(backend, { serverName = 'aqua-mcp-server', serverTitle = 'AQUA MCP server', requireInitialize = true, allowBatch = true, defaultProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS[0], send = null, listChanged = false } = {}) {
    this.backend = backend
    this.send = send
    this.listChanged = Boolean(send && listChanged)
    this.clientCapabilities = {}
    this.pending = new Map()
    this.nextRequestId = 0
    this.serverName = serverName
    this.serverTitle = serverTitle
    this.requireInitialize = requireInitialize
    this.allowBatch = allowBatch
    this.initialized = !requireInitialize
    this.protocolVersion = requireInitialize ? null : defaultProtocolVersion
  }

  capabilities() {
    return {
      tools: { listChanged: this.listChanged },
      resources: { subscribe: false, listChanged: this.listChanged },
      prompts: { listChanged: false },
    }
  }

  /** True when the client declared (form) elicitation and we can send it requests. */
  get canElicit() {
    const e = this.clientCapabilities?.elicitation
    return Boolean(this.send && e && typeof e === 'object' && (e.form !== undefined || !e.url || Object.keys(e).length === 0) && this.protocolVersion >= '2025-06-18')
  }

  /** Server -> client request; resolves with the client's result (rejects on error or timeout). */
  request(method, params, { timeoutMs = 600_000 } = {}) {
    if (!this.send) return Promise.reject(new Error('this transport cannot send requests'))
    const id = `aqua-mcp-${++this.nextRequestId}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.send({ jsonrpc: '2.0', id, method, params })
    })
  }

  /** MCP elicitation/create (form mode from 2025-11-25). */
  elicit(params, opts = {}) {
    return this.request('elicitation/create', this.protocolVersion >= '2025-11-25' ? { mode: 'form', ...params } : params, opts)
  }

  /** A client response to one of our requests. */
  handleResponse(msg) {
    const p = this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id)
    clearTimeout(p.timer)
    if (msg.error) p.reject(new Error(typeof msg.error.message === 'string' ? msg.error.message.slice(0, 200) : 'client error'))
    else p.resolve(msg.result)
  }

  /** Tell the client the tool and resource lists changed (only when declared). */
  notifyListsChanged() {
    if (!this.listChanged || !this.initialized) return
    this.send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
    this.send({ jsonrpc: '2.0', method: 'notifications/resources/list_changed' })
  }

  async handle(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      if (msg && typeof msg === 'object' && !Array.isArray(msg) && ('result' in msg || 'error' in msg)) {
        this.handleResponse(msg) // a response to one of our requests
        return null
      }
      return rpcError(msg?.id, -32600, 'Invalid Request')
    }
    if (!('id' in msg)) return null // notifications: initialized, cancelled, ...
    const { id, method, params } = msg
    try {
      if (method === 'initialize') {
        const requested = params?.protocolVersion
        this.protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0]
        this.clientCapabilities = params?.capabilities && typeof params.capabilities === 'object' && !Array.isArray(params.capabilities) ? params.capabilities : {}
        this.initialized = true
        this.backend.onInitialize?.(this)
        return rpcResult(id, {
          protocolVersion: this.protocolVersion,
          capabilities: this.capabilities(),
          serverInfo: { name: this.serverName, title: this.serverTitle, version: PACKAGE_VERSION },
          instructions: this.backend.instructions,
        })
      }
      if (method === 'ping') return rpcResult(id, {})
      if (!this.initialized) return rpcError(id, -32600, 'Server not initialized: send initialize first')
      switch (method) {
        case 'tools/list':
          return rpcResult(id, { tools: await this.backend.listTools(this.protocolVersion) })
        case 'tools/call': {
          const name = params?.name
          if (typeof name !== 'string') return rpcError(id, -32602, 'Invalid params: tool name required')
          const r = await this.backend.callTool(name, params?.arguments ?? {}, this)
          if (r.unknown) return rpcError(id, -32602, `Unknown tool: ${name.slice(0, 80)}`)
          const res = { content: [{ type: 'text', text: JSON.stringify(r.result, null, 2) }], isError: Boolean(r.isError) }
          if (this.protocolVersion >= '2025-06-18') res.structuredContent = r.result
          return rpcResult(id, res)
        }
        case 'resources/list':
          return rpcResult(id, { resources: await this.backend.listResources() })
        case 'resources/templates/list':
          return rpcResult(id, { resourceTemplates: this.backend.listResourceTemplates() })
        case 'resources/read': {
          const uri = params?.uri
          if (typeof uri !== 'string') return rpcError(id, -32602, 'Invalid params: uri required')
          try {
            return rpcResult(id, await this.backend.readResource(uri))
          } catch (e) {
            if (e instanceof ResourceNotFound) return rpcError(id, -32002, 'Resource not found', { uri: uri.slice(0, 300) })
            throw e
          }
        }
        case 'prompts/list':
          return rpcResult(id, { prompts: this.backend.listPrompts() })
        case 'prompts/get': {
          try {
            return rpcResult(id, this.backend.getPrompt(params?.name, params?.arguments ?? {}))
          } catch (e) {
            if (e instanceof PromptError) return rpcError(id, -32602, e.message)
            throw e
          }
        }
        default:
          return rpcError(id, -32601, `Method not found: ${method.slice(0, 80)}`)
      }
    } catch {
      // never echo an unexpected error: it may quote request or file text
      return rpcError(id, -32603, 'Internal error')
    }
  }

  /** Handle one parsed message or batch. Returns a response, an array of responses, or null. */
  async handleMessage(msg) {
    if (Array.isArray(msg)) {
      if (!this.allowBatch) return rpcError(null, -32600, 'Invalid Request: JSON-RPC batches are not supported')
      if (!msg.length) return rpcError(null, -32600, 'Invalid Request')
      const outs = []
      for (const m of msg) {
        const r = await this.handle(m)
        if (r) outs.push(r)
      }
      return outs.length ? outs : null
    }
    return this.handle(msg)
  }

  async handleLine(line) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return rpcError(null, -32700, 'Parse error')
    }
    return this.handleMessage(msg)
  }
}

export { rpcError }
