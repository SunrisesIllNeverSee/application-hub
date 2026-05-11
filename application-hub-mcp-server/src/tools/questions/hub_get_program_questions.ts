import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  program_id: z.string().uuid().describe("Program UUID"),
  include_optional: z.boolean().default(true).describe("Include optional questions (default true)"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

type AqJoin = {
  id: unknown;
  theme: string | null;
  is_universal: boolean | null;
  significance_score: number | null;
  asked_by_count: number | null;
} | null;

async function fetchQuestions(program_id: string, include_optional: boolean): Promise<any> {
  let q = supabase
    .from("program_questions")
    .select(`id, asked_as, word_limit, char_limit, is_required, order_index,
             archived_questions(id, theme, is_universal, significance_score, asked_by_count)`)
    .eq("program_id", program_id)
    .order("order_index");
  if (!include_optional) q = q.eq("is_required", true);
  return q;
}

function extractAq(q: any): AqJoin {
  return (Array.isArray(q.archived_questions) ? q.archived_questions[0] : q.archived_questions) as AqJoin;
}

function mapQuestion(q: any): any {
  const aq = extractAq(q);
  return {
    id: q.id,
    text: q.asked_as,
    theme: aq?.theme ?? null,
    word_limit: q.word_limit,
    char_limit: q.char_limit,
    is_required: q.is_required,
    order_index: q.order_index,
    is_universal: aq?.is_universal ?? false,
    significance_score: aq?.significance_score ?? null,
    asked_by_count: aq?.asked_by_count ?? 1
  };
}

function stars(score: number | null): string {
  if (!score) return "☆☆☆☆☆";
  const filled = Math.min(5, Math.round(score * 5));
  return "★".repeat(filled) + "☆".repeat(Math.max(0, 5 - filled));
}

function limitStr(q: any): string {
  if (q.word_limit) return `${q.word_limit} words`;
  if (q.char_limit) return `${q.char_limit} chars`;
  return "none";
}

function formatSignificanceLine(q: any): string {
  const universal = q.is_universal ? " ⭐ Universal" : "";
  return `- **Significance**: ${stars(q.significance_score)} | **Asked by**: ${q.asked_by_count} programs${universal}`;
}

function formatQuestionBlock(q: any): string[] {
  return [
    `### ${q.order_index + 1}. ${q.text}`,
    `- **Required**: ${q.is_required ? "Yes" : "No"} | **Theme**: ${q.theme ?? "?"}`,
    `- **Limit**: ${limitStr(q)}`,
    formatSignificanceLine(q),
    ""
  ];
}

function formatMarkdown(output: any): string {
  const lines: string[] = [`# Questions for Program\n`, `${output.count} questions\n`];
  for (const q of output.questions) lines.push(...formatQuestionBlock(q));
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

export function registerGetProgramQuestions(server: McpServer) {
  server.registerTool("hub_get_program_questions", {
    title: "Get Program Questions",
    description: `All application questions for a specific program, ordered by display order.

Returns: asked_as, theme, word_limit, char_limit, is_required, is_universal, significance_score (from archive),
asked_by_count (how many other programs ask the same question).

The significance_score tells you how much this question matters across the platform —
high significance = answer this well and it works for many programs.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ program_id, include_optional, response_format }) => {
    const { data, error } = await fetchQuestions(program_id, include_optional);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data?.length) return { content: [{ type: "text", text: "No questions found for this program." }] };
    const questions = data.map(mapQuestion);
    const output = { program_id, count: questions.length, questions };
    if (response_format === ResponseFormat.JSON) return buildJsonResponse(output);
    return buildMarkdownResponse(output);
  });
}
