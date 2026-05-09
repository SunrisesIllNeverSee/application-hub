import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  program_id: z.string().uuid().describe("Program UUID"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetFitScore(server: McpServer) {
  server.registerTool("hub_get_fit_score", {
    title: "Get Fit Score (authenticated)",
    description: `How well does this user match a specific program? Returns a 0–100 fit score broken into four components:

- coverage_pct (40% weight): % of required questions the user has profile answers for
- theme_alignment (35% weight): do the user's strongest answers match the program's highest-weighted themes?
- criteria_match (15% weight): stage/sector/geography match
- quality_signal (10% weight): answer quality vs word limits, confidence level

Overall fit_score = weighted average × 100.

Use hub_find_best_programs to rank all programs at once.

Requires valid user_token.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, program_id, response_format }) => {
    const user_id = await validateUserToken(user_token);

    const { data, error } = await supabase
      .from("user_program_fit")
      .select(`fit_score, coverage_pct, theme_alignment, criteria_match, quality_signal, computed_at`)
      .eq("user_id", user_id)
      .eq("program_id", program_id)
      .single();

    if (error || !data) {
      return {
        content: [{
          type: "text",
          text: "Fit score not yet computed. It's recalculated daily — check back after saving profile answers, or use hub_get_application_readiness for a quick coverage check."
        }]
      };
    }

    const output = { user_id, program_id, ...data };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const scoreBar = (pct: number | null) => {
      const val = pct ?? 0;
      const filled = Math.round(val / 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    const lines = [
      `# Fit Score`,
      ``,
      `**${data.fit_score?.toFixed(0) ?? "?"}/100** overall fit`,
      ``,
      `${scoreBar(data.coverage_pct)} Coverage       ${data.coverage_pct?.toFixed(0) ?? "?"}%  (40% weight) — required questions answered`,
      `${scoreBar(data.theme_alignment)} Theme Match    ${data.theme_alignment?.toFixed(0) ?? "?"}%  (35% weight) — your answers match what this program values`,
      `${scoreBar(data.criteria_match)} Criteria Match ${data.criteria_match?.toFixed(0) ?? "?"}%  (15% weight) — stage/sector/geo requirements`,
      `${scoreBar(data.quality_signal)} Quality Signal ${data.quality_signal?.toFixed(0) ?? "?"}%  (10% weight) — answer length and confidence`,
      ``,
      `_Computed: ${data.computed_at}_`
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
