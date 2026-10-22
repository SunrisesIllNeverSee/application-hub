// Shared test helpers. All content is synthetic; workspaces live in fresh
// scratch folders (never a home folder).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { CatalogClient } from '../src/catalog/rest.mjs'
import { CatalogData } from '../src/catalog/data.mjs'
import { parseCatalogConfig } from '../src/catalog/key.mjs'
import { callPublicTool } from '../src/catalog/tools.mjs'
import { CONFIG, REGISTRY, fakePostgrest } from './fake-postgrest.mjs'
import { main } from '../src/node/cli.mjs'

export const SCRATCH_BASE = process.env.AQUA_MCP_TEST_DIR ??
  (fs.existsSync('/private/tmp') ? '/private/tmp/claude-501/aqua-mcp-server-tests' : path.join(os.tmpdir(), 'aqua-mcp-server-tests'))
export const PASS = 'synthetic-workspace-pass-7Q4x'

export function scratch(label = 't') {
  fs.mkdirSync(SCRATCH_BASE, { recursive: true })
  return fs.realpathSync(fs.mkdtempSync(path.join(SCRATCH_BASE, `${label}-`)))
}

/** CatalogData over a fake PostgREST. */
export function catalog(opts = {}) {
  const fake = fakePostgrest(opts)
  const data = new CatalogData(new CatalogClient(parseCatalogConfig(CONFIG), { fetchImpl: fake.fetchImpl }), { allowSlugs: opts.registry ?? REGISTRY })
  const call = async (name, args = {}) => (await callPublicTool(name, args, data)).result
  return { ...fake, data, call }
}

function sink() {
  let buf = ''
  return { write: (s) => { buf += s; return true }, get text() { return buf } }
}

/**
 * Run the stdio server in-process: send JSON-RPC messages, collect responses.
 * Returns { code, responses: Map(id -> msg), out: [msgs], err }.
 */
export async function runServer(argv, messages, { env = {}, fetchImpl, cwd = SCRATCH_BASE } = {}) {
  fs.mkdirSync(cwd, { recursive: true })
  const stdin = new PassThrough()
  const stdout = sink()
  const stderr = sink()
  const done = main(argv, { env: { AQUA_CATALOG_OFFLINE: '1', ...env }, cwd, stdin, stdout, stderr, fetchImpl })
  for (const m of messages) stdin.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`)
  stdin.end()
  const code = await done
  const out = stdout.text.trim() ? stdout.text.trim().split('\n').map((l) => { try { return JSON.parse(l) } catch { return { raw: l } } }) : []
  const responses = new Map()
  for (const m of out) if (!Array.isArray(m)) responses.set(m.id, m)
  return { code, out, responses, err: stderr.text, stdout: stdout.text }
}

export const INIT = (id = 0, protocolVersion = '2025-06-18') => ({ jsonrpc: '2.0', id, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '0' } } })
export const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) })

/**
 * An interactive in-process client: send requests one by one, answer
 * server-to-client requests (elicitation/create) with onRequest, and collect
 * notifications. close() ends stdin and resolves with the exit code.
 */
export function interactive(argv, { env = {}, fetchImpl, cwd = SCRATCH_BASE, onRequest = async () => ({}) } = {}) {
  fs.mkdirSync(cwd, { recursive: true })
  const stdin = new PassThrough()
  const stderr = sink()
  const waiters = new Map()
  const notifications = []
  const serverRequests = []
  let buf = ''
  const stdout = {
    write(chunk) {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 1)
        const msg = JSON.parse(line)
        if (msg.method && 'id' in msg) {
          serverRequests.push(msg)
          Promise.resolve(onRequest(msg)).then((result) => stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`))
        } else if (msg.method) notifications.push(msg)
        else waiters.get(msg.id)?.(msg)
      }
      return true
    },
  }
  const done = main(argv, { env: { AQUA_CATALOG_OFFLINE: '1', ...env }, cwd, stdin, stdout, stderr, fetchImpl })
  let nextId = 0
  return {
    notifications,
    serverRequests,
    get err() { return stderr.text },
    request(method, params) {
      const id = ++nextId
      return new Promise((resolve) => {
        waiters.set(id, resolve)
        stdin.write(`${JSON.stringify(req(id, method, params))}\n`)
      })
    },
    async close() {
      stdin.end()
      return done
    },
  }
}

/** structuredContent of a tools/call response. */
export const sc = (msg) => msg.result.structuredContent ?? JSON.parse(msg.result.content[0].text)

/** Every string anywhere in a value, excluding the untrusted_content subtree. */
export function trustedStrings(v, acc = []) {
  if (typeof v === 'string') acc.push(v)
  else if (Array.isArray(v)) v.forEach((x) => trustedStrings(x, acc))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'untrusted_content') trustedStrings(x, acc)
  return acc
}
