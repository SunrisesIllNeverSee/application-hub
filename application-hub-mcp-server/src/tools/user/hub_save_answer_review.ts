import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";
import { validateUserToken } from "../../services/auth.js";
import { userClient } from "../../services/supabase.js";

const ANSWER_FIELDS =
  "id, user_id, archived_question_id, question_text, theme, answer_content, " +
  "confidence, word_count, version, updated_at";

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

async function validateAnswerOwnership(client: any, answer_id: string, user_id: string): Promise<any> {
  const { data, error } = await client
    .from("profile_answers")
    .select(ANSWER_FIELDS)
    .eq("id", answer_id)
    .eq("user_id", user_id)
    .single();
  if (error || !data) return null;
  return data;
}

async function fetchProgram(
  client: any,
  program_id: string
): Promise<{ id: string; name: string | null; slug: string | null } | null> {
  const { data, error } = await client
    .from("programs")
    .select("id, name, slug")
    .eq("id", program_id)
    .single();
  if (error || !data) return null;
  return data;
}

async function insertReview(client: any, payload: any): Promise<any> {
  const { data, error } = await client
    .from("answer_reviews")
    .insert(payload)
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
  if (error || !data) return { review: null, error };
  return { review: data, error: null };
}

function buildReviewInsert(user_id: string, answer: any, program: any, params: any): any {
  return {
    user_id,
    profile_answer_id: answer.id,
    program_id: program?.id ?? null,
    archived_question_id: answer.archived_question_id,
    reviewer_name: params.reviewer_name,
    reviewer_type: params.reviewer_type,
    reviewer_version: params.reviewer_version ?? null,
    provider: params.provider ?? null,
    model_used: params.model_used ?? null,
    overall_status: params.overall_status,
    summary: params.summary,
    comments: params.comments,
    scores: params.scores,
    certification: params.certification ?? null,
    source_tool: "hub_save_answer_review"
  };
}

function formatMarkdown(review: any, answer: any, program: any, summary: string): string {
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
  return lines.join("\n").slice(0, CHARACTER_LIMIT);
}

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

    const answer = await validateAnswerOwnership(client, answer_id, user_id);
    if (!answer) {
      return { content: [{ type: "text", text: "Saved answer not found or not readable." }] };
    }

    let program: { id: string; name: string | null; slug: string | null } | null = null;
    if (program_id) {
      program = await fetchProgram(client, program_id);
      if (!program) {
        return { content: [{ type: "text", text: "Program not found or not readable." }] };
      }
    }

    const reviewInsert = buildReviewInsert(user_id, answer, program, {
      reviewer_name, reviewer_type, reviewer_version, provider, model_used,
      overall_status, summary, comments, scores, certification
    });

    const { review, error: reviewError } = await insertReview(client, reviewInsert);
    if (!review) {
      const errorMessage = `Error saving answer review: ${reviewError?.message ?? "unknown error"}`;
      return { content: [{ type: "text", text: errorMessage }] };
    }

    const output = { review, answer, program };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    return {
      content: [{ type: "text", text: formatMarkdown(review, answer, program, summary) }],
      structuredContent: output
    };
  });
}
