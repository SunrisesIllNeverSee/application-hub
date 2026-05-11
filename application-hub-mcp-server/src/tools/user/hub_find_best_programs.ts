import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat, PROGRAM_TYPES } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  limit: z.number().int().min(1).max(20).default(5),
  equity_max_pct: z.number().min(0).max(100).optional(),
  type: z.array(z.enum(PROGRAM_TYPES)).optional(),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

type ProgramRow = {
  name: string; slug: string; type: string; status: string;
  deadline_at: string | null; equity_pct: number | null;
  cash_value_usd: number | null; program_value_score: number | null;
  is_rolling: boolean;
};

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

function extractProgram(r: any): ProgramRow {
  const raw = Array.isArray(r.programs) ? r.programs[0] : r.programs;
  return raw as unknown as ProgramRow;
}

function rowToRanked(r: any): any {
  const p = extractProgram(r);
  return {
    name: p.name, slug: p.slug, type: p.type, status: p.status,
    deadline_at: p.deadline_at, equity_pct: p.equity_pct,
    cash_value_usd: p.cash_value_usd, program_value_score: p.program_value_score,
    is_rolling: p.is_rolling,
    fit_score: r.fit_score,
    composite: ((r.fit_score ?? 0) * (p.program_value_score ?? 50)) / 100
  };
}

function passesEquity(p: any, equity_max_pct: number | undefined): boolean {
  if (equity_max_pct === undefined) return true;
  if (p.equity_pct == null) return true;
  return p.equity_pct <= equity_max_pct;
}

function passesType(p: any, type: string[] | undefined): boolean {
  if (!type) return true;
  return type.includes(p.type);
}

function rankPrograms(
  rows: any[],
  equity_max_pct: number | undefined,
  type: string[] | undefined,
  limit: number
): any[] {
  return rows
    .filter(r => r.programs)
    .map(rowToRanked)
    .filter(p => passesEquity(p, equity_max_pct))
    .filter(p => passesType(p, type))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, limit);
}

function daysUntil(deadline_at: string | null): number | null {
  if (!deadline_at) return null;
  return Math.ceil((new Date(deadline_at).getTime() - Date.now()) / 86_400_000);
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
