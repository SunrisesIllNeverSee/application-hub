import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { embedText } from "../../services/embed.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

// The pound-out loop, step 2 (MCP surface): fill an application from the
// answer bank. Direct answers where they exist; vector-borrowed drafts for
// near-identical questions; gaps reported. Deterministic — no generated
// text enters the bank.

const DEFAULT_BORROW_THRESHOLD = 0.8;

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  application_id: z.string().uuid().describe("user_applications UUID (from hub_intake_application)"),
  borrow_threshold: z.number().min(0.5).max(1).default(DEFAULT_BORROW_THRESHOLD)
    .describe("Minimum similarity to borrow an answer from a sibling question"),
  dry_run: z.boolean().default(false).describe("Report the fill plan without writing anything"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
}).strict();

type AnswerRow = {
  id: string;
  archived_question_id: string;
  answer_content: string | null;
  content: string | null;
  version: number | null;
};

export function registerFillApplication(server: McpServer) {
  server.registerTool("hub_fill_application", {
    title: "Fill Application from Answer Bank (authenticated)",
    description: `Fills an application's questions from the user's answer bank.

Per question, in order:
1. DIRECT — a profile_answer exists for this exact question → already in the workspace.
2. BORROW — vector-match the question's exact wording against the archive; if a near-identical question (>= borrow_threshold) has one of the user's answers, copy it in as a NEW draft version on this question. Never overwrites.
3. GAP — nothing in the bank → left empty, reported for work-through.

Deterministic: no AI-generated text is written. Review happens in the workspace (/workspace/[program_id]).`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ user_token, application_id, borrow_threshold, dry_run, response_format }) => {
    const user_id = await validateUserToken(user_token);

    // 1. Application (must be the caller's)
    const { data: application } = await supabase
      .from("user_applications")
      .select("id, program_id, user_id, status")
      .eq("id", application_id)
      .maybeSingle();

    if (!application || application.user_id !== user_id) {
      return { content: [{ type: "text", text: "Application not found (or not yours)." }] };
    }

    // 2. Questions in order
    const { data: questionRows } = await supabase
      .from("program_questions")
      .select("id, archived_question_id, asked_as, order_index, word_limit")
      .eq("program_id", application.program_id)
      .order("order_index", { ascending: true });

    const questions = (questionRows ?? []) as Array<{
      id: string; archived_question_id: string; asked_as: string; order_index: number; word_limit: number | null;
    }>;

    if (questions.length === 0) {
      return { content: [{ type: "text", text: "No questions indexed for this program — run hub_intake_application first." }] };
    }

    // 3. Direct hits
    const archivedIds = questions.map((q) => q.archived_question_id);
    const { data: directAnswers } = await supabase
      .from("profile_answers")
      .select("id, archived_question_id, answer_content, content, version")
      .eq("user_id", user_id)
      .in("archived_question_id", archivedIds)
      .order("version", { ascending: false });

    const latestByQuestion = new Map<string, AnswerRow>();
    for (const a of (directAnswers ?? []) as AnswerRow[]) {
      if (!latestByQuestion.has(a.archived_question_id)) latestByQuestion.set(a.archived_question_id, a);
    }

    // 4. Borrow pass for misses
    const misses = questions.filter((q) => !latestByQuestion.has(q.archived_question_id));
    const borrowPlan: Array<{
      archived_question_id: string;
      asked_as: string;
      source_question_text: string;
      similarity: number;
      source_answer: string;
      word_limit: number | null;
    }> = [];
    const gaps: string[] = [];
    let embedAvailable = true;

    for (const q of misses) {
      let borrowed = false;
      if (embedAvailable) {
        const embedding = await embedText(q.asked_as);
        if (!embedding) {
          embedAvailable = false;
        } else {
          const { data: matches } = await supabase.rpc("match_archived_questions", {
            query_embedding: JSON.stringify(embedding),
            match_threshold: borrow_threshold,
            match_count: 6,
          });

          const candidates = ((matches ?? []) as Array<{ id: string; text: string; similarity: number }>)
            .filter((m) => m.id !== q.archived_question_id);

          if (candidates.length > 0) {
            const { data: sourceAnswers } = await supabase
              .from("profile_answers")
              .select("archived_question_id, answer_content, content, version")
              .eq("user_id", user_id)
              .in("archived_question_id", candidates.map((c) => c.id))
              .order("version", { ascending: false });

            const sourceByQuestion = new Map<string, string>();
            for (const sa of (sourceAnswers ?? []) as Array<Record<string, any>>) {
              if (!sourceByQuestion.has(sa.archived_question_id)) {
                sourceByQuestion.set(sa.archived_question_id, sa.answer_content ?? sa.content ?? "");
              }
            }

            for (const candidate of candidates) {
              const source = sourceByQuestion.get(candidate.id);
              if (source && source.trim().length >= 10) {
                borrowPlan.push({
                  archived_question_id: q.archived_question_id,
                  asked_as: q.asked_as,
                  source_question_text: candidate.text,
                  similarity: candidate.similarity,
                  source_answer: source,
                  word_limit: q.word_limit,
                });
                borrowed = true;
                break;
              }
            }
          }
        }
      }
      if (!borrowed) gaps.push(q.asked_as);
    }

    // 5. Write borrowed drafts (unless dry run)
    // Upsert: profile_answers has UNIQUE(user_id, archived_question_id) —
    // one row per user+question. UPDATE in place; the
    // profile_answer_history_snapshot trigger archives each new version.
    let written = 0;
    if (!dry_run) {
      for (const plan of borrowPlan) {
        const { data: existing } = await supabase
          .from("profile_answers")
          .select("id, version, answer_content, content")
          .eq("user_id", user_id)
          .eq("archived_question_id", plan.archived_question_id)
          .order("version", { ascending: false })
          .limit(1);

        const nextVersion = existing && existing.length > 0 ? ((existing[0].version as number) ?? 1) + 1 : 1;

        if (existing && existing.length > 0) {
          const latestContent = (existing[0].answer_content as string) ?? (existing[0].content as string) ?? "";
          if (latestContent.trim() === plan.source_answer.trim()) continue;
        }

        const trimmed = plan.source_answer.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        const payload = {
          content: trimmed,
          answer_content: trimmed,
          question_text: plan.asked_as,
          word_count: wordCount,
          version: nextVersion,
          confidence: "draft" as const,
        };

        let error;
        if (existing && existing.length > 0) {
          ({ error } = await supabase
            .from("profile_answers")
            .update(payload)
            .eq("id", existing[0].id as string));
        } else {
          ({ error } = await supabase.from("profile_answers").insert({
            user_id,
            archived_question_id: plan.archived_question_id,
            ...payload,
          }));
        }
        if (!error) written++;
      }
    }

    const direct = questions.length - misses.length;
    const filled = direct + (dry_run ? borrowPlan.length : written);
    const coveragePct = Math.round((filled / questions.length) * 100);

    const output = {
      application_id,
      program_id: application.program_id,
      total: questions.length,
      direct,
      borrowed: borrowPlan.map((b) => ({
        asked_as: b.asked_as,
        source_question: b.source_question_text,
        similarity: Math.round(b.similarity * 1000) / 1000,
      })),
      borrowed_written: dry_run ? 0 : written,
      gaps,
      coverage_pct: coveragePct,
      dry_run,
      embedding_available: embedAvailable,
      workspace_url: `/workspace/${application.program_id}`,
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output,
      };
    }

    const lines = [
      `# Fill ${dry_run ? "Plan (dry run)" : "Complete"}`,
      `**Coverage**: ${coveragePct}% — ${direct} direct, ${dry_run ? borrowPlan.length : written} borrowed, ${gaps.length} gaps`,
      "",
      borrowPlan.length > 0 ? "## Borrowed" : null,
      ...borrowPlan.map((b) => `- **${b.asked_as.slice(0, 80)}** ← _${b.source_question_text.slice(0, 60)}_ (${Math.round(b.similarity * 100)}%)`),
      gaps.length > 0 ? "## Gaps (work through these)" : null,
      ...gaps.map((g) => `- ${g.slice(0, 100)}`),
      "",
      `Review at ${output.workspace_url}`,
      embedAvailable ? null : "Note: embedding unavailable (is Ollama running?) — borrow pass skipped; direct hits only.",
    ].filter((l): l is string => l !== null);

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output,
    };
  });
}
