import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  answer_id: z.string().uuid().describe("profile_answers.id for the saved answer to review"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

type ProgramQuestionContext = {
  program_id: string;
  asked_as: string;
  word_limit: number | null;
  char_limit: number | null;
  section: string | null;
  order_index: number;
  programs: {
    id: string;
    slug: string;
    name: string;
    type: string;
    status: string;
    program_value_score: number | null;
  } | null;
};

type ProgramDnaContext = {
  program_id: string;
  theme: string;
  weight_pct: number;
  question_count: number;
};

export function registerGetAnswerReviewContext(server: McpServer) {
  server.registerTool("hub_get_answer_review_context", {
    title: "Get Answer Review Context (authenticated)",
    description: `Returns the saved-answer context needed for agent-side RNS/CIVITAE/MO§ES review.

This is a read-only bridge between the launch app and deeper review workflows. It does not grade the answer itself; it gathers the answer, canonical question, program usage, program DNA, and recent answer history so external agents can produce comments, scores, or certification metadata.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, answer_id, response_format }) => {
    const user_id = await validateUserToken(user_token);

    const { data: answer, error: answerError } = await supabase
      .from("profile_answers")
      .select("id, user_id, archived_question_id, question_text, theme, answer_content, content, confidence, word_count, version, updated_at, last_updated, created_at")
      .eq("id", answer_id)
      .eq("user_id", user_id)
      .single();

    if (answerError || !answer) {
      return { content: [{ type: "text", text: "Answer not found or not readable for this user." }] };
    }

    const { data: archivedQuestion } = await supabase
      .from("archived_questions")
      .select("id, text, theme, subtheme, typical_word_limit, asked_by_count, importance_score, significance_score, is_universal, example_programs")
      .eq("id", answer.archived_question_id)
      .single();

    const { data: programQuestions } = await supabase
      .from("program_questions")
      .select(`program_id, asked_as, word_limit, char_limit, section, order_index,
               programs(id, slug, name, type, status, program_value_score)`)
      .eq("archived_question_id", answer.archived_question_id)
      .order("order_index", { ascending: true })
      .limit(25);

    const programIds = Array.from(new Set((programQuestions ?? []).map((pq) => pq.program_id).filter(Boolean)));

    const { data: programDna } = programIds.length > 0
      ? await supabase
        .from("program_dna")
        .select("program_id, theme, weight_pct, question_count")
        .in("program_id", programIds)
        .order("weight_pct", { ascending: false })
      : { data: [] };

    const { data: answerHistory } = await supabase
      .from("profile_answer_history")
      .select("id, version, content, word_count, saved_at")
      .eq("profile_answer_id", answer_id)
      .order("version", { ascending: false })
      .limit(5);

    const normalizedProgramQuestions = (programQuestions ?? []).map((pq) => {
      const program = Array.isArray(pq.programs) ? pq.programs[0] : pq.programs;
      return { ...pq, programs: program ?? null };
    }) as ProgramQuestionContext[];

    const output = {
      answer: {
        id: answer.id,
        archived_question_id: answer.archived_question_id,
        question_text: answer.question_text,
        theme: answer.theme,
        answer_content: answer.answer_content || answer.content,
        confidence: answer.confidence,
        word_count: answer.word_count,
        version: answer.version,
        updated_at: answer.updated_at,
        last_updated: answer.last_updated,
        created_at: answer.created_at
      },
      archived_question: archivedQuestion ?? null,
      program_usage: normalizedProgramQuestions,
      program_dna: (programDna ?? []) as ProgramDnaContext[],
      answer_history: answerHistory ?? [],
      review_contract: {
        expected_output: "See docs/07_agent_review_contract.md",
        comment_types: ["signal", "fidelity", "commitment", "specificity", "fit", "risk"],
        severity_levels: ["info", "warning", "blocker"],
        score_fields: ["signal_purity", "answer_fidelity", "commitment_stability", "program_fit_alignment", "specificity"],
        certification_fields: ["eligible", "label", "rationale"]
      }
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines = [
      "# Answer Review Context",
      `**Question**: ${output.answer.question_text || archivedQuestion?.text || "unknown"}`,
      `**Theme**: ${output.answer.theme ?? archivedQuestion?.theme ?? "unknown"}`,
      `**Confidence**: ${output.answer.confidence}`,
      `**Words**: ${output.answer.word_count ?? "unknown"}`,
      `**Asked by**: ${archivedQuestion?.asked_by_count ?? normalizedProgramQuestions.length} programs`,
      "",
      "## Saved Answer",
      output.answer.answer_content,
      "",
      "## Review Contract",
      "- Return comments for signal, fidelity, commitment, specificity, fit, and risk.",
      "- Return scores for signal_purity, answer_fidelity, commitment_stability, program_fit_alignment, and specificity.",
      "- Keep review/certification outside POST /api/draft until the workflow is proven.",
      "",
      "## Program Usage",
      ...normalizedProgramQuestions.slice(0, 10).map((pq) =>
        `- ${pq.programs?.name ?? pq.program_id}: ${pq.word_limit ?? "?"} words, section ${pq.section ?? "unknown"}`
      )
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
