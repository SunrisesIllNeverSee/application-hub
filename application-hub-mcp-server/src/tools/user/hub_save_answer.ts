import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { userClient } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { ANSWER_CONFIDENCES, CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const SAVE_ANSWER_FIELDS =
  "id, user_id, archived_question_id, question_text, theme, answer_content," +
  " confidence, word_count, version, updated_at, last_updated";

type SavedAnswerRow = {
  id: string;
  user_id: string;
  archived_question_id: string;
  question_text: string | null;
  theme: string | null;
  answer_content: string;
  confidence: string;
  word_count: number | null;
  version: number | null;
  updated_at: string | null;
  last_updated: string | null;
};

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  archived_question_id: z.string().uuid().describe("Archived question UUID this profile answer answers"),
  answer_content: z.string().trim().min(1).max(25_000).describe("Reusable profile answer content"),
  confidence: z.enum(ANSWER_CONFIDENCES).default("draft"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerSaveAnswer(server: McpServer) {
  server.registerTool("hub_save_answer", {
    title: "Save Profile Answer (authenticated)",
    description: `Upserts one reusable profile answer for the authenticated user.

Validates that archived_question_id exists, then writes profile_answers using the user's Supabase JWT.
The database trigger keeps content/answer_content, question_text, theme, word_count, and updated_at aligned.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, archived_question_id, answer_content, confidence, response_format }) => {
    const user_id = await validateUserToken(user_token);
    const client = userClient(user_token);

    const { data: question, error: questionError } = await client
      .from("archived_questions")
      .select("id, text, theme, significance_score, asked_by_count")
      .eq("id", archived_question_id)
      .single();

    if (questionError || !question) {
      return { content: [{ type: "text", text: "Archived question not found or not readable." }] };
    }

    const { data, error } = await client
      .from("profile_answers")
      .upsert({
        user_id,
        archived_question_id,
        answer_content,
        confidence
      }, { onConflict: "user_id,archived_question_id" })
      .select(SAVE_ANSWER_FIELDS)
      .single();

    const answer = data as SavedAnswerRow | null;

    if (error || !answer) {
      return { content: [{ type: "text", text: `Error saving answer: ${error?.message ?? "unknown error"}` }] };
    }

    const output = { answer, archived_question: question };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines = [
      "# Answer Saved",
      `**Question**: ${answer.question_text || question.text}`,
      `**Theme**: ${answer.theme ?? question.theme ?? "unknown"}`,
      `**Confidence**: ${answer.confidence}`,
      `**Words**: ${answer.word_count ?? "not computed"}`,
      "",
      answer.answer_content
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
