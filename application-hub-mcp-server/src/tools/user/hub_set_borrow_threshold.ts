import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  borrow_threshold: z.number().min(0.5).max(1)
    .describe("Minimum similarity (0.5–1.0) for borrowing answers across questions during fill. Lower = more aggressive borrowing. Typical: 0.6–0.75."),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
}).strict();

export function registerSetBorrowThreshold(server: McpServer) {
  server.registerTool("hub_set_borrow_threshold", {
    title: "Set Borrow Threshold Preference (authenticated)",
    description: `Saves your preferred borrow threshold for hub_fill_application.

The borrow threshold controls how similar a question must be to one you've already answered before its answer gets borrowed into a new application. Lower values (e.g. 0.6) borrow more aggressively — higher coverage but looser matches. Higher values (e.g. 0.8) only borrow near-identical questions — lower coverage but tighter matches.

Once set, every future hub_fill_application call uses your saved value automatically. You can still override per-call by passing borrow_threshold explicitly.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ user_token, borrow_threshold, response_format }) => {
    const user_id = await validateUserToken(user_token);

    // Read current applicant_context so we merge rather than overwrite
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("applicant_context")
      .eq("user_id", user_id)
      .maybeSingle();

    const existingCtx = (profile?.applicant_context as Record<string, unknown> | null) ?? {};
    const mergedCtx = { ...existingCtx, borrow_threshold };

    const { error } = await supabase
      .from("user_profiles")
      .update({ applicant_context: mergedCtx, updated_at: new Date().toISOString() })
      .eq("user_id", user_id);

    if (error) {
      return { content: [{ type: "text", text: `Failed to save: ${error.message}` }] };
    }

    const output = {
      user_id,
      borrow_threshold,
      saved: true,
      note: "hub_fill_application will use this value automatically. Override per-call by passing borrow_threshold explicitly.",
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output,
      };
    }

    const lines = [
      `# Borrow Threshold Saved`,
      `**Threshold**: ${borrow_threshold}`,
      ``,
      `Every future \`hub_fill_application\` call will use ${borrow_threshold} automatically.`,
      `Lower = more aggressive borrowing (higher coverage, looser matches).`,
      `Higher = stricter matching (lower coverage, tighter matches).`,
      ``,
      `Override per-call by passing \`borrow_threshold\` explicitly.`,
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output,
    };
  });
}
