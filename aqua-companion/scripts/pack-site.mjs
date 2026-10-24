#!/usr/bin/env node
// Build the self-hosted install tarball the site serves (M09b B1.2). Kept in
// sync with the npm package: aqua-companion is published on npm since 0.2.4
// (owner gate GB2 done), and the served tarball must match the source.
//
//   node aqua-companion/scripts/pack-site.mjs           npm pack -> app/public/companion/
//   node aqua-companion/scripts/pack-site.mjs --check   rebuild in a temp folder and compare (CI); exit 1 on drift
//
// Outputs (served at https://aquaidp.xyz/companion/):
//   aqua-companion-<version>.tgz
//   aqua-companion-<version>.tgz.sha256   "<sha256>  aqua-companion-<version>.tgz"
//   latest.json                           { version, url, sha256, sha256_url, install }  (the newest; older tarballs stay)
//
// --check rebuilds with `npm pack` and compares the sha256 of the served
// tarball. npm writes fixed mtimes, so the uncompressed tar is reproducible;
// if only the gzip layer differs (another zlib), the uncompressed tar
// digests are compared instead and the difference is reported as a warning.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const COMPANION = path.resolve(HERE, '..')
const REPO = path.resolve(COMPANION, '..')
const OUT = path.join(REPO, 'app', 'public', 'companion')
const ORIGIN = 'https://aquaidp.xyz'
const sha256 = (b) => createHash('sha256').update(b).digest('hex')

function pack(dest) {
  fs.mkdirSync(dest, { recursive: true })
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const json = execFileSync(npm, ['pack', '--json', '--pack-destination', dest], {
    cwd: COMPANION,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, npm_config_ignore_scripts: 'true', npm_config_update_notifier: 'false' },
  })
  const [info] = JSON.parse(json)
  return { file: path.join(dest, info.filename), filename: info.filename, version: info.version, files: info.files.map((f) => f.path) }
}

const check = process.argv.includes('--check')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-companion-pack-'))
try {
  const built = pack(tmp)
  const bytes = fs.readFileSync(built.file)
  const digest = sha256(bytes)
  const url = `${ORIGIN}/companion/${built.filename}`
  const latest = {
    version: built.version,
    url,
    sha256: digest,
    sha256_url: `${url}.sha256`,
    install: `npx --yes ${url} --help`,
    note: 'Self-hosted npm pack tarball of aqua-companion. Verify the sha256 before running it; aqua-companion is also on npm, and aqua-mcp-server on npm includes it — the npm package is the primary install.',
  }
  for (const f of built.files) if (/(^|\/)(test|\.env)/.test(f)) throw new Error(`refusing to ship ${f}`)
  if (check) {
    const served = path.join(OUT, built.filename)
    const problems = []
    if (!fs.existsSync(served)) problems.push(`missing ${path.relative(REPO, served)} (run node aqua-companion/scripts/pack-site.mjs)`)
    else {
      const sb = fs.readFileSync(served)
      if (sha256(sb) !== digest) {
        if (sha256(gunzipSync(sb)) === sha256(gunzipSync(bytes))) console.warn('pack-site: gzip layer differs (zlib version), tar contents identical')
        else problems.push(`${built.filename} does not match the source (served ${sha256(sb).slice(0, 12)}…, rebuilt ${digest.slice(0, 12)}…)`)
      }
      const servedSha = sha256(sb)
      const shaFile = path.join(OUT, `${built.filename}.sha256`)
      if (!fs.existsSync(shaFile) || !fs.readFileSync(shaFile, 'utf8').startsWith(servedSha)) problems.push(`${built.filename}.sha256 does not match the served tarball`)
      let lj = null
      try {
        lj = JSON.parse(fs.readFileSync(path.join(OUT, 'latest.json'), 'utf8'))
      } catch {
        problems.push('latest.json is missing or unreadable')
      }
      if (lj && (lj.version !== built.version || lj.url !== url || lj.sha256 !== servedSha)) problems.push('latest.json does not describe the served tarball')
      // older versions stay served: each must still match its own .sha256 (never changed in place)
      for (const f of fs.readdirSync(OUT)) {
        if (f === built.filename || !/^aqua-companion-.*\.tgz$/.test(f)) continue
        const sf = path.join(OUT, `${f}.sha256`)
        if (!fs.existsSync(sf) || !fs.readFileSync(sf, 'utf8').startsWith(sha256(fs.readFileSync(path.join(OUT, f))))) problems.push(`${f}: its .sha256 is missing or does not match (an older served version must never change)`)
      }
    }
    if (problems.length) {
      console.error(`pack-site --check: drift\n  ${problems.join('\n  ')}`)
      process.exitCode = 1
    } else console.log(`pack-site --check: ${built.filename} matches the source (${built.files.length} files)`)
  } else {
    fs.mkdirSync(OUT, { recursive: true })
    // Previously deployed versions are KEPT (a versioned URL never 404s); only this version's files are rewritten.
    fs.copyFileSync(built.file, path.join(OUT, built.filename))
    fs.writeFileSync(path.join(OUT, `${built.filename}.sha256`), `${digest}  ${built.filename}\n`)
    fs.writeFileSync(path.join(OUT, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`)
    console.log(`pack-site: wrote app/public/companion/${built.filename} (${bytes.length} bytes, sha256 ${digest}, ${built.files.length} files)`)
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
