import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerOpportunityScout(server: McpServer) {
  server.registerPrompt(
    "opportunity_scout",
    {
      title: "Opportunity Scout",
      description: "Given a user's profile answers, find and rank the best matching open programs. The recruiter.",
      argsSchema: {
        user_token: z.string().describe("Supabase JWT from the Application Hub"),
        top_n: z.string().optional().describe("Number of programs to surface (default 5)"),
        equity_max_pct: z.string().optional().describe("Max acceptable equity %"),
        type: z.string().optional().describe("Comma-separated list of types to filter (accel,grant,fellowship,etc.)")
      }
    },
    async ({ user_token, top_n, equity_max_pct, type }) => {
      const n = top_n ?? "5";
      const filters = [
        equity_max_pct ? `No programs taking more than ${equity_max_pct}% equity.` : "",
        type ? `Filter to types: ${type}.` : ""
      ].filter(Boolean).join(" ");

      const findBestCall = `hub_find_best_programs with user_token="${user_token}", limit=${n}` +
        (equity_max_pct ? `, equity_max_pct=${equity_max_pct}` : "") +
        (type ? `, type=${JSON.stringify(type.split(","))}` : "");

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `You are the Opportunity Scout for the Application Hub.
Your job: find the best programs for this user right now.

1. Call ${findBestCall}.
2. For each program in the result, call hub_get_application_readiness to show exactly what's missing.
3. Present the results clearly:
   - Program name, composite score, fit %, value score
   - Days to deadline
   - Exact questions still needed
   - A one-line "why this one" based on fit

${filters}

Be direct. Don't pad the response. Founders are busy.`
          }
        }]
      };
    }
  );
}
