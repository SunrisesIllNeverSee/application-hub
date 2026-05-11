import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  program_id: z.string().uuid().describe("Program UUID"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

type CohortCounts = { accepted: number; rejected: number; waitlist: number };

async function fetchStatsAndReports(program_id: string): Promise<any> {
  return Promise.all([
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
}

function tallyOutcome(counts: CohortCounts, outcome: string): void {
  if (outcome === "accepted") counts.accepted++;
  else if (outcome === "rejected") counts.rejected++;
  else if (outcome === "waitlist") counts.waitlist++;
}

function aggregateByCohort(reports: any[]): Record<string, CohortCounts> {
  const byCohort: Record<string, CohortCounts> = {};
  for (const r of reports) {
    const label = r.cohort_round ?? "unknown";
    if (!byCohort[label]) byCohort[label] = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(byCohort[label], r.outcome);
  }
  return byCohort;
}

function buildOutput(program_id: string, stats: any, reports: any[]): any {
  const byCohort = aggregateByCohort(reports);
  return {
    program_id,
    acceptance_rate_pct: stats.acceptance_rate != null ? stats.acceptance_rate * 100 : null,
    total_reports: stats.application_count ?? 0,
    cohort_breakdown: Object.entries(byCohort).map(([label, counts]) => ({ label, ...counts }))
  };
}

function reliabilityLabel(total: number): string {
  if (total < 10) return " _(low confidence — fewer than 10 reports)_";
  if (total < 30) return " _(moderate confidence)_";
  return " _(high confidence)_";
}

function formatCohortLine(c: any): string {
  return `- **${c.label}**: ${c.accepted} accepted, ${c.rejected} rejected, ${c.waitlist} waitlisted`;
}

function formatMarkdown(output: any): string {
  const total = output.total_reports ?? 0;
  const rate = output.acceptance_rate_pct?.toFixed(1) ?? "?";
  const lines = [
    `# Acceptance Stats`,
    `**Acceptance Rate**: ${rate}%${reliabilityLabel(total)}`,
    `**Total Reports**: ${output.total_reports}`
  ];
  if (output.cohort_breakdown.length) {
    lines.push("\n## By Cohort");
    for (const c of output.cohort_breakdown) lines.push(formatCohortLine(c));
  }
  return lines.join("\n").slice(0, CHARACTER_LIMIT);
}

function noDataResponse(): any {
  return {
    content: [{
      type: "text",
      text: "No acceptance data yet for this program. Be the first to report your outcome."
    }]
  };
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
    const [statsRes, cohortRes] = await fetchStatsAndReports(program_id);
    if (statsRes.error || !statsRes.data) return noDataResponse();
    const output = buildOutput(program_id, statsRes.data, cohortRes.data ?? []);
    if (response_format === ResponseFormat.JSON) return buildJsonResponse(output);
    return buildMarkdownResponse(output);
  });
}
