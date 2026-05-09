import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  question_id: z.string().uuid().describe("Archived question UUID"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetQuestionSignificance(server: McpServer) {
  server.registerTool("hub_get_question_significance", {
    title: "Get Question Significance",
    description: `Returns the significance score for a question in the archive — how much this question matters across all programs that ask it.

Significance = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus

High significance = this question appears in many programs with high word limits → answering it well covers a lot of ground.

Also returns which programs weight this question highest (by theme match).`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ question_id, response_format }) => {
    const { data, error } = await supabase
      .from("archived_questions")
      .select(`id, text, theme, significance_score, asked_by_count, avg_word_limit, is_universal, theme_weight`)
      .eq("id", question_id)
      .single();

    if (error || !data) {
      return { content: [{ type: "text", text: "Question not found in archive." }] };
    }

    const output = data;

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const stars = (score: number | null) => {
      if (!score) return "☆☆☆☆☆";
      const filled = Math.min(5, Math.round(score / 20));
      return "★".repeat(filled) + "☆".repeat(5 - filled);
    };

    const lines = [
      `# Question Significance`,
      `\n**"${data.text}"**\n`,
      `- **Theme**: ${data.theme ?? "unknown"}`,
      `- **Significance**: ${stars(data.significance_score)} ${data.significance_score?.toFixed(0) ?? "?"}`,
      `- **Asked by**: ${data.asked_by_count} programs`,
      `- **Avg word limit**: ${data.avg_word_limit ?? "varies"}`,
      `- **Universal**: ${data.is_universal ? "Yes ⭐ — asked by 80%+ of programs" : "No"}`,
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
