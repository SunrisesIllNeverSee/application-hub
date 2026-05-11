import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../services/supabase.js";
import { cache } from "../services/cache.js";

const VALUE_FIELDS =
  "id, name, slug, type, equity_pct, cash_value_usd, credit_value_usd," +
  " program_value_score, network_score, brand_score";
const HEAT_FIELDS = "id, name, slug, type, heat_score, deadline_at, equity_pct, cash_value_usd";
const ONE_HOUR_MS = 3_600_000;

function jsonContents(uri: string, text: string) {
  return { contents: [{ uri, mimeType: "application/json", text }] };
}

async function fetchValueRanking(): Promise<string> {
  const { data } = await supabase
    .from("programs")
    .select(VALUE_FIELDS)
    .eq("status", "open")
    .not("program_value_score", "is", null)
    .order("program_value_score", { ascending: false })
    .limit(25);
  return JSON.stringify({ count: data?.length ?? 0, programs: data ?? [] }, null, 2);
}

async function fetchHeatRanking(): Promise<string> {
  const { data } = await supabase
    .from("programs")
    .select(HEAT_FIELDS)
    .eq("status", "open")
    .not("heat_score", "is", null)
    .order("heat_score", { ascending: false })
    .limit(25);
  return JSON.stringify({ count: data?.length ?? 0, programs: data ?? [] }, null, 2);
}

async function fetchPlatformStats(): Promise<string> {
  const [programs, questions] = await Promise.all([
    supabase.from("programs").select("id", { count: "exact", head: true }),
    supabase.from("archived_questions").select("id", { count: "exact", head: true })
  ]);
  return JSON.stringify({
    total_programs: programs.count ?? 0,
    total_questions: questions.count ?? 0,
    as_of: new Date().toISOString()
  }, null, 2);
}

export function registerRankingResources(server: McpServer) {
  server.registerResource(
    "Top Programs by Value (ROI)",
    "hub://rankings/value",
    {
      description: "Open programs ranked by program_value_score —" +
        " what you get vs what you give up vs application effort.",
      mimeType: "application/json"
    },
    async () => {
      const cacheKey = "resource:rankings:value";
      const cached = cache.get<string>(cacheKey);
      if (cached) return jsonContents("hub://rankings/value", cached);
      const text = await fetchValueRanking();
      cache.set(cacheKey, text, ONE_HOUR_MS);
      return jsonContents("hub://rankings/value", text);
    }
  );

  server.registerResource(
    "Trending Programs (Heat Score)",
    "hub://rankings/heat",
    {
      description: "Open programs ranked by heat_score — real-time signal of applicant interest.",
      mimeType: "application/json"
    },
    async () => {
      const cacheKey = "resource:rankings:heat";
      const cached = cache.get<string>(cacheKey);
      if (cached) return jsonContents("hub://rankings/heat", cached);
      const text = await fetchHeatRanking();
      cache.set(cacheKey, text, ONE_HOUR_MS);
      return jsonContents("hub://rankings/heat", text);
    }
  );

  server.registerResource(
    "Platform Stats",
    "hub://stats/platform",
    {
      description: "Total programs, questions, and users in the hub (public, anonymized).",
      mimeType: "application/json"
    },
    async () => jsonContents("hub://stats/platform", await fetchPlatformStats())
  );
}
