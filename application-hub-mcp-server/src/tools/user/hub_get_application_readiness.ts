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

async function fetchRequiredQuestions(program_id: string): Promise<any> {
  const { data, error } = await supabase
    .from("program_questions")
    .select(`id, asked_as, word_limit, archived_question_id, archived_questions(theme)`)
    .eq("program_id", program_id)
    .eq("is_required", true)
    .order("order_index");
  return { data: data ?? [], error };
}

async function fetchAnsweredSet(user_id: string, archiveIds: any[]): Promise<Set<any>> {
  const { data } = await supabase
    .from("profile_answers")
    .select("archived_question_id, confidence")
    .eq("user_id", user_id)
    .in("archived_question_id", archiveIds);
  return new Set((data ?? []).map(a => a.archived_question_id));
}

async function fetchProgramMeta(program_id: string): Promise<any> {
  const { data } = await supabase.from("programs")
    .select("name, deadline_at").eq("id", program_id).single();
  return data;
}

function computeDaysRemaining(deadline_at: string | null | undefined): number | null {
  if (!deadline_at) return null;
  return Math.ceil((new Date(deadline_at).getTime() - Date.now()) / 86_400_000);
}

function getQuestionTheme(q: any): string | null {
  const raw = Array.isArray(q.archived_questions) ? q.archived_questions[0] : q.archived_questions;
  return raw?.theme ?? null;
}

function buildMissingList(questions: any[], answeredSet: Set<any>): any[] {
  return questions
    .filter(q => !q.archived_question_id || !answeredSet.has(q.archived_question_id))
    .map(q => ({
      question_text: q.asked_as,
      theme: getQuestionTheme(q),
      word_limit: q.word_limit
    }));
}

function progressBar(completion_pct: number): string {
  const filled = Math.round(completion_pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function formatMissingLine(q: any): string {
  const themeLabel = q.theme ?? "?";
  const wordLabel = q.word_limit ? ` _(${q.word_limit}w)_` : "";
  return `- **[${themeLabel}]** ${q.question_text}${wordLabel}`;
}

function formatDeadlineLine(days_remaining: number | null): string {
  if (days_remaining != null) return `⏱ **${days_remaining} days** until deadline`;
  return "⏱ Rolling — no hard deadline";
}

function formatMarkdown(output: any): string {
  const {
    program_name,
    completion_pct,
    answered_questions,
    total_required_questions,
    days_remaining,
    missing_questions
  } = output;
  const progress = `${progressBar(completion_pct)} **${completion_pct}%**`;
  const answered = `${answered_questions}/${total_required_questions} required questions answered`;
  const lines = [
    `# Readiness: ${program_name}`,
    "",
    `${progress} — ${answered}`,
    formatDeadlineLine(days_remaining),
    ""
  ];
  if (missing_questions.length) {
    lines.push("## Still Needed");
    for (const q of missing_questions) lines.push(formatMissingLine(q));
  } else {
    lines.push("✅ All required questions answered. Ready to apply!");
  }
  return lines.join("\n").slice(0, CHARACTER_LIMIT);
}

function buildJsonResponse(output: any): any {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
    structuredContent: output
  };
}

function buildMarkdownResponse(output: any): any {
  return {
    content: [{ type: "text", text: formatMarkdown(output) }],
    structuredContent: output
  };
}

async function buildReadinessOutput(user_id: string, program_id: string): Promise<any> {
  const { data: questions, error } = await fetchRequiredQuestions(program_id);
  if (error) return { error: error.message };

  const archiveIds = questions.map((q: any) => q.archived_question_id).filter(Boolean);
  const answeredSet = await fetchAnsweredSet(user_id, archiveIds);
  const missing_questions = buildMissingList(questions, answeredSet);
  const answered = questions.length - missing_questions.length;
  const completion_pct = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;

  const program = await fetchProgramMeta(program_id);

  return {
    output: {
      program_id,
      program_name: program?.name ?? "Unknown",
      completion_pct,
      answered_questions: answered,
      total_required_questions: questions.length,
      days_remaining: computeDaysRemaining(program?.deadline_at),
      missing_questions
    }
  };
}

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
    const result = await buildReadinessOutput(user_id, program_id);
    if (result.error) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    if (response_format === ResponseFormat.JSON) return buildJsonResponse(result.output);
    return buildMarkdownResponse(result.output);
  });
}
