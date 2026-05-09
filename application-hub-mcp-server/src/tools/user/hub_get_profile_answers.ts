import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat, ANSWER_CONFIDENCES, QUESTION_THEMES } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  theme: z.enum(QUESTION_THEMES).optional().describe("Filter to a specific theme"),
  confidence: z.enum(ANSWER_CONFIDENCES).optional().describe("Filter by confidence level"),
  limit: z.number().int().min(1).max(50).default(20),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetProfileAnswers(server: McpServer) {
  server.registerTool("hub_get_profile_answers", {
    title: "Get Profile Answers (authenticated)",
    description: `Returns the user's stored profile answers — their reusable answer bank.

Profile answers are the canonical versions of their responses, stored once and reused across multiple applications. Higher confidence = more polished.

Confidence levels:
- draft: rough, needs work
- solid: good, usable as-is
- locked: final, not to be changed

Use theme to filter to a specific category (e.g. only traction answers when drafting a traction section).

Requires valid user_token (Supabase JWT).`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, theme, confidence, limit, response_format }) => {
    const user_id = await validateUserToken(user_token);

    let q = supabase
      .from("profile_answers")
      .select(`id, question_text, theme, answer_content, confidence, word_count, updated_at,
               archived_question_id`)
      .eq("user_id", user_id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (theme) q = q.eq("theme", theme);
    if (confidence) q = q.eq("confidence", confidence);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const answers = data ?? [];
    const output = { user_id, count: answers.length, answers };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const confidenceEmoji: Record<string, string> = { draft: "✏️", solid: "✅", locked: "🔒" };

    const lines: string[] = [`# Your Profile Answers (${answers.length})\n`];
    for (const a of answers) {
      lines.push(`## ${a.question_text}`);
      lines.push(`**Theme**: ${a.theme ?? "?"} | **Confidence**: ${confidenceEmoji[a.confidence] ?? ""} ${a.confidence} | **Words**: ${a.word_count ?? "?"}`);
      lines.push("");
      lines.push(a.answer_content.slice(0, 500) + (a.answer_content.length > 500 ? "…" : ""));
      lines.push("\n---\n");
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
