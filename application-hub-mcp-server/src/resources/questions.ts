import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../services/supabase.js";
import { cache } from "../services/cache.js";

export function registerQuestionResources(server: McpServer) {
  // ── Universal questions — answer these first ──────────────────────────────
  server.registerResource(
    "Universal Questions",
    "hub://questions/universal",
    {
      description: "Questions asked by 80%+ of programs, ordered by significance score. Answer these first.",
      mimeType: "application/json"
    },
    async (_uri) => {
      const cacheKey = "resource:questions:universal";
      const cached = cache.get<string>(cacheKey);
      if (cached) return { contents: [{ uri: "hub://questions/universal", mimeType: "application/json", text: cached }] };

      const { data } = await supabase
        .from("archived_questions")
        .select("id, text, theme, significance_score, asked_by_count, avg_word_limit")
        .eq("is_universal", true)
        .order("significance_score", { ascending: false })
        .limit(50);

      const text = JSON.stringify({ count: data?.length ?? 0, questions: data ?? [] }, null, 2);
      cache.set(cacheKey, text, 3_600_000); // 1 hour
      return { contents: [{ uri: "hub://questions/universal", mimeType: "application/json", text }] };
    }
  );

  // ── Question theme distribution ───────────────────────────────────────────
  server.registerResource(
    "Question Themes",
    "hub://questions/themes",
    {
      description: "Question counts by theme across the entire archive.",
      mimeType: "application/json"
    },
    async (_uri) => {
      const { data } = await supabase
        .from("archived_questions")
        .select("theme")
        .not("theme", "is", null);

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const t = row.theme!;
        counts[t] = (counts[t] ?? 0) + 1;
      }

      const text = JSON.stringify({
        themes: Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([theme, count]) => ({ theme, count }))
      }, null, 2);

      return { contents: [{ uri: "hub://questions/themes", mimeType: "application/json", text }] };
    }
  );
}
