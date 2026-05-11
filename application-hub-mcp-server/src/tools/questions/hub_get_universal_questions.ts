import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  theme: z.string().optional().describe("Filter to a specific theme"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetUniversalQuestions(server: McpServer) {
  server.registerTool("hub_get_universal_questions", {
    title: "Get Universal Questions",
    description: `Questions asked by 80%+ of programs — the ones to answer first.

These are the highest-leverage questions in the platform. Answer them well and you've covered
the majority of most applications without starting from scratch.

Ranked by significance_score descending. Use theme to filter to a specific category.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ limit, theme, response_format }) => {
    let q = supabase
      .from("archived_questions")
      .select(`id, text, theme, significance_score, asked_by_count, avg_word_limit`)
      .eq("is_universal", true)
      .order("significance_score", { ascending: false })
      .limit(limit);

    if (theme) q = q.eq("theme", theme);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const questions = data ?? [];
    const output = { count: questions.length, questions };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines: string[] = [
      `# Universal Questions — Answer These First`,
      `_These ${questions.length} questions are asked by 80%+ of programs. Nail them = cover most applications._\n`
    ];

    questions.forEach((q, i) => {
      lines.push(`### ${i + 1}. ${q.text}`);
      lines.push(
        `- **Theme**: ${q.theme ?? "?"} | **Significance**: ${q.significance_score?.toFixed(0) ?? "?"}` +
        ` | **Programs**: ${q.asked_by_count}`
      );
      lines.push(`- **Avg word limit**: ${q.avg_word_limit ?? "varies"}`);
      lines.push("");
    });

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
