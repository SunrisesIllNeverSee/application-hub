/**
 * import-qaapplication-corpus.ts
 *
 * Loads the operator's real application corpus (qaapplication/) into the AQUA
 * database so the bank that fills applications is the ACTUAL bank, not the
 * May-era stub.
 *
 * What it does per markdown file:
 *   1. Archives the source (app_import_sessions row with raw text)
 *   2. Parses `## Section` headings → questions, body → answers
 *   3. find-or-creates archived_questions (embeds new ones via local Ollama)
 *   4. Appends profile_answers versions for the operator (never overwrites;
 *      skips when identical to the latest version)
 *
 * Confidence mapping by source lane:
 *   06-answers/canonical → solid
 *   08-submitted/**      → locked  (actually submitted — final form)
 *   07-apply/**          → draft   (working drafts, may contain [CONFIRM])
 *
 * Usage:
 *   npx tsx scripts/import-qaapplication-corpus.ts            # dry-run (default)
 *   npx tsx scripts/import-qaapplication-corpus.ts --write    # apply to DB
 *
 * Env: reads app/.env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Operator: AQUA_USER_ID, or resolved via admin API with AQUA_USER_EMAIL
 * (default deric.mchenry@gmail.com). Ollama optional: embeddings skipped with
 * a warning if unreachable (run scripts/seed-question-embeddings.ts after).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..')
const CORPUS_ROOT = path.join(REPO_ROOT, 'qaapplication')
const WRITE = process.argv.includes('--write')

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(REPO_ROOT, 'app', '.env.local')
  const out: Record<string, string> = {}
  if (!fs.existsSync(envPath)) return out
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const ENV = loadEnvLocal()
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? ENV.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ENV.SUPABASE_SERVICE_ROLE_KEY ?? ''
const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'
const TARGET_EMAIL = process.env.AQUA_USER_EMAIL ?? 'deric.mchenry@gmail.com'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (app/.env.local)')
  process.exit(1)
}

// Lane → confidence. Order matters (first match wins).
const LANE_CONFIDENCE: Array<{ match: RegExp; confidence: 'draft' | 'solid' | 'locked' }> = [
  { match: /06-answers\/canonical\//, confidence: 'solid' },
  { match: /08-submitted\//, confidence: 'locked' },
  { match: /07-apply\//, confidence: 'draft' },
]

const SKIP_HEADINGS = new Set([
  'narrative hierarchy',
  'operating rule',
  'notes',
  // process/meta sections in the corpus, not application answers
  'status',
  'gate',
  'review gates',
  'open items',
  'open questions for deric',
  'current supporting material',
  'sources',
  'references',
])

const MIN_ANSWER_CHARS = 20

// ─── Supabase REST helpers ────────────────────────────────────────────────────

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sbGet(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!res.ok) return { error: `${res.status} ${await res.text()}` }
  const rows = await res.json()
  return { data: Array.isArray(rows) ? rows[0] : rows }
}

async function sbPatch(table: string, match: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(patch),
  })
  return res.ok
}

async function resolveUserId(): Promise<string> {
  if (process.env.AQUA_USER_ID) return process.env.AQUA_USER_ID
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: HEADERS })
  if (!res.ok) throw new Error(`admin users: ${res.status} — set AQUA_USER_ID instead`)
  const data = await res.json()
  const user = (data.users ?? []).find((u: any) => u.email === TARGET_EMAIL)
  if (!user) throw new Error(`No auth user with email ${TARGET_EMAIL} — set AQUA_USER_ID`)
  return user.id
}

// ─── Ollama embeddings (optional, best-effort) ────────────────────────────────

let ollamaUp: boolean | null = null

async function embed(text: string): Promise<number[] | null> {
  if (ollamaUp === false) return null
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
    })
    if (!res.ok) {
      ollamaUp = false
      return null
    }
    const data = (await res.json()) as { embedding?: number[] }
    if (!data.embedding || data.embedding.length !== 768) return null
    ollamaUp = true
    return data.embedding
  } catch {
    ollamaUp = false
    return null
  }
}

// ─── Corpus parsing ───────────────────────────────────────────────────────────

type Section = { question: string; answer: string }

function parseSections(markdown: string): Section[] {
  // Strip frontmatter
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lines = body.split('\n')

  const sections: Section[] = []
  let current: { question: string; parts: string[] } | null = null

  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/)
    if (h) {
      if (current) sections.push({ question: current.question, answer: current.parts.join('\n').trim() })
      current = { question: h[1].trim(), parts: [] }
    } else if (current) {
      current.parts.push(line)
    }
  }
  if (current) sections.push({ question: current.question, answer: current.parts.join('\n').trim() })

  return sections.filter(
    (s) =>
      s.answer.length >= MIN_ANSWER_CHARS &&
      !SKIP_HEADINGS.has(s.question.toLowerCase())
  )
}

function collectFiles(): Array<{ file: string; rel: string; confidence: 'draft' | 'solid' | 'locked' }> {
  const out: Array<{ file: string; rel: string; confidence: 'draft' | 'solid' | 'locked' }> = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name === 'need-to-apply') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
        const rel = path.relative(REPO_ROOT, full).replace(/\\/g, '/') + '/'
        const lane = LANE_CONFIDENCE.find((l) => l.match.test(rel))
        if (lane) out.push({ file: full, rel, confidence: lane.confidence })
      }
    }
  }

  for (const top of ['06-answers', '07-apply', '08-submitted']) {
    const dir = path.join(CORPUS_ROOT, top)
    if (fs.existsSync(dir)) walk(dir)
  }
  return out
}

// ─── find-or-create archived question ─────────────────────────────────────────

const questionCache = new Map<string, { id: string; wasNew: boolean }>()
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

async function findOrCreateQuestion(
  text: string,
  stats: { embedded: number }
): Promise<{ id: string; wasNew: boolean } | null> {
  const key = norm(text)
  if (questionCache.has(key)) return questionCache.get(key)!

  const head = text.trim().slice(0, 60).replace(/[%]/g, '')
  if (head.length >= 8) {
    const rows = await sbGet(
      'archived_questions',
      `select=id&text=ilike.${encodeURIComponent(`*${head}*`)}&limit=1`
    ).catch(() => [])
    if (rows.length > 0) {
      const hit = { id: rows[0].id, wasNew: false }
      questionCache.set(key, hit)
      return hit
    }
  }

  const insert = await sbInsert('archived_questions', {
    text: text.trim(),
    theme: 'personal',
  })
  if (insert.error) {
    return null
  }

  // Flywheel: embed on create (best-effort)
  const embedding = await embed(text)
  if (embedding) {
    const ok = await sbPatch('archived_questions', `id=eq.${insert.data.id}`, {
      embedding: JSON.stringify(embedding),
    })
    if (ok) stats.embedded++
  }

  const created = { id: insert.data.id as string, wasNew: true }
  questionCache.set(key, created)
  return created
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN (pass --write to apply)'}`)

  // User resolution only matters when writing — dry-run works with zero creds.
  const userId = WRITE ? await resolveUserId() : '(dry-run)'
  if (WRITE) console.log(`Operator: ${TARGET_EMAIL} → ${userId}`)

  const files = collectFiles()
  console.log(`Corpus files: ${files.length}`)

  const stats = {
    files: 0,
    sections: 0,
    questionsNew: 0,
    questionsReused: 0,
    answersInserted: 0,
    answersSkippedDuplicate: 0,
    answersSkippedError: 0,
    embedded: 0,
    sessions: 0,
  }

  const planned: Array<{ question: string; confidence: string; from: string; chars: number }> = []

  for (const { file, rel, confidence } of files) {
    stats.files++
    const content = fs.readFileSync(file, 'utf8')
    const sections = parseSections(content)
    const slug = path.basename(file, '.md')

    if (WRITE) {
      await sbInsert('app_import_sessions', {
        user_id: userId,
        source_kind: 'other',
        program_name: slug,
        raw_text: content.slice(0, 50_000),
        extracted_count: sections.length,
        status: 'complete',
      }).then((r) => { if (!r.error) stats.sessions++ })
    }

    for (const section of sections) {
      stats.sections++
      if (!WRITE) {
        planned.push({ question: section.question, confidence, from: rel, chars: section.answer.length })
        continue
      }

      const question = await findOrCreateQuestion(section.question, stats)
      if (!question) {
        stats.answersSkippedError++
        continue
      }
      if (question.wasNew) stats.questionsNew++
      else stats.questionsReused++

      // Latest version for this user+question
      const existing = await sbGet(
        'profile_answers',
        `select=id,version,answer_content,content&user_id=eq.${userId}&archived_question_id=eq.${question.id}&order=version.desc&limit=1`
      )

      const trimmed = section.answer.trim()
      if (existing.length > 0) {
        const latest = existing[0].answer_content ?? existing[0].content ?? ''
        if (latest.trim() === trimmed) {
          stats.answersSkippedDuplicate++
          continue
        }
      }

      const nextVersion = existing.length > 0 ? (existing[0].version ?? 1) + 1 : 1
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length
      const payload = {
        content: trimmed,
        answer_content: trimmed,
        question_text: section.question,
        theme: 'personal',
        word_count: wordCount,
        version: nextVersion,
        confidence,
      }

      // Upsert: profile_answers has UNIQUE(user_id, archived_question_id).
      // UPDATE in place when a row exists; the profile_answer_history_snapshot
      // trigger archives each new version. INSERT only on first write.
      let ok: boolean
      if (existing.length > 0) {
        ok = await sbPatch('profile_answers', `id=eq.${existing[0].id}`, payload)
      } else {
        const insert = await sbInsert('profile_answers', {
          user_id: userId,
          archived_question_id: question.id,
          ...payload,
        })
        ok = !insert.error
      }
      if (!ok) {
        console.error(`  answer save failed (${section.question.slice(0, 60)})`)
        stats.answersSkippedError++
      } else {
        stats.answersInserted++
      }
    }
  }

  if (!WRITE) {
    console.log('\nPlanned imports (first 40):')
    for (const p of planned.slice(0, 40)) {
      console.log(`  [${p.confidence}] ${p.question.slice(0, 70)} (${p.chars} chars) ← ${p.from}`)
    }
    if (planned.length > 40) console.log(`  … and ${planned.length - 40} more`)
  }

  console.log('\n─── Summary ───')
  console.log(JSON.stringify(WRITE ? stats : { files: stats.files, sections: stats.sections }, null, 2))
  if (!WRITE) console.log('\nDry-run only. Re-run with --write to apply.')
  if (ollamaUp === false) {
    console.log('WARNING: Ollama unreachable — new questions were NOT embedded.')
    console.log('Start Ollama and run: npx tsx scripts/seed-question-embeddings.ts')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
