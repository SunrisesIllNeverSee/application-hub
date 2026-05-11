import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../services/supabase.js";
import { cache } from "../services/cache.js";

export function registerRankingResources(server: McpServer) {
  server.registerResource(
    "Top Programs by Value (ROI)",
    "hub://rankings/value",
    {
      description: "Open programs ranked by program_value_score —" +
        " what you get vs what you give up vs application effort.",
      mimeType: "application/json"
    },
    async (_uri) => {
      const cacheKey = "resource:rankings:value";
      const cached = cache.get<string>(cacheKey);
      if (cached) return { contents: [{ uri: "hub://rankings/value", mimeType: "application/json", text: cached }] };

      const { data } = await supabase
        .from("programs")
        .select(
          "id, name, slug, type, equity_pct, cash_value_usd, credit_value_usd," +
          " program_value_score, network_score, brand_score"
        )
        .eq("status", "open")
        .not("program_value_score", "is", null)
        .order("program_value_score", { ascending: false })
        .limit(25);

      const text = JSON.stringify({ count: data?.length ?? 0, programs: data ?? [] }, null, 2);
      cache.set(cacheKey, text, 3_600_000); // 1 hour, recomputed daily by cron
      return { contents: [{ uri: "hub://rankings/value", mimeType: "application/json", text }] };
    }
  );

  server.registerResource(
    "Trending Programs (Heat Score)",
    "hub://rankings/heat",
    {
      description: "Open programs ranked by heat_score — real-time signal of applicant interest.",
      mimeType: "application/json"
    },
    async (_uri) => {
      const cacheKey = "resource:rankings:heat";
      const cached = cache.get<string>(cacheKey);
      if (cached) return { contents: [{ uri: "hub://rankings/heat", mimeType: "application/json", text: cached }] };

      const { data } = await supabase
        .from("programs")
        .select("id, name, slug, type, heat_score, deadline_at, equity_pct, cash_value_usd")
        .eq("status", "open")
        .not("heat_score", "is", null)
        .order("heat_score", { ascending: false })
        .limit(25);

      const text = JSON.stringify({ count: data?.length ?? 0, programs: data ?? [] }, null, 2);
      cache.set(cacheKey, text, 3_600_000);
      return { contents: [{ uri: "hub://rankings/heat", mimeType: "application/json", text }] };
    }
  );

  server.registerResource(
    "Platform Stats",
    "hub://stats/platform",
    {
      description: "Total programs, questions, and users in the hub (public, anonymized).",
      mimeType: "application/json"
    },
    async (_uri) => {
      const [programs, questions] = await Promise.all([
        supabase.from("programs").select("id", { count: "exact", head: true }),
        supabase.from("archived_questions").select("id", { count: "exact", head: true })
      ]);

      const text = JSON.stringify({
        total_programs: programs.count ?? 0,
        total_questions: questions.count ?? 0,
        as_of: new Date().toISOString()
      }, null, 2);

      return { contents: [{ uri: "hub://stats/platform", mimeType: "application/json", text }] };
    }
  );
}
