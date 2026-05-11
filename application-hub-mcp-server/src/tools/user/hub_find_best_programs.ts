import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat, PROGRAM_TYPES } from "../../constants.js";
import { rankPrograms, daysUntil } from "./hub_find_best_programs.logic.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  limit: z.number().int().min(1).max(20).default(5),
  equity_max_pct: z.number().min(0).max(100).optional(),
  type: z.array(z.enum(PROGRAM_TYPES)).optional(),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

async function fetchFitRows(user_id: string, limit: number): Promise<any> {
  return supabase
    .from("user_program_fit")
    .select(
      "fit_score, program_id," +
      "programs(name, slug, type, status, deadline_at, equity_pct, cash_value_usd, program_value_score, is_rolling)"
    )
    .eq("user_id", user_id)
    .eq("programs.status", "open")
    .not("fit_score", "is", null)
    .order("fit_score", { ascending: false })
    .limit(limit * 4);
}

function formatScoreLine(p: any): string {
  const fit = p.fit_score?.toFixed(0) ?? "?";
  const value = p.program_value_score?.toFixed(0) ?? "?";
  return `**Fit**: ${fit}%  ·  **Value**: ${value}  ·  **Composite**: ${p.composite?.toFixed(0)}`;
}

function formatEconomicsLine(p: any): string {
  const equity = p.equity_pct != null ? `${p.equity_pct}% equity` : "No equity";
  const cash = p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "no cash";
  const cohort = p.is_rolling ? "Rolling" : "Cohort";
  return `${equity} · ${cash} · ${cohort}`;
}

function formatProgramBlock(p: any, i: number): string[] {
  const block = [
    `## ${i + 1}. ${p.name}`,
    formatScoreLine(p),
    formatEconomicsLine(p)
  ];
  const days = daysUntil(p.deadline_at);
  if (days != null) block.push(`⏱ ${days} days left · \`/apply ${p.slug}\``);
  block.push("");
  return block;
}

function formatMarkdown(output: any): string {
  const lines: string[] = [`# Your Best Programs Right Now\n`];
  output.programs.forEach((p: any, i: number) => lines.push(...formatProgramBlock(p, i)));
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

export function registerFindBestPrograms(server: McpServer) {
  server.registerTool("hub_find_best_programs", {
    title: "Find Best Programs For User (authenticated)",
    description: `The Opportunity Scout in tool form.
Ranks all currently open programs by (fit_score × program_value_score) for this specific user.

This is the primary discovery tool — proactively finds the best match between
what this user has written and what programs actually want.

Composite score = fit_score × program_value_score / 100
- High fit + high value = apply immediately
- High fit + low value = ready but not worth as much
- Low fit + high value = worth building toward

Returns top N with fit, value, composite score, days to deadline, and what type/structure.

Requires valid user_token.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, limit, equity_max_pct, type, response_format }) => {
    const user_id = await validateUserToken(user_token);
    const { data, error } = await fetchFitRows(user_id, limit);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    const ranked = rankPrograms(data ?? [], equity_max_pct, type, limit);
    const output = { user_id, count: ranked.length, programs: ranked };
    if (response_format === ResponseFormat.JSON) return buildJsonResponse(output);
    return buildMarkdownResponse(output);
  });
}
