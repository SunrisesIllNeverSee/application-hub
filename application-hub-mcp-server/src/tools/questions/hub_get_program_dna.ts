import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  program_id: z.string().uuid().optional(),
  slug: z.string().optional(),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict().refine(d => d.program_id || d.slug, { message: "Provide program_id or slug" });

export function registerGetProgramDna(server: McpServer) {
  server.registerTool("hub_get_program_dna", {
    title: "Get Program DNA",
    description: `Returns the theme weight breakdown for a program —
what it actually cares about, inferred from its questions.

Each theme (traction, team, product, market, mission, impact, financials, etc.) is weighted by
question count × word limits × order priority.

Example:
  YC: traction 35%, team 25%, product 20%, market 10%, ask 10%
  Echoing Green: impact 40%, mission 30%, team 20%, financials 10%

Use this to understand what to emphasize in your application, or to compare programs by focus area.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ program_id, slug, response_format }) => {
    // Resolve slug → id
    let id = program_id;
    if (!id && slug) {
      const { data } = await supabase.from("programs").select("id, name").eq("slug", slug).single();
      id = data?.id;
    }
    if (!id) return { content: [{ type: "text", text: "Program not found. Provide a valid program_id or slug." }] };

    const [dnaRes, programRes] = await Promise.all([
      supabase.from("program_dna").select("theme, question_count, word_limit_sum, weight_pct")
        .eq("program_id", id).order("weight_pct", { ascending: false }),
      supabase.from("programs").select("name").eq("id", id).single()
    ]);

    if (dnaRes.error || !dnaRes.data?.length) {
      return {
        content: [{
          type: "text",
          text: "DNA not yet computed for this program. Check back after the daily recompute runs."
        }]
      };
    }

    const themes = dnaRes.data;
    const name = programRes.data?.name ?? slug ?? id;
    const output = { program_id: id, program_name: name, themes };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const bar = (pct: number) => {
      const filled = Math.round(pct / 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    const lines: string[] = [
      `# What ${name} Cares About\n`,
      `${"Theme".padEnd(16)}${"Weight".padEnd(10)}Questions`,
      "─".repeat(36)
    ];

    for (const t of themes) {
      const pct = t.weight_pct ?? 0;
      lines.push(`${bar(pct)} ${t.theme.padEnd(14)} ${pct.toFixed(0).padStart(3)}%  (${t.question_count}q)`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
