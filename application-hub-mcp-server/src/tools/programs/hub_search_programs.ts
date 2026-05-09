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

export function registerSearchPrograms(server: McpServer) {
  server.registerTool("hub_search_programs", {
    title: "Search Programs",
    description: `Search the Application Hub for startup programs — accelerators, grants, fellowships, VC programs, corporate programs, university programs, jobs.

Supports filtering by type, status, equity %, minimum cash, rolling vs cohort, and deadline window. Sort by heat score (trending), value score (ROI), deadline, or acceptance rate.

Returns: id, name, slug, type, status, deadline, equity_pct, cash_value_usd, heat_score, program_value_score, is_rolling.

Use hub_get_program_detail for full details on a specific program.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params) => {
    let q = supabase
      .from("programs")
      .select(`id, name, slug, type, status, deadline_at, equity_pct, cash_value_usd,
               credit_value_usd, heat_score, program_value_score, is_rolling`,
               { count: "exact" })
      .order(params.sort_by === "deadline" ? "deadline_at" : params.sort_by,
             { ascending: params.sort_by === "deadline" })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.status) q = q.in("status", params.status);
    if (params.type) q = q.in("type", params.type);
    if (params.equity_max_pct !== undefined) {
      q = q.or(`equity_pct.is.null,equity_pct.lte.${params.equity_max_pct}`);
    }
    if (params.min_cash_usd) q = q.gte("cash_value_usd", params.min_cash_usd);
    if (params.rolling_only) q = q.eq("is_rolling", true);
    if (params.query) q = q.ilike("name", `%${params.query}%`);
    if (params.deadline_within_days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + params.deadline_within_days);
      q = q.lte("deadline_at", cutoff.toISOString()).gte("deadline_at", new Date().toISOString());
    }

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error searching programs: ${error.message}` }] };

    const programs = data ?? [];
    const output = {
      total: count ?? programs.length,
      count: programs.length,
      offset: params.offset,
      has_more: (count ?? 0) > params.offset + programs.length,
      programs
    };

    if (params.response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines: string[] = [`# Programs (${output.total} found)\n`];
    for (const p of programs) {
      const days = p.deadline_at
        ? Math.ceil((new Date(p.deadline_at).getTime() - Date.now()) / 86_400_000)
        : null;
      lines.push(`## ${p.name}`);
      lines.push(`- **Type**: ${p.type} | **Status**: ${p.status}`);
      lines.push(`- **Equity**: ${p.equity_pct != null ? `${p.equity_pct}%` : "none"} | **Cash**: ${p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "n/a"}`);
      lines.push(`- **Heat**: ${p.heat_score?.toFixed(1) ?? "—"} | **Value Score**: ${p.program_value_score?.toFixed(1) ?? "—"}`);
      lines.push(`- **Rolling**: ${p.is_rolling ? "Yes" : "No"}${days != null ? ` | **Deadline**: ${days} days` : ""}`);
      lines.push(`- **Slug**: ${p.slug}\n`);
    }

    if (output.has_more) {
      lines.push(`_Showing ${params.offset + 1}–${params.offset + programs.length} of ${output.total}. Use offset to paginate._`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
