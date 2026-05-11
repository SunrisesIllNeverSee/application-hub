/**
 * seed-question-embeddings.ts
 *
 * One-time script (safe to re-run) that generates OpenAI text-embedding-3-small
 * vectors for every archived_question that doesn't have one yet, then bulk-writes
 * them to Supabase.
 *
 * Run:
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_URL=https://betcyfbzsgusaghriptz.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-question-embeddings.ts
 *
 * Dependencies: tsx (already a dev dependency in most TS setups), no new packages.
 * All HTTP calls use native fetch (Node 18+).
 */

const OPENAI_API_KEY     = process.env.OPENAI_API_KEY ?? ''
const SUPABASE_URL       = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const EMBEDDING_MODEL    = 'text-embedding-3-small'
const EMBEDDING_DIMS     = 1536
const BATCH_SIZE         = 100   // OpenAI allows up to 2048 inputs per request

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

interface Question {
  id: string
  text: string
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchQuestions(): Promise<Question[]> {
  const url = `${SUPABASE_URL}/rest/v1/archived_questions?select=id,text&embedding=is.null&order=significance_score.desc`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase fetch error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function updateEmbedding(id: string, embedding: number[]): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/archived_questions?id=eq.${id}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ embedding }),
  })
  if (!res.ok) throw new Error(`Supabase update error for ${id}: ${res.status} ${await res.text()}`)
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embeddings error: ${res.status} ${err}`)
  }
  const data = await res.json() as { data: { embedding: number[]; index: number }[] }
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching questions without embeddings...')
  const questions = await fetchQuestions()
  console.log(`Found ${questions.length} questions to embed.`)

  if (questions.length === 0) {
    console.log('All questions already have embeddings. Nothing to do.')
    return
  }

  let processed = 0
  let failed = 0

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE)
    const texts = batch.map(q => q.text)

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedding ${batch.length} questions...`)

    let embeddings: number[][]
    try {
      embeddings = await generateEmbeddings(texts)
    } catch (err) {
      console.error(`  Failed to generate embeddings for batch:`, err)
      failed += batch.length
      continue
    }

    // Write each embedding individually (Supabase REST doesn't support bulk vector update)
    for (let j = 0; j < batch.length; j++) {
      try {
        await updateEmbedding(batch[j].id, embeddings[j])
        processed++
        if (processed % 25 === 0) console.log(`  ${processed}/${questions.length} done...`)
      } catch (err) {
        console.error(`  Failed to update question ${batch[j].id}:`, err)
        failed++
      }
    }

    // Respect OpenAI rate limits
    if (i + BATCH_SIZE < questions.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\nDone. ${processed} embeddings written, ${failed} failed.`)
  if (failed > 0) {
    console.log('Re-run the script to retry failed questions (it skips rows that already have embeddings).')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
