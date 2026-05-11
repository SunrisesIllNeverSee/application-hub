import { supabase } from "../../services/supabase.js";
import { CHARACTER_LIMIT } from "../../constants.js";
import {
  STRESS_DEPTHS,
  buildFollowUps,
  compactSignals
} from "./hub_stress_test_answer.logic.js";

export type ProgramQuestionContext = {
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

export type ProgramDnaContext = {
  program_id: string;
  theme: string;
  weight_pct: number;
  question_count: number;
};

const ANSWER_FIELDS =
  "id, user_id, archived_question_id, question_text, theme, answer_content, content, " +
  "confidence, word_count, version, updated_at, last_updated, created_at";
const ARCHIVED_QUESTION_FIELDS =
  "id, text, theme, subtheme, typical_word_limit, asked_by_count, importance_score, " +
  "significance_score, is_universal, example_programs";

export const READINESS_CHECKLIST = [
  {
    id: "claim_specificity",
    label: "Every major claim names a number, customer, date, artifact, or observable outcome.",
    status: "not_checked"
  },
  {
    id: "evidence_trace",
    label: "The founder can point to evidence for the strongest claim without rewriting the story.",
    status: "not_checked"
  },
  {
    id: "program_fit",
    label: "The answer survives the top program-DNA theme instead of only answering the generic question.",
    status: "not_checked"
  },
  {
    id: "risk_disclosure",
    label: "The answer can name the weakest assumption and what would prove or disprove it.",
    status: "not_checked"
  },
  {
    id: "next_validation",
    label: "The founder has a concrete next validation step after the stress-test.",
    status: "not_checked"
  }
];

export async function fetchAnswer(answer_id: string, user_id: string): Promise<any> {
  const { data, error } = await supabase
    .from("profile_answers")
    .select(ANSWER_FIELDS)
    .eq("id", answer_id)
    .eq("user_id", user_id)
    .single();
  if (error || !data) return null;
  return data;
}

export async function fetchArchivedQuestion(archived_question_id: string): Promise<any> {
  const { data } = await supabase
    .from("archived_questions")
    .select(ARCHIVED_QUESTION_FIELDS)
    .eq("id", archived_question_id)
    .single();
  return data ?? null;
}

function normalizeProgramQuestion(pq: any): ProgramQuestionContext {
  const program = Array.isArray(pq.programs) ? pq.programs[0] : pq.programs;
  return { ...pq, programs: program ?? null };
}

async function fetchProgramQuestions(archived_question_id: string, program_id?: string): Promise<any[]> {
  let query = supabase
    .from("program_questions")
    .select(`program_id, asked_as, word_limit, char_limit, section, order_index,
             programs(id, slug, name, type, status, program_value_score)`)
    .eq("archived_question_id", archived_question_id)
    .order("order_index", { ascending: true })
    .limit(25);
  if (program_id) query = query.eq("program_id", program_id);
  const { data } = await query;
  return data ?? [];
}

async function fetchProgramDna(programIds: string[]): Promise<ProgramDnaContext[]> {
  if (programIds.length === 0) return [];
  const { data } = await supabase
    .from("program_dna")
    .select("program_id, theme, weight_pct, question_count")
    .in("program_id", programIds)
    .order("weight_pct", { ascending: false });
  return (data ?? []) as ProgramDnaContext[];
}

export async function fetchProgramScope(
  archived_question_id: string,
  program_id?: string
): Promise<{ programQuestions: ProgramQuestionContext[]; programDna: ProgramDnaContext[] }> {
  const rawQuestions = await fetchProgramQuestions(archived_question_id, program_id);
  const programIds = Array.from(new Set(rawQuestions.map((pq) => pq.program_id).filter(Boolean)));
  const programQuestions = rawQuestions.map(normalizeProgramQuestion);
  const programDna = await fetchProgramDna(programIds);
  return { programQuestions, programDna };
}

export async function persistStressTestRun(
  client: any,
  user_id: string,
  answer: any,
  program_id: string | undefined,
  stress_depth: typeof STRESS_DEPTHS[number],
  detectedSignals: any,
  followUps: any,
  checklist: any
): Promise<{ run: { id: string; created_at: string } | null; error: string | null }> {
  const { data, error } = await client
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
  return { run: data, error: error?.message ?? null };
}

function answerSection(answer: any, theme: string | null, answerContent: string) {
  return {
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
  };
}

function persistenceSection(persistedRun: any, persist_result: boolean) {
  return {
    requested: persist_result,
    saved: Boolean(persistedRun),
    table: "answer_stress_tests",
    persisted_at: persistedRun?.created_at ?? null
  };
}

export function buildOutput(
  answer: any,
  archivedQuestion: any,
  programScope: { programQuestions: ProgramQuestionContext[]; programDna: ProgramDnaContext[] },
  followUps: ReturnType<typeof buildFollowUps>,
  checklist: any,
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
    answer: answerSection(answer, theme, answerContent),
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
    persistence: persistenceSection(persistedRun, persist_result)
  };
}

function formatHeader(output: any, archivedQuestion: any, stress_depth: string, program_id?: string): string[] {
  const persistedLabel = output.persisted ? `yes (${output.stress_test_id})` : "no";
  return [
    "# Answer Stress Test",
    `**Mode**: ${output.mode}`,
    `**Question**: ${output.answer.question_text || archivedQuestion?.text || "unknown"}`,
    `**Theme**: ${output.answer.theme ?? "unknown"}`,
    `**Depth**: ${stress_depth}`,
    `**Program scope**: ${program_id ?? "all programs asking this question"}`,
    `**Persisted**: ${persistedLabel}`,
    ""
  ];
}

function formatFollowUps(followUps: any[]): string[] {
  return [
    "## Follow-Up Prompts",
    ...followUps.map((item, index) => [
      `${index + 1}. **${item.focus}**: ${item.prompt}`,
      `   Evidence to ask for: ${item.expected_evidence.join(", ")}.`,
      `   Risk if unanswered: ${item.risk_if_unanswered}`
    ].join("\n")),
    ""
  ];
}

function formatNotes(persist_result: boolean): string[] {
  const persistedNote = persist_result
    ? "- The generated plan was saved to answer_stress_tests."
    : "- Pass `persist_result=true` to save the generated plan to answer_stress_tests.";
  return [
    "## Notes",
    "- This tool does not call an LLM or score confidence yet.",
    persistedNote
  ];
}

export function formatMarkdown(
  output: any,
  followUps: any[],
  archivedQuestion: any,
  stress_depth: string,
  persist_result: boolean,
  program_id?: string
): string {
  const lines = [
    ...formatHeader(output, archivedQuestion, stress_depth, program_id),
    ...formatFollowUps(followUps),
    "## Checklist",
    ...output.checklist.map((item: any) => `- [ ] ${item.label}`),
    "",
    ...formatNotes(persist_result)
  ];
  return lines.join("\n");
}

export function jsonResponse(output: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
    structuredContent: output
  };
}

export function markdownResponse(
  output: any,
  followUps: any,
  archivedQuestion: any,
  stress_depth: string,
  persist_result: boolean,
  program_id?: string
) {
  const text = formatMarkdown(
    output, followUps, archivedQuestion, stress_depth, persist_result, program_id
  ).slice(0, CHARACTER_LIMIT);
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: output
  };
}
