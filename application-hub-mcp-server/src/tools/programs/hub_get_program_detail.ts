import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  program_id: z.string().uuid().optional().describe("Program UUID"),
  slug: z.string().optional().describe("Program slug (alternative to program_id)"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict().refine(d => d.program_id || d.slug, { message: "Provide program_id or slug" });

export function registerGetProgramDetail(server: McpServer) {
  server.registerTool("hub_get_program_detail", {
    title: "Get Program Detail",
    description: `Full details for a single program. Use program_id (UUID) or slug.

Returns all fields: name, type, status, description, website, equity, cash, credits, length, deadlines, rolling/cohort, network score, brand score, follow-on rate, acceptance rate, question count, listing tier.

Use hub_get_program_questions to get the actual questions for this program.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ program_id, slug, response_format }) => {
    let q = supabase
      .from("programs")
      .select(`*, program_stats(acceptance_rate_pct, total_applications, total_accepted, last_cohort_label)`);

    if (program_id) q = q.eq("id", program_id);
    else if (slug) q = q.eq("slug", slug);

    const { data, error } = await q.single();
    if (error || !data) {
      return { content: [{ type: "text", text: `Program not found. Try hub_search_programs to find a valid slug or ID.` }] };
    }

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: data
      };
    }

    const stats = data.program_stats;
    const lines: string[] = [
      `# ${data.name}`,
      `**Type**: ${data.type} | **Status**: ${data.status}`,
      data.description ? `\n${data.description}` : "",
      "",
      `## What You Get`,
      `- Cash: ${data.cash_value_usd ? `$${data.cash_value_usd.toLocaleString()}` : "none"}`,
      `- Credits: ${data.credit_value_usd ? `$${data.credit_value_usd.toLocaleString()}` : "none"}`,
      `- Equity taken: ${data.equity_pct != null ? `${data.equity_pct}%` : "none"}`,
      `- Network score: ${data.network_score ?? "?"}/10`,
      `- Brand score: ${data.brand_score ?? "?"}/10`,
      `- Follow-on funding rate: ${data.follow_on_rate_pct ? `${data.follow_on_rate_pct}%` : "unknown"}`,
      "",
      `## Program Details`,
      `- Length: ${data.program_length_weeks ? `${data.program_length_weeks} weeks` : "n/a"}`,
      `- Rolling: ${data.is_rolling ? "Yes" : "No (cohort)"}`,
      `- Deadline: ${data.deadline_at ?? "rolling"}`,
      `- Exclusivity: ${data.exclusivity_days ? `${data.exclusivity_days} days` : "none"}`,
      data.website_url ? `- Website: ${data.website_url}` : "",
      "",
      `## Program Value Score`,
      `${data.program_value_score?.toFixed(1) ?? "not yet computed"}`,
      "",
      `## Acceptance Stats`,
      stats
        ? `- Acceptance rate: ${stats.acceptance_rate_pct?.toFixed(1) ?? "?"}%\n- Total reports: ${stats.total_applications ?? 0}`
        : "No acceptance data yet — be the first to report.",
    ];

    return {
      content: [{ type: "text", text: lines.filter(Boolean).join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: data
    };
  });
}
