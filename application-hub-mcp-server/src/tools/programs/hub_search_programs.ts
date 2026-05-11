import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat, PROGRAM_TYPES, PROGRAM_STATUSES, SORT_OPTIONS } from "../../constants.js";

const Schema = z.object({
  query: z.string().optional().describe("Full-text search on program name/description"),
  type: z.array(z.enum(PROGRAM_TYPES)).optional().describe("Filter by program type"),
  status: z.array(z.enum(PROGRAM_STATUSES)).optional().default(["open"]),
  equity_max_pct: z.number().min(0).max(100).optional().describe("Exclude programs taking more than this % equity"),
  min_cash_usd: z.number().optional().describe("Minimum cash value in USD"),
  rolling_only: z.boolean().optional().describe("Only show rolling (non-cohort) programs"),
  deadline_within_days: z.number().int().optional().describe("Only programs with deadlines within N days"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort_by: z.enum(SORT_OPTIONS).default("heat_score"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

const SELECT_COLS = `id, name, slug, type, status, deadline_at, equity_pct, cash_value_usd,
               credit_value_usd, heat_score, program_value_score, is_rolling`;

function buildBaseQuery(params: any): any {
  return supabase
    .from("programs")
    .select(SELECT_COLS, { count: "exact" })
    .order(params.sort_by === "deadline" ? "deadline_at" : params.sort_by,
           { ascending: params.sort_by === "deadline" })
    .range(params.offset, params.offset + params.limit - 1);
}

function applyDeadlineFilter(q: any, days: number): any {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return q.lte("deadline_at", cutoff.toISOString()).gte("deadline_at", new Date().toISOString());
}

function applyEquityFilter(q: any, equity_max_pct: number): any {
  return q.or(`equity_pct.is.null,equity_pct.lte.${equity_max_pct}`);
}

function applyFilters(q: any, params: any): any {
  if (params.status) q = q.in("status", params.status);
  if (params.type) q = q.in("type", params.type);
  if (params.equity_max_pct !== undefined) q = applyEquityFilter(q, params.equity_max_pct);
  if (params.min_cash_usd) q = q.gte("cash_value_usd", params.min_cash_usd);
  if (params.rolling_only) q = q.eq("is_rolling", true);
  if (params.query) q = q.ilike("name", `%${params.query}%`);
  if (params.deadline_within_days) q = applyDeadlineFilter(q, params.deadline_within_days);
  return q;
}

function daysUntil(deadline_at: string | null | undefined): number | null {
  if (!deadline_at) return null;
  return Math.ceil((new Date(deadline_at).getTime() - Date.now()) / 86_400_000);
}

function formatEquityCash(p: any): string {
  const equity = p.equity_pct != null ? `${p.equity_pct}%` : "none";
  const cash = p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "n/a";
  return `- **Equity**: ${equity} | **Cash**: ${cash}`;
}

function formatHeatValue(p: any): string {
  const heat = p.heat_score?.toFixed(1) ?? "—";
  const value = p.program_value_score?.toFixed(1) ?? "—";
  return `- **Heat**: ${heat} | **Value Score**: ${value}`;
}

function formatRollingDeadline(p: any): string {
  const days = daysUntil(p.deadline_at);
  const rolling = p.is_rolling ? "Yes" : "No";
  const deadline = days != null ? ` | **Deadline**: ${days} days` : "";
  return `- **Rolling**: ${rolling}${deadline}`;
}

function formatProgramBlock(p: any): string[] {
  return [
    `## ${p.name}`,
    `- **Type**: ${p.type} | **Status**: ${p.status}`,
    formatEquityCash(p),
    formatHeatValue(p),
    formatRollingDeadline(p),
    `- **Slug**: ${p.slug}\n`
  ];
}

function formatPaginationFooter(params: any, programs: any[], total: number): string {
  return `_Showing ${params.offset + 1}–${params.offset + programs.length} of ${total}.` +
    ` Use offset to paginate._`;
}

function formatMarkdown(output: any, params: any): string {
  const lines: string[] = [`# Programs (${output.total} found)\n`];
  for (const p of output.programs) lines.push(...formatProgramBlock(p));
  if (output.has_more) lines.push(formatPaginationFooter(params, output.programs, output.total));
  return lines.join("\n").slice(0, CHARACTER_LIMIT);
}

function buildOutput(params: any, programs: any[], count: number | null): any {
  return {
    total: count ?? programs.length,
    count: programs.length,
    offset: params.offset,
    has_more: (count ?? 0) > params.offset + programs.length,
    programs
  };
}

function buildJsonResponse(output: any): any {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
    structuredContent: output
  };
}

function buildMarkdownResponse(output: any, params: any): any {
  return {
    content: [{ type: "text", text: formatMarkdown(output, params) }],
    structuredContent: output
  };
}

export function registerSearchPrograms(server: McpServer) {
  server.registerTool("hub_search_programs", {
    title: "Search Programs",
    description: `Search the Application Hub for startup programs —
accelerators, grants, fellowships, VC programs, corporate programs, university programs, jobs.

Supports filtering by type, status, equity %, minimum cash, rolling vs cohort, and deadline window.
Sort by heat score (trending), value score (ROI), deadline, or acceptance rate.

Returns: id, name, slug, type, status, deadline, equity_pct, cash_value_usd,
heat_score, program_value_score, is_rolling.

Use hub_get_program_detail for full details on a specific program.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params) => {
    const q = applyFilters(buildBaseQuery(params), params);
    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error searching programs: ${error.message}` }] };
    const output = buildOutput(params, data ?? [], count);
    if (params.response_format === ResponseFormat.JSON) return buildJsonResponse(output);
    return buildMarkdownResponse(output, params);
  });
}
