import { supabase } from "./supabase.js";

// Keep in sync with app/lib/embed.ts — single source of truth is the app layer.
// The MCP server can't import app/lib/embed.ts directly (separate package).
//
// The archived_questions.embedding column is 768d and was seeded with
// nomic-embed-text via Ollama. All new embeddings MUST come from the same
// vector space, so Ollama is the default and preferred provider.
//
// OpenAI text-embedding-3-small at 768d is a DIFFERENT vector space — only
// used as a fallback when explicitly enabled (ALLOW_OPENAI_EMBED_FALLBACK=1),
// otherwise cross-space similarity scores are garbage.

const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = "text-embedding-3-small";

export const EMBED_DIMS = 768;

async function embedOllama(text: string, baseUrl: string, model: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding || data.embedding.length !== EMBED_DIMS) return null;
    return data.embedding;
  } catch {
    return null;
  }
}

async function embedOpenAI(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text, model: OPENAI_MODEL, dimensions: EMBED_DIMS }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: [{ embedding: number[] }] };
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

/**
 * Embed text. Ollama first (matches the archive's vector space).
 * OpenAI ONLY when ALLOW_OPENAI_EMBED_FALLBACK=1 — different vector
 * space, off by default to prevent silent garbage similarity scores.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;

  const ollama = await embedOllama(trimmed, OLLAMA_URL, OLLAMA_MODEL);
  if (ollama) return ollama;

  if (process.env.ALLOW_OPENAI_EMBED_FALLBACK === "1" && OPENAI_API_KEY) {
    return await embedOpenAI(trimmed, OPENAI_API_KEY);
  }

  return null;
}

/**
 * Best-effort: embed a question and store it on archived_questions.
 * Never throws — embedding failure must not break intake flows.
 */
export async function embedAndStoreQuestion(questionId: string, questionText: string): Promise<boolean> {
  try {
    const embedding = await embedText(questionText);
    if (!embedding) return false;
    const { error } = await supabase
      .from("archived_questions")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", questionId);
    return !error;
  } catch {
    return false;
  }
}
