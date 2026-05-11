import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerRankMyAnswers(server: McpServer) {
  server.registerTool("hub_rank_my_answers", {
    title: "Rank My Answers by Coverage (authenticated)",
    description: `Ranks the user's profile answers by how many open programs each one covers.

"Your traction answer covers 47 programs. Your team answer covers 39 programs."

Use this to understand which answers are the most leveraged — and which missing answers would unlock
the most programs if written.

Requires valid user_token.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, response_format }) => {
    const user_id = await validateUserToken(user_token);

    const { data, error } = await supabase
      .from("profile_answers")
      .select(`id, question_text, theme, confidence, word_count, updated_at,
               archived_questions(asked_by_count, significance_score, is_universal)`)
      .eq("user_id", user_id)
      .not("archived_question_id", "is", null);

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    type AqJoin = {
      asked_by_count: number | null;
      significance_score: number | null;
      is_universal: boolean | null;
    } | null;

    const answers = (data ?? [])
      .map(a => {
        const aq = (Array.isArray(a.archived_questions) ? a.archived_questions[0] : a.archived_questions) as AqJoin;
        return {
          question_text: a.question_text,
          theme: a.theme,
          confidence: a.confidence,
          word_count: a.word_count,
          asked_by_count: aq?.asked_by_count ?? 1,
          significance_score: aq?.significance_score ?? 0,
          is_universal: aq?.is_universal ?? false
        };
      })
      .sort((a, b) => b.asked_by_count - a.asked_by_count);

    const output = { count: answers.length, answers };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const confidenceIcon: Record<string, string> = { draft: "✏️", solid: "✅", locked: "🔒" };

    const lines: string[] = [
      `# Your Answers Ranked by Coverage`,
      `_Answers that unlock the most programs_\n`
    ];

    answers.forEach((a, i) => {
      lines.push(`${i + 1}. **${a.question_text.slice(0, 80)}${a.question_text.length > 80 ? "…" : ""}**`);
      lines.push(
        `   Covers **${a.asked_by_count} programs** | Theme: ${a.theme ?? "?"} |` +
        ` ${confidenceIcon[a.confidence] ?? ""} ${a.confidence}${a.is_universal ? " ⭐" : ""}`
      );
    });

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
