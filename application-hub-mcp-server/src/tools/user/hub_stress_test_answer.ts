import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { userClient } from "../../services/supabase.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";
import followUpData from "../../data/stress_test_follow_ups.json" assert { type: "json" };

const STRESS_DEPTHS = ["light", "medium", "deep"] as const;

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  answer_id: z.string().uuid().describe("profile_answers.id for the saved answer to stress-test"),
  program_id: z.string().uuid().optional().describe("Optional program scope for program-specific DNA and phrasing"),
  stress_depth: z.enum(STRESS_DEPTHS).default("medium").describe("How many follow-ups to return: light=3, medium=4, deep=5"),
  persist_result: z.boolean().default(false).describe("When true, saves the generated stress-test plan to answer_stress_tests"),
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

type FollowUpTemplate = {
  focus: string;
  prompt: string;
  expected_evidence: string[];
  risk_if_unanswered: string;
};

const THEME_FOLLOW_UPS = followUpData.themeFollowUps as Record<string, FollowUpTemplate[]>;
const GENERAL_FOLLOW_UPS = followUpData.generalFollowUps as FollowUpTemplate[];

export function followUpCount(depth: typeof STRESS_DEPTHS[number]): number {
  if (depth === "light") return 3;
  if (depth === "deep") return 5;
  return 4;
}

export function compactSignals(answerContent: string) {
  const numeric_claims = Array.from(answerContent.matchAll(/\b(?:\$?\d[\d,]*(?:\.\d+)?%?|\d+x)\b/gi))
    .map((match) => match[0])
    .slice(0, 12);
  const likely_urls = Array.from(answerContent.matchAll(/https?:\/\/\S+/gi))
    .map((match) => match[0])
    .slice(0, 5);

  return {
    word_count_estimate: answerContent.trim().split(/\s+/).filter(Boolean).length,
    numeric_claims,
    likely_urls
  };
}

export function buildFollowUps(theme: string | null, topDnaThemes: string[], depth: typeof STRESS_DEPTHS[number]) {
  const preferredThemes = [theme, ...topDnaThemes].filter(Boolean) as string[];
  const templates: FollowUpTemplate[] = [];

  for (const preferredTheme of preferredThemes) {
    for (const item of THEME_FOLLOW_UPS[preferredTheme] ?? []) {
      if (!templates.some((existing) => existing.focus === item.focus)) {
        templates.push(item);
      }
    }
  }

  for (const item of GENERAL_FOLLOW_UPS) {
    if (!templates.some((existing) => existing.focus === item.focus)) {
      templates.push(item);
    }
  }

  return templates.slice(0, followUpCount(depth)).map((item, index) => ({
    id: `stress_follow_up_${index + 1}`,
    ...item,
    response_type: "free_text",
    founder_response: null
  }));
}

async function fetchAnswer(answer_id: string, user_id: string): Promise<any> {
  const { data: answer, error: answerError } = await supabase
    .from("profile_answers")
    .select("id, user_id, archived_question_id, question_text, theme, answer_content, content, confidence, word_count, version, updated_at, last_updated, created_at")
    .eq("id", answer_id)
    .eq("user_id", user_id)
    .single();

  if (answerError || !answer) {
    return null;
  }

  return answer;
}

async function fetchArchivedQuestion(archived_question_id: string): Promise<any> {
  const { data: archivedQuestion } = await supabase
    .from("archived_questions")
    .select("id, text, theme, subtheme, typical_word_limit, asked_by_count, importance_score, significance_score, is_universal, example_programs")
    .eq("id", archived_question_id)
    .single();

  return archivedQuestion ?? null;
}

async function fetchProgramScope(archived_question_id: string, program_id?: string): Promise<{ programQuestions: ProgramQuestionContext[]; programDna: ProgramDnaContext[] }> {
  let programQuestionQuery = supabase
    .from("program_questions")
    .select(`program_id, asked_as, word_limit, char_limit, section, order_index,
             programs(id, slug, name, type, status, program_value_score)`)
    .eq("archived_question_id", archived_question_id)
    .order("order_index", { ascending: true })
    .limit(25);

  if (program_id) {
    programQuestionQuery = programQuestionQuery.eq("program_id", program_id);
  }

  const { data: programQuestions } = await programQuestionQuery;
  const programIds = Array.from(new Set((programQuestions ?? []).map((pq) => pq.program_id).filter(Boolean)));

  const { data: programDna } = programIds.length > 0
    ? await supabase
      .from("program_dna")
      .select("program_id, theme, weight_pct, question_count")
      .in("program_id", programIds)
      .order("weight_pct", { ascending: false })
    : { data: [] };

  const normalizedProgramQuestions = (programQuestions ?? []).map((pq) => {
    const program = Array.isArray(pq.programs) ? pq.programs[0] : pq.programs;
    return { ...pq, programs: program ?? null };
  }) as ProgramQuestionContext[];

  const normalizedDna = (programDna ?? []) as ProgramDnaContext[];

  return { programQuestions: normalizedProgramQuestions, programDna: normalizedDna };
}

function buildOutput(
  answer: any,
  archivedQuestion: any,
  programScope: { programQuestions: ProgramQuestionContext[]; programDna: ProgramDnaContext[] },
  followUps: ReturnType<typeof buildFollowUps>,
  checklist: { id: string; label: string; status: string }[],
  detectedSignals: ReturnType<typeof compactSignals>,
  stress_depth: typeof STRESS_DEPTHS[number],
  persistedRun: { id: string; created_at: string } | null,
  persist_result: boolean,
  theme: string | null,
  program_id?: string
) {
  const answerContent = answer.answer_content || answer.content || "";
  return {
    answer_id: answer.id,
    stress_test_id: persistedRun?.id ?? null,
    mode: "stub_no_llm",
    stress_depth,
    persisted: Boolean(persistedRun),
    scoring_performed: false,
    answer: {
      id: answer.id,
      archived_question_id: answer.archived_question_id,
      question_text: answer.question_text,
      theme,
      answer_content: answerContent,
      confidence: answer.confidence,
      word_count: answer.word_count,
      version: answer.version,
      updated_at: answer.updated_at,
      last_updated: answer.last_updated,
      created_at: answer.created_at
    },
    archived_question: archivedQuestion ?? null,
    program_scope: {
      requested_program_id: program_id ?? null,
      matched_program_count: programScope.programQuestions.length,
      program_usage: programScope.programQuestions,
      program_dna: programScope.programDna
    },
    detected_signals: detectedSignals,
    follow_up_prompts: followUps,
    checklist,
    persistence: {
      requested: persist_result,
      saved: Boolean(persistedRun),
      table: "answer_stress_tests",
      persisted_at: persistedRun?.created_at ?? null
    }
  };
}

function formatMarkdown(
  output: ReturnType<typeof buildOutput>,
  followUps: ReturnType<typeof buildFollowUps>,
  archivedQuestion: any,
  stress_depth: typeof STRESS_DEPTHS[number],
  persist_result: boolean,
  program_id?: string
): string {
  const lines = [
    "# Answer Stress Test",
    `**Mode**: ${output.mode}`,
    `**Question**: ${output.answer.question_text || archivedQuestion?.text || "unknown"}`,
    `**Theme**: ${output.answer.theme ?? "unknown"}`,
    `**Depth**: ${stress_depth}`,
    `**Program scope**: ${program_id ?? "all programs asking this question"}`,
    `**Persisted**: ${output.persisted ? `yes (${output.stress_test_id})` : "no"}`,
    "",
    "## Follow-Up Prompts",
    ...followUps.map((item, index) => [
      `${index + 1}. **${item.focus}**: ${item.prompt}`,
      `   Evidence to ask for: ${item.expected_evidence.join(", ")}.`,
      `   Risk if unanswered: ${item.risk_if_unanswered}`
    ].join("\n")),
    "",
    "## Checklist",
    ...output.checklist.map((item) => `- [ ] ${item.label}`),
    "",
    "## Notes",
    "- This tool does not call an LLM or score confidence yet.",
    persist_result
      ? "- The generated plan was saved to answer_stress_tests."
      : "- Pass `persist_result=true` to save the generated plan to answer_stress_tests."
  ];

  return lines.join("\n");
}

export function registerStressTestAnswer(server: McpServer) {
  server.registerTool("hub_stress_test_answer", {
    title: "Stress Test Answer (authenticated)",
    description: `Returns a deterministic stress-test plan for a saved answer.

This gathers the same saved-answer context used by hub_get_answer_review_context, then returns 3-5 probing follow-up prompts, evidence expectations, and a checklist. It does not call an LLM or score confidence. When persist_result=true, it also saves the run to answer_stress_tests.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ user_token, answer_id, program_id, stress_depth, persist_result, response_format }) => {
    const user_id = await validateUserToken(user_token);
    const client = userClient(user_token);

    const answer = await fetchAnswer(answer_id, user_id);
    if (!answer) {
      return { content: [{ type: "text", text: "Answer not found or not readable for this user." }] };
    }

    const archivedQuestion = await fetchArchivedQuestion(answer.archived_question_id);
    const programScope = await fetchProgramScope(answer.archived_question_id, program_id);

    const answerContent = answer.answer_content || answer.content || "";
    const theme = answer.theme ?? archivedQuestion?.theme ?? null;
    const topDnaThemes = Array.from(new Set(programScope.programDna.slice(0, 5).map((dna: ProgramDnaContext) => dna.theme)));
    const followUps = buildFollowUps(theme, topDnaThemes, stress_depth);
    const checklist = [
      { id: "claim_specificity", label: "Every major claim names a number, customer, date, artifact, or observable outcome.", status: "not_checked" },
      { id: "evidence_trace", label: "The founder can point to evidence for the strongest claim without rewriting the story.", status: "not_checked" },
      { id: "program_fit", label: "The answer survives the top program-DNA theme instead of only answering the generic question.", status: "not_checked" },
      { id: "risk_disclosure", label: "The answer can name the weakest assumption and what would prove or disprove it.", status: "not_checked" },
      { id: "next_validation", label: "The founder has a concrete next validation step after the stress-test.", status: "not_checked" }
    ];
    const detectedSignals = compactSignals(answerContent);
    let persistedRun: { id: string; created_at: string } | null = null;

    if (persist_result) {
      const { data: insertedRun, error: insertError } = await client
        .from("answer_stress_tests")
        .insert({
          user_id,
          profile_answer_id: answer.id,
          program_id: program_id ?? null,
          archived_question_id: answer.archived_question_id,
          depth: stress_depth,
          mode: "stub_no_llm",
          detected_signals: detectedSignals,
          follow_up_prompts: followUps,
          checklist,
          risk_flags: [],
          persisted_from_tool: "hub_stress_test_answer"
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        return { content: [{ type: "text", text: `Error saving stress-test run: ${insertError.message}` }] };
      }

      persistedRun = insertedRun;
    }

    const output = buildOutput(answer, archivedQuestion, programScope, followUps, checklist, detectedSignals, stress_depth, persistedRun, persist_result, theme, program_id);

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    return {
      content: [{ type: "text", text: formatMarkdown(output, followUps, archivedQuestion, stress_depth, persist_result, program_id).slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
