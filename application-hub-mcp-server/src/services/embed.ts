import { supabase } from "./supabase.js";

// Shared embedding helper for the MCP server.
//
// The archived_questions.embedding column is 768d and was seeded with
// nomic-embed-text via Ollama. The MCP server runs locally (stdio), so
// localhost Ollama is reachable — that is the preferred (and only default)
// provider, keeping all embeddings in the same vector space as the archive.

const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

export const EMBED_DIMS = 768;

export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: trimmed }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding || data.embedding.length !== EMBED_DIMS) return null;
    return data.embedding;
  } catch {
    return null;
  }
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
