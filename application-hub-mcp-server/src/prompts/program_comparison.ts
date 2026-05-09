import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerProgramComparison(server: McpServer) {
  server.registerPrompt(
    "program_comparison",
    {
      title: "Program Comparison",
      description: "Side-by-side comparison of two programs — what you get, what you give up, acceptance rates, and DNA.",
      argsSchema: {
        program_id_a: z.string().describe("First program UUID or slug"),
        program_id_b: z.string().describe("Second program UUID or slug"),
        user_token: z.string().optional().describe("Supabase JWT (optional — adds fit score to comparison)")
      }
    },
    async ({ program_id_a, program_id_b, user_token }) => {
      const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
      const paramA = isUuid(program_id_a) ? `program_id="${program_id_a}"` : `slug="${program_id_a}"`;
      const paramB = isUuid(program_id_b) ? `program_id="${program_id_b}"` : `slug="${program_id_b}"`;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Compare these two programs side by side.

For each program:
1. Call hub_get_program_detail (${paramA}) and (${paramB})
2. Call hub_get_acceptance_stats for each
3. Call hub_get_program_dna for each
${user_token ? `4. Call hub_get_fit_score with user_token="${user_token}" for each` : ""}

Then present a comparison table:

| | Program A | Program B |
|---|---|---|
| Cash | | |
| Credits | | |
| Equity taken | | |
| Length | | |
| Rolling | | |
| Network score | | |
| Brand score | | |
| Acceptance rate | | |
| Value score | | |
${user_token ? "| Your fit score | | |" : ""}

Then: **DNA comparison** — what each one weights (traction vs mission vs team etc.)
Then: **Bottom line** — which should they apply to first, and why.

Be direct. Don't hedge. Make a call.`
          }
        }]
      };
    }
  );
}
