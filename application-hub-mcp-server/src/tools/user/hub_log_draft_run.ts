import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { checkRateLimit } from "../../services/rate_limit.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT"),
  program_id: z.string().uuid().describe("Program the draft is for"),
  archived_question_id: z.string().uuid().describe("Question being drafted"),
  integration_type: z.enum(["claude", "openai", "custom_agent", "mcp"])
    .describe("Which integration generated the draft"),
  model_used: z.string().optional().describe("Model identifier (e.g. claude-sonnet-4-6)"),
  prompt_tokens: z.number().int().optional(),
  completion_tokens: z.number().int().optional()
}).strict();

export function registerLogDraftRun(server: McpServer) {
  server.registerTool("hub_log_draft_run", {
    title: "Log Draft Run (authenticated, write)",
    description: `Records that an AI assistant generated a draft answer. Enforces usage limits by subscription tier.

Call this after successfully generating a draft answer via any integration.
Returns how many drafts remain in the current billing period.

Returns: { success: true, drafts_remaining: number | "unlimited" }

Will throw if the user has exceeded their monthly draft limit.

Requires valid user_token.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ user_token, program_id, archived_question_id, integration_type,
              model_used, prompt_tokens, completion_tokens }) => {
    const user_id = await validateUserToken(user_token);
    await checkRateLimit(user_id);

    const month = new Date().toISOString().slice(0, 7);

    // ai_draft_runs has a database trigger that increments ai_usage.
    // Do not call increment_draft_count here, or the same draft is counted twice.
    const { error } = await supabase.from("ai_draft_runs").insert({
      user_id,
      program_id,
      archived_question_id,
      integration_type,
      model_used: model_used ?? null,
      prompt_tokens: prompt_tokens ?? null,
      completion_tokens: completion_tokens ?? null,
      output_content: "[logged externally]",
      word_count: 0
    }).select();

    if (error) {
      return { content: [{ type: "text", text: `Error logging draft: ${error.message}` }] };
    }

    // Get updated count
    const { data: usage } = await supabase
      .from("ai_usage")
      .select("draft_count")
      .eq("user_id", user_id)
      .eq("month_year", month)
      .single();

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("tier, monthly_draft_limit")
      .eq("user_id", user_id)
      .single();

    const limit = sub?.monthly_draft_limit;
    const drafts_remaining = limit ? Math.max(0, limit - (usage?.draft_count ?? 0)) : "unlimited";

    const output = { success: true, drafts_remaining };

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  });
}
