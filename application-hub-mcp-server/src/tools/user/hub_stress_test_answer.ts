import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { userClient } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { ResponseFormat } from "../../constants.js";
import {
  STRESS_DEPTHS,
  followUpCount,
  compactSignals,
  buildFollowUps
} from "./hub_stress_test_answer.logic.js";
import {
  ProgramDnaContext,
  READINESS_CHECKLIST,
  fetchAnswer,
  fetchArchivedQuestion,
  fetchProgramScope,
  persistStressTestRun,
  buildOutput,
  jsonResponse,
  markdownResponse
} from "./hub_stress_test_answer.helpers.js";

export { followUpCount, compactSignals, buildFollowUps };

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  answer_id: z.string().uuid().describe("profile_answers.id for the saved answer to stress-test"),
  program_id: z.string().uuid().optional().describe(
    "Optional program scope for program-specific DNA and phrasing"
  ),
  stress_depth: z.enum(STRESS_DEPTHS).default("medium").describe(
    "How many follow-ups to return: light=3, medium=4, deep=5"
  ),
  persist_result: z.boolean().default(false).describe(
    "When true, saves the generated stress-test plan to answer_stress_tests"
  ),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

const TOOL_DESCRIPTION =
  "Returns a deterministic stress-test plan for a saved answer.\n\n" +
  "This gathers the same saved-answer context used by hub_get_answer_review_context, " +
  "then returns 3-5 probing follow-up prompts, evidence expectations, and a checklist. " +
  "It does not call an LLM or score confidence. When persist_result=true, it also " +
  "saves the run to answer_stress_tests.";

function deriveTopDnaThemes(programDna: ProgramDnaContext[]): string[] {
  const top = programDna.slice(0, 5).map((dna) => dna.theme);
  return Array.from(new Set(top));
}

async function handlePersist(
  user_token: string,
  user_id: string,
  answer: any,
  program_id: string | undefined,
  stress_depth: typeof STRESS_DEPTHS[number],
  detectedSignals: any,
  followUps: any
) {
  return persistStressTestRun(
    userClient(user_token),
    user_id,
    answer,
    program_id,
    stress_depth,
    detectedSignals,
    followUps,
    READINESS_CHECKLIST
  );
}

export function registerStressTestAnswer(server: McpServer) {
  server.registerTool("hub_stress_test_answer", {
    title: "Stress Test Answer (authenticated)",
    description: TOOL_DESCRIPTION,
    inputSchema: Schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  }, async ({ user_token, answer_id, program_id, stress_depth, persist_result, response_format }) => {
    const user_id = await validateUserToken(user_token);
    const answer = await fetchAnswer(answer_id, user_id);
    if (!answer) {
      return { content: [{ type: "text", text: "Answer not found or not readable for this user." }] };
    }

    const archivedQuestion = await fetchArchivedQuestion(answer.archived_question_id);
    const programScope = await fetchProgramScope(answer.archived_question_id, program_id);

    const answerContent = answer.answer_content || answer.content || "";
    const theme = answer.theme ?? archivedQuestion?.theme ?? null;
    const topDnaThemes = deriveTopDnaThemes(programScope.programDna);
    const followUps = buildFollowUps(theme, topDnaThemes, stress_depth);
    const detectedSignals = compactSignals(answerContent);

    let persistedRun: { id: string; created_at: string } | null = null;
    if (persist_result) {
      const result = await handlePersist(
        user_token, user_id, answer, program_id, stress_depth, detectedSignals, followUps
      );
      if (result.error) {
        return { content: [{ type: "text", text: `Error saving stress-test run: ${result.error}` }] };
      }
      persistedRun = result.run;
    }

    const output = buildOutput(
      answer, archivedQuestion, programScope, followUps, READINESS_CHECKLIST,
      detectedSignals, stress_depth, persistedRun, persist_result, theme, program_id
    );

    return response_format === ResponseFormat.JSON
      ? jsonResponse(output)
      : markdownResponse(output, followUps, archivedQuestion, stress_depth, persist_result, program_id);
  });
}
