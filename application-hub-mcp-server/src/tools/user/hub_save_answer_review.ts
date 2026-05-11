import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";
import { validateUserToken } from "../../services/auth.js";
import { userClient } from "../../services/supabase.js";

const ReviewCommentSchema = z.object({
  type: z.enum(["signal", "fidelity", "commitment", "specificity", "fit", "risk"]),
  severity: z.enum(["info", "warning", "blocker"]),
  message: z.string().trim().min(1).max(2_000),
  suggested_revision: z.string().trim().min(1).max(10_000).optional()
}).strict();

const ReviewScoresSchema = z.object({
  signal_purity: z.number().min(0).max(1),
  answer_fidelity: z.number().min(0).max(1),
  commitment_stability: z.number().min(0).max(1),
  program_fit_alignment: z.number().min(0).max(1),
  specificity: z.number().min(0).max(1)
}).strict();

const CertificationSchema = z.object({
  eligible: z.boolean(),
  label: z.string().trim().min(1).max(200).nullable(),
  rationale: z.string().trim().min(1).max(4_000)
}).strict();

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  answer_id: z.string().uuid().describe("Saved answer UUID (`profile_answers.id`) being reviewed"),
  program_id: z.string().uuid().optional().describe("Optional program UUID to scope the review against"),
  reviewer_name: z.string().trim().min(1).max(200).default("rns_answer_reviewer"),
  reviewer_type: z.enum(["agent", "human", "hybrid"]).default("agent"),
  reviewer_version: z.string().trim().min(1).max(100).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  model_used: z.string().trim().min(1).max(200).optional(),
  overall_status: z.enum(["draft", "usable", "strong", "certify"]),
  summary: z.string().trim().min(1).max(4_000),
  comments: z.array(ReviewCommentSchema).max(25).default([]),
  scores: ReviewScoresSchema,
  certification: CertificationSchema.optional(),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerSaveAnswerReview(server: McpServer) {
  server.registerTool("hub_save_answer_review", {
    title: "Save Answer Review (authenticated)",
    description: `Persists structured review output for one saved answer.

Use this after agent-side review has already read context through hub_get_answer_review_context.
Writes append-only rows to answer_reviews using the authenticated user's JWT, keeping hosted
drafting separate from review comments, scores, and certification metadata.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({
    user_token,
    answer_id,
    program_id,
    reviewer_name,
    reviewer_type,
    reviewer_version,
    provider,
    model_used,
    overall_status,
    summary,
    comments,
    scores,
    certification,
    response_format
  }) => {
    const user_id = await validateUserToken(user_token);
    const client = userClient(user_token);

    const { data: answer, error: answerError } = await client
      .from("profile_answers")
      .select("id, user_id, archived_question_id, question_text, theme, answer_content, confidence, word_count, version, updated_at")
      .eq("id", answer_id)
      .eq("user_id", user_id)
      .single();

    if (answerError || !answer) {
      return { content: [{ type: "text", text: "Saved answer not found or not readable." }] };
    }

    let program: { id: string; name: string | null; slug: string | null } | null = null;

    if (program_id) {
      const { data: programRow, error: programError } = await client
        .from("programs")
        .select("id, name, slug")
        .eq("id", program_id)
        .single();

      if (programError || !programRow) {
        return { content: [{ type: "text", text: "Program not found or not readable." }] };
      }

      program = programRow;
    }

    const reviewInsert = {
      user_id,
      profile_answer_id: answer.id,
      program_id: program?.id ?? null,
      archived_question_id: answer.archived_question_id,
      reviewer_name,
      reviewer_type,
      reviewer_version: reviewer_version ?? null,
      provider: provider ?? null,
      model_used: model_used ?? null,
      overall_status,
      summary,
      comments,
      scores,
      certification: certification ?? null,
      source_tool: "hub_save_answer_review"
    };

    const { data: review, error: reviewError } = await client
      .from("answer_reviews")
      .insert(reviewInsert)
      .select(`
        id,
        profile_answer_id,
        program_id,
        archived_question_id,
        reviewer_name,
        reviewer_type,
        reviewer_version,
        provider,
        model_used,
        overall_status,
        summary,
        comments,
        scores,
        certification,
        source_tool,
        created_at
      `)
      .single();

    if (reviewError || !review) {
      return { content: [{ type: "text", text: `Error saving answer review: ${reviewError?.message ?? "unknown error"}` }] };
    }

    const output = {
      review,
      answer,
      program
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines = [
      "# Answer Review Saved",
      `**Answer**: ${answer.question_text}`,
      `**Theme**: ${answer.theme ?? "unknown"}`,
      `**Status**: ${review.overall_status}`,
      `**Reviewer**: ${review.reviewer_name} (${review.reviewer_type})`,
      program ? `**Program**: ${program.name ?? program.slug ?? program.id}` : "**Program**: all matching usage",
      `**Comments**: ${Array.isArray(review.comments) ? review.comments.length : 0}`,
      "",
      summary
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
