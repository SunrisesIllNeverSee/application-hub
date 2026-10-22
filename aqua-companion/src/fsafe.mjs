// Path-confined filesystem helpers. Every read and write inside a workspace
// goes through these. Rules:
//   - relative paths only; no absolute paths, no `..` segments, no NUL bytes;
//   - the resolved path must stay under the workspace root (realpath);
//   - no path component below the root may be a symlink (no symlink escape);
//   - new files are created exclusively (O_EXCL): an existing file is never
//     overwritten. The only replacement is the companion's own manifest and
//     record ciphertext (atomic temp-file + rename), done on purpose;
//   - (M09 hardening L3) files are opened with O_NOFOLLOW where the platform
//     has it, and AFTER the open the realpath of the opened path must still
//     lie inside the root and name the very file the descriptor points at
//     (same dev/ino) — closing the gap between the lstat walk and the open
//     where a directory could be swapped for a symlink.
// Files outside the workspace are touched only when the user names them
// explicitly on the command line (input documents, output files).

import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from './crypto.mjs'

export class PathSafetyError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PathSafetyError'
  }
}

const O_NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0

/**
 * Open `abs` (already resolved under `root`) with O_NOFOLLOW, then verify the
 * opened file is still confined: realpath(abs) inside root and the same
 * dev/ino as the descriptor. On failure the fd is closed (and a file this
 * call just created is removed) and PathSafetyError is thrown.
 */
export function openConfined(root, abs, flags, mode, { created = false } = {}) {
  const fd = fs.openSync(abs, flags | O_NOFOLLOW, mode)
  let ok = false
  try {
    const real = fs.realpathSync(abs)
    if (!isWithin(root, real)) throw new PathSafetyError(`opened path escapes the workspace: ${path.relative(root, abs)}`)
    const a = fs.fstatSync(fd)
    const b = fs.statSync(real)
    if (a.dev !== b.dev || a.ino !== b.ino) throw new PathSafetyError(`opened file changed during open: ${path.relative(root, abs)}`)
    if (!a.isFile()) throw new PathSafetyError(`not a regular file: ${path.relative(root, abs)}`)
    // a hard link can alias a file outside the workspace (O_NOFOLLOW does not see it): refuse any multiply-linked file
    if (a.nlink > 1) throw new PathSafetyError(`hard-linked file refused: ${path.relative(root, abs)}`)
    ok = true
    return fd
  } finally {
    if (!ok) {
      try { fs.closeSync(fd) } catch { /* ignore */ }
      if (created) { try { fs.unlinkSync(abs) } catch { /* ignore */ } }
    }
  }
}

/** Validate a workspace-relative path and return its normalized form ('a/b/c'). */
export function normalizeRel(rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new PathSafetyError('empty path')
  if (rel.includes('\0')) throw new PathSafetyError('path contains a NUL byte')
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.startsWith('\\')) {
    throw new PathSafetyError(`absolute path refused: ${rel}`)
  }
  const parts = rel.split(/[\\/]+/).filter((p) => p !== '' && p !== '.')
  if (parts.length === 0) throw new PathSafetyError('empty path')
  if (parts.some((p) => p === '..')) throw new PathSafetyError(`path traversal refused: ${rel}`)
  return parts.join('/')
}

/**
 * Resolve `rel` under `root` (already a realpath). Throws on traversal or
 * when an existing component below the root is a symlink.
 */
export function resolveInside(root, rel) {
  const norm = normalizeRel(rel)
  const abs = path.resolve(root, norm)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new PathSafetyError(`path escapes the workspace: ${rel}`)
  }
  let cur = root
  for (const part of norm.split('/')) {
    cur = path.join(cur, part)
    let st
    try {
      st = fs.lstatSync(cur)
    } catch (e) {
      if (e.code === 'ENOENT') break // the rest does not exist yet
      throw e
    }
    if (st.isSymbolicLink()) throw new PathSafetyError(`symlink in workspace path refused: ${norm}`)
  }
  return abs
}

export function realRoot(dir) {
  const real = fs.realpathSync(dir)
  const st = fs.lstatSync(real)
  if (!st.isDirectory()) throw new PathSafetyError(`not a directory: ${dir}`)
  return real
}

export function existsInside(root, rel) {
  try {
    fs.lstatSync(resolveInside(root, rel))
    return true
  } catch (e) {
    if (e instanceof PathSafetyError) throw e
    return false
  }
}

/** mkdir -p confined to root; refuses symlinked components. */
export function mkdirInside(root, rel) {
  const norm = normalizeRel(rel)
  let cur = root
  for (const part of norm.split('/')) {
    cur = path.join(cur, part)
    // mkdir first, then inspect on EEXIST: there is no lstat-then-mkdir window in which a symlink could be planted
    try {
      fs.mkdirSync(cur, { mode: 0o700 })
      continue
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
    }
    const st = fs.lstatSync(cur)
    if (st.isSymbolicLink()) throw new PathSafetyError(`symlink in workspace path refused: ${norm}`)
    if (!st.isDirectory()) throw new PathSafetyError(`not a directory: ${norm}`)
  }
  return cur
}

/** Create a NEW file; never overwrites (O_EXCL). Returns the absolute path. */
export function writeNewInside(root, rel, data) {
  const norm = normalizeRel(rel)
  const dir = path.posix.dirname(norm)
  if (dir !== '.') mkdirInside(root, dir)
  const abs = resolveInside(root, norm)
  const fd = openConfined(root, abs, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600, { created: true })
  try {
    fs.writeFileSync(fd, data)
  } finally {
    fs.closeSync(fd)
  }
  return abs
}

/**
 * Intentional replacement of a companion-owned file (manifest, re-keyed
 * ciphertext): write a fresh temp file exclusively, fsync, then rename.
 */
export function replaceAtomicInside(root, rel, data) {
  const norm = normalizeRel(rel)
  const dir = path.posix.dirname(norm)
  if (dir !== '.') mkdirInside(root, dir)
  const abs = resolveInside(root, norm)
  const tmpRel = `${norm}.tmp-${Buffer.from(randomBytes(6)).toString('hex')}`
  const tmp = resolveInside(root, tmpRel)
  const fd = openConfined(root, tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600, { created: true })
  try {
    fs.writeFileSync(fd, data)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmp, abs)
  return abs
}

/** Append one line to a companion log, refusing symlinks. */
export function appendInside(root, rel, line) {
  const norm = normalizeRel(rel)
  const dir = path.posix.dirname(norm)
  if (dir !== '.') mkdirInside(root, dir)
  const abs = resolveInside(root, norm)
  const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT
  const fd = openConfined(root, abs, flags, 0o600)
  try {
    fs.writeSync(fd, line)
  } finally {
    fs.closeSync(fd)
  }
}

export function readInside(root, rel) {
  const abs = resolveInside(root, rel)
  const st = fs.lstatSync(abs)
  if (!st.isFile()) throw new PathSafetyError(`not a regular file: ${rel}`)
  const fd = openConfined(root, abs, fs.constants.O_RDONLY)
  try {
    return fs.readFileSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

/** Move without overwriting: hard-link to the target (fails if it exists), then unlink the source. */
export function moveInside(root, fromRel, toRel) {
  const from = resolveInside(root, fromRel)
  const toNorm = normalizeRel(toRel)
  const dir = path.posix.dirname(toNorm)
  if (dir !== '.') mkdirInside(root, dir)
  const to = resolveInside(root, toNorm)
  if (!fs.lstatSync(from).isFile()) throw new PathSafetyError(`not a regular file: ${fromRel}`)
  try {
    fs.linkSync(from, to)
  } catch (e) {
    if (e.code === 'EEXIST') throw e
    // filesystems without hard links (FAT/exFAT, some network drives): exclusive copy
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL)
  }
  fs.unlinkSync(from)
}

/**
 * Walk the workspace tree without following symlinks. Returns
 * { files: [rel...], symlinks: [rel...], other: [rel...] }.
 */
export function walkInside(root, startRel = null) {
  const out = { files: [], symlinks: [], other: [] }
  const base = startRel ? resolveInside(root, startRel) : root
  const visit = (abs) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, ent.name)
      const rel = path.relative(root, child).split(path.sep).join('/')
      if (ent.isSymbolicLink()) out.symlinks.push(rel)
      else if (ent.isDirectory()) visit(child)
      else if (ent.isFile()) out.files.push(rel)
      else out.other.push(rel)
    }
  }
  if (fs.existsSync(base)) visit(base)
  out.files.sort()
  out.symlinks.sort()
  return out
}

/** True when `child` is `parent` or lies beneath it (absolute paths). */
export function isWithin(parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Resolve a user-named path against cwd, following symlinks for the existing prefix. */
export function resolveUserPath(cwd, p) {
  const abs = path.resolve(cwd, p)
  // realpath the deepest existing ancestor so comparisons survive /tmp -> /private/tmp
  let cur = abs
  const tail = []
  while (!fs.existsSync(cur)) {
    tail.unshift(path.basename(cur))
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return path.join(fs.realpathSync(cur), ...tail)
}

/** Write a NEW file at an explicitly named location outside (or inside) the workspace. */
export function writeNewUserFile(absPath, data) {
  fs.writeFileSync(absPath, data, { flag: 'wx', mode: 0o600 })
}
