import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const corpusRoot = path.join(repoRoot, 'qaapplication')
const inboxRoot = path.join(corpusRoot, 'inbox')
const host = process.env.EXTENSION_AGENT_HOST || '127.0.0.1'
const port = Number(process.env.EXTENSION_AGENT_PORT || 4317)

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

function slugify(value) {
  return String(value || 'application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'application'
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3)
  )
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function metadataLine(label, value) {
  return `**${label}:** ${cleanText(value) || '—'}`
}

function normalizeBlock(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function similarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const token of a) {
    if (b.has(token)) overlap += 1
  }
  return overlap / Math.sqrt(a.size * b.size)
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'inbox' || entry.name.startsWith('.')) continue
      files.push(...await walk(full))
      continue
    }
    files.push(full)
  }
  return files
}

async function buildCorpus() {
  const files = await walk(corpusRoot).catch(() => [])
  const corpus = []
  for (const file of files) {
    const stats = await fs.stat(file).catch(() => null)
    if (!stats || stats.size > 500_000) continue
    const text = await fs.readFile(file, 'utf8').catch(() => '')
    if (!text.trim()) continue
    corpus.push({
      path: file,
      relPath: path.relative(repoRoot, file),
      text,
      tokens: tokenize(text),
    })
  }
  return corpus
}

function buildMarkdown(payload) {
  const questions = Array.isArray(payload.questions) ? payload.questions : []
  const fieldSections = questions
    .map((q) => `## ${q.label || q.questionText || 'Question'}\n\n${q.value || ''}`)
    .join('\n\n')

  const notes = normalizeBlock(payload.content || '')
  const pageText = normalizeBlock(payload.page_text || '')

  const parts = [
    `# ${payload.application_name || payload.title || 'Captured Application'}`,
    '',
    metadataLine('URL', payload.url),
    metadataLine('Host', payload.host),
    metadataLine('Site', payload.site_name),
    metadataLine('Company', payload.company_name),
    metadataLine('Application', payload.application_name || payload.title),
    metadataLine('Capture kind', payload.capture_kind || 'page'),
    metadataLine('Captured', new Date().toISOString()),
    '',
  ]

  if (notes) {
    parts.push('## Capture Notes', '', notes, '')
  }

  if (fieldSections) {
    parts.push('## Detected Fields', '', fieldSections, '')
  }

  if (pageText) {
    parts.push('## Page Snapshot', '', pageText, '')
  }

  return parts.join('\n').trim() + '\n'
}

async function saveCapture(payload) {
  await fs.mkdir(inboxRoot, { recursive: true })
  const filenameBase = payload.application_name || payload.company_name || payload.site_name || payload.title
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(filenameBase)}.md`
  const target = path.join(inboxRoot, filename)
  await fs.writeFile(target, buildMarkdown(payload), 'utf8')
  return target
}

async function assist(payload) {
  const content = payload.content || buildMarkdown(payload)
  const sourceTokens = tokenize(content)
  const corpus = await buildCorpus()
  const matches = corpus
    .map((entry) => ({
      path: entry.relPath,
      score: similarity(sourceTokens, entry.tokens),
      preview: entry.text.replace(/\s+/g, ' ').slice(0, 220),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const savedPath = await saveCapture(payload)
  return {
    ok: true,
    saved_to: path.relative(repoRoot, savedPath),
    title: payload.title || 'Captured Application',
    url: payload.url || null,
    corpus_count: corpus.length,
    related_files: matches,
    next_step: 'Open the saved capture and the top related files in VS Code while you work through the form.',
  }
}

createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { ok: false, error: 'Missing URL' })

  if (req.method === 'OPTIONS') return json(res, 204, {})

  if (req.method === 'GET' && req.url === '/health') {
    const corpus = await buildCorpus()
    return json(res, 200, {
      ok: true,
      service: 'local-extension-agent',
      corpus_root: path.relative(repoRoot, corpusRoot),
      inbox_root: path.relative(repoRoot, inboxRoot),
      corpus_count: corpus.length,
    })
  }

  if (req.method === 'POST' && req.url === '/assist') {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(raw || '{}')
        const result = await assist(payload)
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    })
    return
  }

  return json(res, 404, { ok: false, error: 'Not found' })
}).listen(port, host, () => {
  console.log(`[local-extension-agent] listening on http://${host}:${port}`)
  console.log(`[local-extension-agent] corpus root: ${path.relative(repoRoot, corpusRoot)}`)
})
