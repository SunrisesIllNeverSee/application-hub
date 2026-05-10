import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  slug: z.string().min(1).describe("Program slug, e.g. y-combinator"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetProgramBySlug(server: McpServer) {
  server.registerTool("hub_get_program_by_slug", {
    title: "Get Program By Slug",
    description: `Fetches one program by slug for server-side app routes.

Returns the full program row plus program_stats and program_dna rows so a detail page can render headline facts, acceptance/heat context, and theme weights in one call.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ slug, response_format }) => {
    const { data, error } = await supabase
      .from("programs")
      .select(`
        *,
        program_stats(*),
        program_dna(theme, question_count, word_limit_sum, weight_pct, computed_at)
      `)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return { content: [{ type: "text", text: `Program not found for slug "${slug}".` }] };
    }

    const output = {
      program: data,
      stats: Array.isArray(data.program_stats) ? data.program_stats[0] : data.program_stats,
      dna: data.program_dna ?? []
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const program = output.program;
    const stats = output.stats;
    const dna = output.dna as Array<{ theme: string; weight_pct: number; question_count: number }>;

    const lines: string[] = [
      `# ${program.name}`,
      `**Slug**: ${program.slug}`,
      `**Type**: ${program.type} | **Status**: ${program.status}`,
      program.description ? `\n${program.description}` : "",
      "",
      "## Terms",
      `- Cash: ${program.cash_value_usd ? `$${program.cash_value_usd.toLocaleString()}` : "none"}`,
      `- Credits: ${program.credit_value_usd ? `$${program.credit_value_usd.toLocaleString()}` : "none"}`,
      `- Equity: ${program.equity_pct != null ? `${program.equity_pct}%` : "none"}`,
      `- Deadline: ${program.deadline_at ?? "rolling"}`,
      `- Rolling: ${program.is_rolling ? "Yes" : "No"}`,
      "",
      "## Scores",
      `- Heat: ${program.heat_score?.toFixed(1) ?? "not computed"}`,
      `- Value: ${program.program_value_score?.toFixed(1) ?? "not computed"}`,
      `- Acceptance: ${stats?.acceptance_rate_pct?.toFixed(1) ?? "unknown"}%`,
      "",
      "## Program DNA",
      ...(dna.length
        ? dna
            .sort((a, b) => b.weight_pct - a.weight_pct)
            .map(d => `- ${d.theme}: ${d.weight_pct.toFixed(1)}% (${d.question_count} questions)`)
        : ["No DNA rows computed yet."])
    ];

    return {
      content: [{ type: "text", text: lines.filter(Boolean).join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
