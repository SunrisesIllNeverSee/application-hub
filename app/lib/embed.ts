// Shared embedding helper — single source of truth for question embeddings.
//
// The archived_questions.embedding column is 768d and was seeded with
// nomic-embed-text via Ollama. All new embeddings MUST come from the same
// vector space, so Ollama is the default and preferred provider.
//
// OpenAI text-embedding-3-small at 768d is a DIFFERENT vector space — only
// used as a fallback when explicitly enabled (ALLOW_OPENAI_EMBED_FALLBACK=1),
// otherwise cross-space similarity scores are garbage.

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_MODEL = 'text-embedding-3-small'

export const EMBED_DIMS = 768

export type EmbedSource = 'ollama' | 'ollama_byok' | 'openai' | 'openai_byok'

export type EmbedResult = {
  embedding: number[]
  source: EmbedSource
}

export type ByokIntegration = {
  provider: string
  base_url?: string | null
  model_preference?: string | null
  decrypted_key?: string | null
}

async function embedOllama(
  text: string,
  baseUrl: string,
  model: string
): Promise<number[] | null> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { embedding?: number[] }
    if (!data.embedding || data.embedding.length !== EMBED_DIMS) return null
    return data.embedding
  } catch {
    return null
  }
}

async function embedOpenAI(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: OPENAI_MODEL, dimensions: EMBED_DIMS }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data: [{ embedding: number[] }] }
    return data.data[0].embedding
  } catch {
    return null
  }
}

/**
 * Embed text with the operator's available providers.
 * Order: BYOK ollama → env Ollama → BYOK OpenAI* → platform OpenAI*
 * (* only when ALLOW_OPENAI_EMBED_FALLBACK=1 — different vector space)
 */
export async function embedQuestionText(
  text: string,
  byok?: ByokIntegration[] | null
): Promise<EmbedResult | null> {
  const trimmed = text.trim()
  if (trimmed.length < 3) return null

  for (const integration of byok ?? []) {
    if (integration.provider === 'ollama') {
      const baseUrl = integration.base_url || OLLAMA_URL
      const model = integration.model_preference ?? OLLAMA_MODEL
      const embedding = await embedOllama(trimmed, baseUrl, model)
      if (embedding) return { embedding, source: 'ollama_byok' }
    }
  }

  const envEmbedding = await embedOllama(trimmed, OLLAMA_URL, OLLAMA_MODEL)
  if (envEmbedding) return { embedding: envEmbedding, source: 'ollama' }

  if (process.env.ALLOW_OPENAI_EMBED_FALLBACK === '1') {
    for (const integration of byok ?? []) {
      if (integration.provider === 'openai' && integration.decrypted_key) {
        const embedding = await embedOpenAI(trimmed, integration.decrypted_key)
        if (embedding) return { embedding, source: 'openai_byok' }
      }
    }
    if (OPENAI_API_KEY) {
      const embedding = await embedOpenAI(trimmed, OPENAI_API_KEY)
      if (embedding) return { embedding, source: 'openai' }
    }
  }

  return null
}

/**
 * Best-effort: embed a question and store it on archived_questions.
 * Never throws — embedding failure must not break intake flows.
 * Callers pass a client with write access (user-scoped or admin).
 */
export async function embedAndStoreQuestion(
  supabase: { from: (t: string) => any },
  questionId: string,
  questionText: string,
  byok?: ByokIntegration[] | null
): Promise<boolean> {
  try {
    const result = await embedQuestionText(questionText, byok)
    if (!result) return false
    const { error } = await supabase
      .from('archived_questions')
      .update({ embedding: JSON.stringify(result.embedding) })
      .eq('id', questionId)
    return !error
  } catch {
    return false
  }
}
