import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat, PROGRAM_TYPES } from "../../constants.js";

const Schema = z.object({
  type: z.enum(PROGRAM_TYPES).optional(),
  status: z.enum(["open", "upcoming"]).optional().default("open"),
  limit: z.number().int().min(1).max(50).default(10),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerGetHeatScores(server: McpServer) {
  server.registerTool("hub_get_heat_scores", {
    title: "Get Heat Scores (Trending Programs)",
    description: `Returns programs ranked by heat_score — a real-time signal of applicant interest based on
views, saves, draft starts, submits, and deadline pressure.

High heat = lots of founders looking at this right now. Useful for spotting what's trending before deadlines close.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ type, status, limit, response_format }) => {
    let q = supabase
      .from("programs")
      .select(`id, name, slug, type, status, heat_score, deadline_at, equity_pct, cash_value_usd, is_rolling`)
      .not("heat_score", "is", null)
      .order("heat_score", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);
    if (type) q = q.eq("type", type);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const programs = data ?? [];
    const output = { count: programs.length, programs };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const heatBar = (score: number | null) => {
      if (!score) return "░░░░░";
      const filled = Math.min(5, Math.round(score / 20));
      return "█".repeat(filled) + "░".repeat(5 - filled);
    };

    const lines: string[] = [`# Trending Programs Right Now\n`];
    programs.forEach((p, i) => {
      const days = p.deadline_at
        ? Math.ceil((new Date(p.deadline_at).getTime() - Date.now()) / 86_400_000)
        : null;
      lines.push(`${i + 1}. **${p.name}** ${heatBar(p.heat_score)} ${p.heat_score?.toFixed(0) ?? "—"}`);
      lines.push(
        `   ${p.type} | ${p.equity_pct != null ? `${p.equity_pct}% equity` : "no equity"}` +
        ` | ${p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "no cash"}` +
        `${days != null ? ` | ${days}d left` : ""}`
      );
      lines.push("");
    });

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
