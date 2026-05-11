import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../services/supabase.js";
import { cache } from "../services/cache.js";

export function registerProgramResources(server: McpServer) {
  // ── Static: full program list ─────────────────────────────────────────────
  server.registerResource(
    "Programs Directory",
    "hub://programs",
    {
      description: "All open programs — name, type, equity, cash, heat score. Refreshed every 60 s.",
      mimeType: "application/json"
    },
    async (_uri) => {
      const cacheKey = "resource:programs:all";
      const cached = cache.get<string>(cacheKey);
      if (cached) return { contents: [{ uri: "hub://programs", mimeType: "application/json", text: cached }] };

      const { data } = await supabase
        .from("programs")
        .select(
          "id, name, slug, type, status, deadline_at, heat_score, program_value_score," +
          " is_rolling, equity_pct, cash_value_usd"
        )
        .eq("status", "open")
        .order("heat_score", { ascending: false })
        .limit(100);

      const text = JSON.stringify({ count: data?.length ?? 0, programs: data ?? [] }, null, 2);
      cache.set(cacheKey, text, 60_000);
      return { contents: [{ uri: "hub://programs", mimeType: "application/json", text }] };
    }
  );

  // ── Template: single program by slug ─────────────────────────────────────
  const slugTemplate = new ResourceTemplate("hub://programs/{slug}", { list: undefined });

  server.registerResource(
    "Program Detail by Slug",
    slugTemplate,
    {
      description: "Full program detail by slug. E.g. hub://programs/y-combinator",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const slug = variables.slug as string;
      const cacheKey = `resource:programs:${slug}`;
      const cached = cache.get<string>(cacheKey);
      if (cached) return { contents: [{ uri: uri.toString(), mimeType: "application/json", text: cached }] };

      const { data } = await supabase
        .from("programs")
        .select("*, program_stats(*)")
        .eq("slug", slug)
        .single();

      const text = data
        ? JSON.stringify(data, null, 2)
        : JSON.stringify({ error: `No program found with slug "${slug}"` }, null, 2);

      if (data) cache.set(cacheKey, text, 300_000); // 5 min
      return { contents: [{ uri: uri.toString(), mimeType: "application/json", text }] };
    }
  );
}
