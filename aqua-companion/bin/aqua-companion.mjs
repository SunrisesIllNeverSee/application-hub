#!/usr/bin/env node
// aqua-companion: local, encrypted AQUA document workspace. See README.md.
import { main } from '../src/cli.mjs'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  process.stderr.write(`aqua-companion needs Node.js 22 or newer (found ${process.versions.node}).\n`)
  process.exit(1)
}

process.exitCode = await main(process.argv.slice(2))
