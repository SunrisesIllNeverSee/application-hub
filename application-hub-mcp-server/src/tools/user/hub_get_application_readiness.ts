import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  program_id: z.string().uuid().describe("Program UUID"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetApplicationReadiness(server: McpServer) {
  server.registerTool("hub_get_application_readiness", {
    title: "Get Application Readiness (authenticated)",
    description: `How ready is this user to apply to a specific program?

Returns:
- completion_pct: % of required questions answered
- answered_questions / total_required
- missing_questions: which required questions still need answers
- days_remaining until deadline

Use to identify exactly what's left to do before submitting.

Requires valid user_token.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, program_id, response_format }) => {
    const user_id = await validateUserToken(user_token);

    // Get required questions for this program
    const { data: allQuestions, error: qErr } = await supabase
      .from("program_questions")
      .select(`id, exact_phrasing, theme, word_limit, archived_question_id`)
      .eq("program_id", program_id)
      .eq("is_required", true)
      .order("order_index");

    if (qErr) return { content: [{ type: "text", text: `Error: ${qErr.message}` }] };

    const questions = allQuestions ?? [];

    // Get user's existing answers for this program's archived questions
    const archiveIds = questions.map(q => q.archived_question_id).filter(Boolean);
    const { data: profileAnswers } = await supabase
      .from("profile_answers")
      .select("archived_question_id, confidence")
      .eq("user_id", user_id)
      .in("archived_question_id", archiveIds);

    const answeredSet = new Set((profileAnswers ?? []).map(a => a.archived_question_id));

    const missing = questions.filter(q => !q.archived_question_id || !answeredSet.has(q.archived_question_id));
    const answered = questions.length - missing.length;
    const completion_pct = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;

    // Get program deadline
    const { data: program } = await supabase.from("programs")
      .select("name, deadline_at").eq("id", program_id).single();

    const days_remaining = program?.deadline_at
      ? Math.ceil((new Date(program.deadline_at).getTime() - Date.now()) / 86_400_000)
      : null;

    const output = {
      program_id,
      program_name: program?.name ?? "Unknown",
      completion_pct,
      answered_questions: answered,
      total_required_questions: questions.length,
      days_remaining,
      missing_questions: missing.map(q => ({
        question_text: q.exact_phrasing,
        theme: q.theme,
        word_limit: q.word_limit
      }))
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const progressBar = () => {
      const filled = Math.round(completion_pct / 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    const lines = [
      `# Readiness: ${output.program_name}`,
      "",
      `${progressBar()} **${completion_pct}%** — ${answered}/${questions.length} required questions answered`,
      days_remaining != null
        ? `⏱ **${days_remaining} days** until deadline`
        : "⏱ Rolling — no hard deadline",
      ""
    ];

    if (missing.length) {
      lines.push("## Still Needed");
      for (const q of output.missing_questions) {
        lines.push(`- **[${q.theme ?? "?"}]** ${q.question_text}${q.word_limit ? ` _(${q.word_limit}w)_` : ""}`);
      }
    } else {
      lines.push("✅ All required questions answered. Ready to apply!");
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
