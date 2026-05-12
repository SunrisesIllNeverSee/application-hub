import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const DOMAINS = ["founder", "jobs", "education", "grants", "general"] as const;

const Schema = z.object({
  text: z.string().min(3).describe(
    "Question text or concept to search for (e.g. 'describe your traction', 'why are you the right team')"
  ),
  theme: z.string().optional().describe("Filter by theme (traction, team, market, etc.)"),
  domain: z.enum(DOMAINS).default("founder").describe("Application domain — founder, jobs, education, grants, general"),
  threshold: z.number().min(0).max(1).default(0.7).describe("Cosine similarity threshold (0–1). Default 0.7."),
  limit: z.number().int().min(1).max(20).default(10),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerFindSimilarQuestions(server: McpServer) {
  server.registerTool("hub_find_similar_questions", {
    title: "Find Similar Questions (Semantic Search)",
    description: `Semantic search across the entire question archive using pgvector cosine similarity.

Use this to:
- Find all questions that ask about traction/team/market/etc.
- Discover which programs ask a specific type of question
- Find the canonical version of a question across programs

Returns: question text, theme, significance score, asked_by_count, is_universal, programs that ask it.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ text, theme, domain, threshold, limit, response_format }) => {
    // Use pgvector match_archived_questions RPC (requires embedding generation server-side)
    // Falls back to full-text search if embeddings not yet available
    let data: any[] | null = null;
    let error: any = null;

    try {
      const rpc = await supabase.rpc("match_archived_questions", {
        query_text: text,
        match_threshold: threshold,
        match_count: limit
      });
      data = rpc.data;
      error = rpc.error;
    } catch {
      // Fallback: full-text ilike search
      const { data: fbData, error: fbError } = await supabase
        .from("archived_questions")
        .select(`id, text, theme, significance_score, asked_by_count, is_universal`)
        .eq("domain", domain)
        .ilike("text", `%${text.split(" ").slice(0, 3).join("%")}%`)
        .order("significance_score", { ascending: false })
        .limit(limit);
      data = fbData;
      error = fbError;
    }

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    let questions = (data ?? []).filter((q: any) => !domain || q.domain === domain || q.domain == null);
    if (theme) questions = questions.filter((q: any) => q.theme === theme);

    const output = { count: questions.length, query: text, questions };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines: string[] = [`# Questions Similar to: "${text}"\n`];
    for (const q of questions) {
      lines.push(`**${q.text}**`);
      lines.push(
        `- Theme: ${q.theme ?? "?"} | Significance: ${q.significance_score?.toFixed(0) ?? "?"}` +
        ` | Asked by: ${q.asked_by_count} programs${q.is_universal ? " ⭐" : ""}`
      );
      lines.push("");
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
