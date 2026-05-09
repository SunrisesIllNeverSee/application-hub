import { supabase } from "./supabase.js";

// -1 = unlimited
const TIER_LIMITS: Record<string, number> = {
  free: 100,
  pro: -1,
  team: -1
};

/**
 * Checks whether a user has exceeded their daily MCP call limit.
 * Uses the existing ai_usage table.
 * Throws if limit exceeded.
 */
export async function checkRateLimit(user_id: string): Promise<void> {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("tier")
    .eq("user_id", user_id)
    .single();

  const tier = sub?.tier ?? "free";
  const limit = TIER_LIMITS[tier] ?? 100;
  if (limit === -1) return;

  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("draft_count")
    .eq("user_id", user_id)
    .eq("month_year", month)
    .single();

  if ((usage?.draft_count ?? 0) >= limit) {
    throw new Error(
      `Daily MCP call limit (${limit}) reached for ${tier} tier. Upgrade to Pro for unlimited access.`
    );
  }
}
