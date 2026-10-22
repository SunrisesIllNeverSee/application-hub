#!/usr/bin/env node
// aqua-mcp-server: the AQUA MCP server over stdio. See README.md.
import { main } from '../src/node/cli.mjs'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  process.stderr.write(`aqua-mcp-server needs Node.js 22 or newer (found ${process.versions.node}).\n`)
  process.exit(1)
}

process.exitCode = await main(process.argv.slice(2))
