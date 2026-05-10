import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  program_id: z.string().uuid().describe("Program UUID"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetAcceptanceStats(server: McpServer) {
  server.registerTool("hub_get_acceptance_stats", {
    title: "Get Acceptance Stats",
    description: `Crowdsourced acceptance rate and outcome data for a program.

Data is contributed by applicants who report their outcomes (accepted, rejected, waitlisted) after each cycle.

Returns: acceptance_rate_pct, total_reports, cohort breakdown.

Note: Low report counts mean less statistical reliability — treat as directional.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ program_id, response_format }) => {
    const [statsRes, cohortRes] = await Promise.all([
      supabase.from("program_stats")
        .select("acceptance_rate, application_count, updated_at")
        .eq("program_id", program_id)
        .single(),
      supabase.from("acceptance_reports")
        .select("cohort_round, outcome")
        .eq("program_id", program_id)
        .order("reported_at", { ascending: false })
        .limit(100)
    ]);

    if (statsRes.error || !statsRes.data) {
      return { content: [{ type: "text", text: "No acceptance data yet for this program. Be the first to report your outcome." }] };
    }

    const stats = statsRes.data;
    const reports = cohortRes.data ?? [];

    // Aggregate by cohort
    const byCohort: Record<string, { accepted: number; rejected: number; waitlist: number }> = {};
    for (const r of reports) {
      const label = r.cohort_round ?? "unknown";
      if (!byCohort[label]) byCohort[label] = { accepted: 0, rejected: 0, waitlist: 0 };
      if (r.outcome === "accepted") byCohort[label].accepted++;
      else if (r.outcome === "rejected") byCohort[label].rejected++;
      else if (r.outcome === "waitlist") byCohort[label].waitlist++;
    }

    const output = {
      program_id,
      acceptance_rate_pct: stats.acceptance_rate != null ? stats.acceptance_rate * 100 : null,
      total_reports: stats.application_count ?? 0,
      cohort_breakdown: Object.entries(byCohort).map(([label, counts]) => ({ label, ...counts }))
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const reliability = (output.total_reports ?? 0) < 10
      ? " _(low confidence — fewer than 10 reports)_"
      : (output.total_reports ?? 0) < 30
      ? " _(moderate confidence)_"
      : " _(high confidence)_";

    const lines = [
      `# Acceptance Stats`,
      `**Acceptance Rate**: ${output.acceptance_rate_pct?.toFixed(1) ?? "?"}%${reliability}`,
      `**Total Reports**: ${output.total_reports}`,
    ];

    if (output.cohort_breakdown.length) {
      lines.push("\n## By Cohort");
      for (const c of output.cohort_breakdown) {
        lines.push(`- **${c.label}**: ${c.accepted} accepted, ${c.rejected} rejected, ${c.waitlist} waitlisted`);
      }
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
