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

    const { data, error } = await supabase
      .from("user_program_fit")
      .select(
        "fit_score, program_id," +
        "programs(name, slug, type, status, deadline_at, equity_pct, cash_value_usd, program_value_score, is_rolling)"
      )
      .eq("user_id", user_id)
      .eq("programs.status", "open")
      .not("fit_score", "is", null)
      .order("fit_score", { ascending: false })
      .limit(limit * 4); // fetch extra, filter, re-rank

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    type ProgramRow = {
      name: string; slug: string; type: string; status: string;
      deadline_at: string | null; equity_pct: number | null;
      cash_value_usd: number | null; program_value_score: number | null;
      is_rolling: boolean;
    };

    const ranked = (data ?? [])
      .filter(r => r.programs)
      .map(r => {
        const raw = Array.isArray(r.programs) ? r.programs[0] : r.programs;
        const p = raw as unknown as ProgramRow;
        return {
          name: p.name, slug: p.slug, type: p.type, status: p.status,
          deadline_at: p.deadline_at, equity_pct: p.equity_pct,
          cash_value_usd: p.cash_value_usd, program_value_score: p.program_value_score,
          is_rolling: p.is_rolling,
          fit_score: r.fit_score,
          composite: ((r.fit_score ?? 0) * (p.program_value_score ?? 50)) / 100
        };
      })
      .filter(p => !equity_max_pct || p.equity_pct == null || p.equity_pct <= equity_max_pct)
      .filter(p => !type || type.includes(p.type as any))
      .sort((a, b) => b.composite - a.composite)
      .slice(0, limit);

    const output = { user_id, count: ranked.length, programs: ranked };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines: string[] = [`# Your Best Programs Right Now\n`];
    ranked.forEach((p, i) => {
      const days = p.deadline_at
        ? Math.ceil((new Date(p.deadline_at).getTime() - Date.now()) / 86_400_000)
        : null;
      lines.push(`## ${i + 1}. ${p.name}`);
      lines.push(
        `**Fit**: ${p.fit_score?.toFixed(0) ?? "?"}%  ·` +
        `  **Value**: ${p.program_value_score?.toFixed(0) ?? "?"}  ·  **Composite**: ${p.composite?.toFixed(0)}`
      );
      lines.push(
        `${p.equity_pct != null ? `${p.equity_pct}% equity` : "No equity"} · ` +
        `${p.cash_value_usd ? `$${p.cash_value_usd.toLocaleString()}` : "no cash"} · ` +
        `${p.is_rolling ? "Rolling" : "Cohort"}`
      );
      if (days != null) lines.push(`⏱ ${days} days left · \`/apply ${p.slug}\``);
      lines.push("");
    });

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
