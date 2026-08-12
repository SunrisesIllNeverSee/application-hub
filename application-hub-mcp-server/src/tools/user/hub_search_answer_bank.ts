import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { embedText } from "../../services/embed.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

// The pound-out loop, step 0/aux (MCP surface): search the user's answer
// bank. Vector search when Ollama is reachable; falls back to full-text
// search on the question text. Never returns another user's answers.

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_LIMIT = 8;

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  query: z.string().trim().min(3).max(500).describe("Natural-language query (a question, theme, or phrase)"),
  limit: z.number().int().min(1).max(25).default(DEFAULT_LIMIT),
  threshold: z.number().min(0).max(1).default(DEFAULT_THRESHOLD)
    .describe("Minimum similarity for vector matches (0–1). Ignored in FTS fallback."),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
}).strict();

type BankHit = {
  archived_question_id: string;
  question_text: string;
  theme: string | null;
  answer_content: string | null;
  version: number | null;
  confidence: string | null;
  similarity: number | null;
  match_mode: "vector" | "fts";
};

export function registerSearchAnswerBank(server: McpServer) {
  server.registerTool("hub_search_answer_bank", {
    title: "Search Answer Bank (authenticated)",
    description: `Search the user's own answer bank by natural-language query.

Tries vector search first (Ollama nomic-embed-text → match_archived_questions RPC joined to the user's profile_answers). Falls back to full-text search on archived_questions.text when embeddings are unavailable.

Returns: question text, theme, the user's latest answer for that question, version, confidence (draft/solid/locked), similarity, and match mode. Never returns another user's answers (RLS-scoped via user_token).`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ user_token, query, limit, threshold, response_format }) => {
    const user_id = await validateUserToken(user_token);

    let hits: BankHit[] = [];
    let mode: "vector" | "fts" = "vector";
    let embedAvailable = true;

    // 1. Vector path
    const embedding = await embedText(query);
    if (!embedding) {
      embedAvailable = false;
    } else {
      const { data: matches, error } = await supabase.rpc("match_archived_questions", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: threshold,
        match_count: limit * 2, // over-fetch, then filter to user's answers
      });

      if (error) {
        embedAvailable = false;
      } else {
        const candidateIds = ((matches ?? []) as Array<{ id: string; text: string; similarity: number }>)
          .map((m) => m.id);
        const simById = new Map<string, number>(
          ((matches ?? []) as Array<{ id: string; similarity: number }>).map((m) => [m.id, m.similarity])
        );

        if (candidateIds.length > 0) {
          const { data: answers } = await supabase
            .from("profile_answers")
            .select("id, archived_question_id, content, answer_content, version, confidence")
            .eq("user_id", user_id)
            .in("archived_question_id", candidateIds)
            .order("version", { ascending: false });

          const latestByQ = new Map<string, any>();
          for (const a of (answers ?? []) as any[]) {
            if (!latestByQ.has(a.archived_question_id)) latestByQ.set(a.archived_question_id, a);
          }

          const textById = new Map<string, string>(
            ((matches ?? []) as Array<{ id: string; text: string }>).map((m) => [m.id, m.text])
          );

          for (const [qid, ans] of latestByQ.entries()) {
            const { data: qRow } = await supabase
              .from("archived_questions")
              .select("text, theme")
              .eq("id", qid)
              .maybeSingle();
            hits.push({
              archived_question_id: qid,
              question_text: (qRow?.text as string) ?? textById.get(qid) ?? "",
              theme: (qRow?.theme as string) ?? null,
              answer_content: (ans.answer_content as string) ?? (ans.content as string) ?? null,
              version: (ans.version as number) ?? null,
              confidence: (ans.confidence as string) ?? null,
              similarity: simById.get(qid) ?? null,
              match_mode: "vector",
            });
          }
          hits.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
          hits = hits.slice(0, limit);
        }
      }
    }

    // 2. FTS fallback
    if (hits.length === 0) {
      mode = "fts";
      embedAvailable = false;
      const term = query.replace(/[%_]/g, " ").trim().slice(0, 100);
      const { data: qMatches } = await supabase
        .from("archived_questions")
        .select("id, text, theme")
        .ilike("text", `%${term}%`)
        .limit(limit * 2);

      const candidateIds = ((qMatches ?? []) as Array<{ id: string; text: string; theme: string }>)
        .map((q) => q.id);

      if (candidateIds.length > 0) {
        const { data: answers } = await supabase
          .from("profile_answers")
          .select("id, archived_question_id, content, answer_content, version, confidence")
          .eq("user_id", user_id)
          .in("archived_question_id", candidateIds)
          .order("version", { ascending: false });

        const latestByQ = new Map<string, any>();
        for (const a of (answers ?? []) as any[]) {
          if (!latestByQ.has(a.archived_question_id)) latestByQ.set(a.archived_question_id, a);
        }

        const qMeta = new Map<string, { text: string; theme: string }>(
          ((qMatches ?? []) as Array<{ id: string; text: string; theme: string }>).map((q) => [q.id, { text: q.text, theme: q.theme }])
        );

        for (const [qid, ans] of latestByQ.entries()) {
          const meta = qMeta.get(qid);
          hits.push({
            archived_question_id: qid,
            question_text: meta?.text ?? "",
            theme: meta?.theme ?? null,
            answer_content: (ans.answer_content as string) ?? (ans.content as string) ?? null,
            version: (ans.version as number) ?? null,
            confidence: (ans.confidence as string) ?? null,
            similarity: null,
            match_mode: "fts",
          });
        }
        hits = hits.slice(0, limit);
      }
    }

    const output = {
      query,
      mode,
      embedding_available: embedAvailable,
      count: hits.length,
      hits: hits.map((h) => ({
        question: h.question_text,
        theme: h.theme,
        answer: h.answer_content,
        version: h.version,
        confidence: h.confidence,
        similarity: h.similarity !== null ? Math.round(h.similarity * 1000) / 1000 : null,
        match_mode: h.match_mode,
      })),
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output,
      };
    }

    if (hits.length === 0) {
      const note = embedAvailable
        ? "No matches above threshold. Lower `threshold` or rephrase the query."
        : "No matches. Embedding was unavailable and full-text search returned nothing — is Ollama running?";
      return {
        content: [{ type: "text", text: `# Answer Bank Search\n\n**Query**: ${query}\n**Mode**: ${mode}\n\n${note}` }],
        structuredContent: output,
      };
    }

    const lines = [
      `# Answer Bank Search`,
      `**Query**: ${query}`,
      `**Mode**: ${mode}${embedAvailable ? "" : " (embedding unavailable — FTS fallback)"}`,
      `**Hits**: ${hits.length}`,
      "",
      ...hits.map((h, i) => {
        const sim = h.similarity !== null ? ` · ${Math.round(h.similarity * 100)}%` : "";
        const conf = h.confidence ? ` [${h.confidence}]` : "";
        const ver = h.version !== null ? ` v${h.version}` : "";
        return [
          `## ${i + 1}. ${h.question_text.slice(0, 100)}${sim}${conf}${ver}`,
          h.theme ? `_${h.theme}_` : null,
          "",
          (h.answer_content ?? "").slice(0, 600),
        ].filter((l): l is string => l !== null).join("\n");
      }),
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output,
    };
  });
}
