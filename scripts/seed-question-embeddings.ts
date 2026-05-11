/**
 * seed-question-embeddings.ts
 *
 * Generates embeddings for all archived_questions that don't have one yet
 * and writes them to Supabase. Uses nomic-embed-text via Ollama by default
 * (free, runs locally). Falls back to OpenAI text-embedding-3-small if
 * OPENAI_API_KEY is set and EMBEDDING_PROVIDER=openai.
 *
 * Embedding dimensions:
 *   Ollama / nomic-embed-text  → 768 dims  (default, matches DB schema)
 *   OpenAI / text-embedding-3-small → 768 dims (specify dimensions=768)
 *
 * Run with Ollama (default):
 *   SUPABASE_URL=https://betcyfbzsgusaghriptz.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-question-embeddings.ts
 *
 * Run with OpenAI:
 *   EMBEDDING_PROVIDER=openai \
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-question-embeddings.ts
 *
 * Ollama must be running locally: ollama serve
 * Pull the model first: ollama pull nomic-embed-text
 */

const SUPABASE_URL  = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const PROVIDER      = (process.env.EMBEDDING_PROVIDER ?? 'ollama') as 'ollama' | 'openai'
const OLLAMA_URL    = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
const OLLAMA_MODEL  = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'
const OPENAI_KEY    = process.env.OPENAI_API_KEY ?? ''
const EMBED_DIMS    = 768

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (PROVIDER === 'openai' && !OPENAI_KEY) {
  console.error('EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY')
  process.exit(1)
}

interface Question { id: string; text: string }

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function fetchUnseedeed(): Promise<Question[]> {
  const url = `${SUPABASE_URL}/rest/v1/archived_questions?select=id,text&embedding=is.null&order=significance_score.desc`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch: ${res.status} ${await res.text()}`)
  return res.json()
}

async function writeEmbedding(id: string, embedding: number[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/archived_questions?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ embedding }),
  })
  if (!res.ok) throw new Error(`Supabase update ${id}: ${res.status} ${await res.text()}`)
}

// ─── Ollama embeddings ────────────────────────────────────────────────────────

async function embedOllama(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  })
  if (!res.ok) throw new Error(`Ollama embed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { embedding: number[] }
  if (!data.embedding) throw new Error('Ollama returned no embedding')
  if (data.embedding.length !== EMBED_DIMS) {
    throw new Error(`Dimension mismatch: got ${data.embedding.length}, expected ${EMBED_DIMS}. Check model or DB schema.`)
  }
  return data.embedding
}

// ─── OpenAI embeddings ────────────────────────────────────────────────────────

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: 'text-embedding-3-small',
      dimensions: EMBED_DIMS,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI embed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { data: { embedding: number[]; index: number }[] }
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Provider: ${PROVIDER === 'ollama' ? `Ollama (${OLLAMA_MODEL} @ ${OLLAMA_URL})` : 'OpenAI (text-embedding-3-small, 768d)'}`)
  console.log('Fetching unseeded questions...')

  const questions = await fetchUnseedeed()
  console.log(`Found ${questions.length} questions to embed.\n`)
  if (questions.length === 0) { console.log('Nothing to do.'); return }

  let done = 0, failed = 0

  if (PROVIDER === 'ollama') {
    // Ollama: one request per question (no batch API)
    for (const q of questions) {
      try {
        const embedding = await embedOllama(q.text)
        await writeEmbedding(q.id, embedding)
        done++
        if (done % 10 === 0 || done === questions.length) {
          process.stdout.write(`\r  ${done}/${questions.length} done (${failed} failed)`)
        }
      } catch (err) {
        console.error(`\n  ✗ ${q.id.slice(0, 8)} — ${(err as Error).message}`)
        failed++
      }
      // Small pause to avoid overwhelming Ollama
      await new Promise(r => setTimeout(r, 50))
    }
  } else {
    // OpenAI: batch up to 100 at a time
    const BATCH = 100
    for (let i = 0; i < questions.length; i += BATCH) {
      const batch = questions.slice(i, i + BATCH)
      try {
        const embeddings = await embedOpenAI(batch.map(q => q.text))
        for (let j = 0; j < batch.length; j++) {
          try {
            await writeEmbedding(batch[j].id, embeddings[j])
            done++
          } catch (err) {
            console.error(`\n  ✗ ${batch[j].id.slice(0, 8)} — ${(err as Error).message}`)
            failed++
          }
        }
        process.stdout.write(`\r  ${done}/${questions.length} done (${failed} failed)`)
        if (i + BATCH < questions.length) await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.error(`\n  Batch ${i}-${i + BATCH} failed: ${(err as Error).message}`)
        failed += batch.length
      }
    }
  }

  console.log(`\n\nDone. ${done} embeddings written, ${failed} failed.`)
  if (failed > 0) console.log('Re-run to retry failures (script skips already-embedded rows).')
}

main().catch(err => { console.error(err); process.exit(1) })
