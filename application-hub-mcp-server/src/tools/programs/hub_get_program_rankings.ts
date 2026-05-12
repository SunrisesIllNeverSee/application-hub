import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat, PROGRAM_TYPES, PROGRAM_STATUSES } from "../../constants.js";

type RankedProgram = {
  id: string; name: string; slug: string; type: string; domain: string; status: string;
  equity_pct: number | null; cash_value_usd: number | null; credit_value_usd: number | null;
  program_value_score: number | null; network_score: number | null; brand_score: number | null;
  follow_on_rate_pct: number | null; heat_score: number | null;
  is_rolling: boolean; deadline_at: string | null;
};

const Schema = z.object({
  type: z.array(z.enum(PROGRAM_TYPES)).optional(),
  status: z.array(z.enum(PROGRAM_STATUSES)).optional().default(["open"]),
  equity_max_pct: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetProgramRankings(server: McpServer) {
  server.registerTool("hub_get_program_rankings", {
    title: "Get Program Rankings (by Value/ROI)",
    description: `Programs ranked by program_value_score — a composite of what you get
(cash, credits, network, brand value) minus what you give up (equity, exclusivity),
divided by application difficulty.

Higher score = better ROI for the effort of applying.

Use filters to narrow by type or equity tolerance. Best for answering "what should I apply to first?"`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ type, status, equity_max_pct, limit, response_format }) => {
    const { data, error } = await supabase.rpc("get_top_programs_by_value", {
      p_types:      type ?? null,
      p_domain:     "founder",
      p_equity_max: equity_max_pct ?? null,
      p_status:     status ?? ["open"],
      p_limit:      limit,
    });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const programs: RankedProgram[] = (data ?? []) as RankedProgram[];
    const output = { count: programs.length, programs };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines: string[] = [`# Top Programs by Value Score\n`];
    programs.forEach((p, i) => {
      lines.push(`## ${i + 1}. ${p.name} — Score: ${p.program_value_score?.toFixed(1)}`);
      lines.push(`- Type: ${p.type} | Equity: ${p.equity_pct != null ? `${p.equity_pct}%` : "none"}`);
      lines.push(
        `- Cash: ${p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "—"}` +
        ` | Credits: ${p.credit_value_usd ? `$${p.credit_value_usd.toLocaleString()}` : "—"}`
      );
      lines.push(
        `- Network: ${p.network_score ?? "?"}/10 | Brand: ${p.brand_score ?? "?"}/10` +
        ` | Follow-on: ${p.follow_on_rate_pct ? `${p.follow_on_rate_pct}%` : "?"}`
      );
      lines.push(`- Rolling: ${p.is_rolling ? "Yes" : "No"} | Deadline: ${p.deadline_at ?? "n/a"}\n`);
    });

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
