import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { embedAndStoreQuestion } from "../../services/embed.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

// The pound-out loop, step 1 (MCP surface): grab an application.
// Archives the source, indexes the program, indexes every question
// individually (embedded on create), and opens a user_applications row.
// Pair with hub_fill_application to fill it from the answer bank.

const SOURCE_KINDS = ["accelerator", "job", "school", "grant", "vc", "other"] as const;

const SOURCE_KIND_TO_PROGRAM_TYPE: Record<string, string> = {
  accelerator: "accel",
  grant: "grant",
  job: "job",
  school: "uni",
  vc: "vc",
  other: "other",
};

const SOURCE_KIND_TO_OPPORTUNITY_KIND: Record<string, string> = {
  accelerator: "accelerator",
  grant: "grant",
  job: "job_fulltime",
  school: "other",
  vc: "vc",
  other: "other",
};

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  program_name: z.string().trim().min(2).max(200).describe("Program or company name (e.g. 'Hannah Grey')"),
  program_url: z.string().url().optional().describe("Application URL, if known"),
  application_text: z.string().min(50).max(50_000).describe("Raw application form / question list text"),
  source_kind: z.enum(SOURCE_KINDS).default("accelerator"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
}).strict();

type ExtractedQuestion = { question_text: string; theme: string };

// Deterministic extraction — Q:/A: pairs, markdown headers, numbered Q?blocks.
function parseStructuredText(text: string): ExtractedQuestion[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const questions: ExtractedQuestion[] = [];

  const qaRegex = /(?:^|\n)\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)\n\s*(?:\*\*)?\s*(?:A|Answer)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)(?=\n\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = qaRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\s+/g, " ");
    if (q.length > 0 && m[2].trim().length >= 10) questions.push({ question_text: q, theme: "personal" });
  }
  if (questions.length > 0) return questions;

  const mdRegex = /(?:^|\n)#{1,3}\s+(.+?)\n+([\s\S]+?)(?=\n#{1,3}\s+|$)/g;
  while ((m = mdRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\s+/g, " ");
    if (q.length > 0 && m[2].trim().length >= 10) {
      questions.push({ question_text: q.endsWith("?") ? q : q, theme: "personal" });
    }
  }
  return questions;
}

// Optional AI extraction. Tries Anthropic first (if ANTHROPIC_API_KEY is set),
// then Groq (if GROQ_API_KEY is set — OpenAI-compatible API). Falls back to
// deterministic parser if neither key is configured or both fail.
async function extractWithAI(text: string, programName: string, sourceKind: string): Promise<ExtractedQuestion[]> {
  const prompt = `Source: ${sourceKind} — ${programName}

Extract every distinct question from this application form. Questions may be explicit ("1.", "Q:", "Tell us..."), section headings above blank fields, or essay prompts.

Return ONLY a JSON array of objects: {"question_text": string (max 300 chars, cleaned, no numbering), "theme": one of team, traction, problem, solution, market, vision, personal, fit, leadership, technical, other}.
Skip logistics fields (name, email, phone, address, website). Deduplicate. Empty array [] if none.

Application text:
"""
${text}
"""`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  // Try Anthropic first
  if (anthropicKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const raw = data.content?.[0]?.type === "text" ? data.content[0].text ?? "[]" : "[]";
        return parseAIQuestions(raw);
      }
    } catch { /* fall through to Groq */ }
  }

  // Try Groq (OpenAI-compatible chat completions)
  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          max_tokens: 4096,
          temperature: 0,
          messages: [
            { role: "system", content: "You extract questions from application forms. Return ONLY a JSON array, no markdown, no commentary." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = data.choices?.[0]?.message?.content ?? "[]";
        // Groq with json_object response format wraps in an object — try to extract array
        return parseAIQuestions(raw);
      }
    } catch { /* fall through to deterministic */ }
  }

  return [];
}

function parseAIQuestions(raw: string): ExtractedQuestion[] {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: unknown = JSON.parse(cleaned);
    // Groq json_object mode may wrap array in {questions: [...]} or similar
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["questions", "data", "results", "items"]) {
        if (Array.isArray(obj[key])) { parsed = obj[key]; break; }
      }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is ExtractedQuestion =>
        !!q && typeof q === "object" &&
        typeof (q as any).question_text === "string" && (q as any).question_text.length > 0
    ).map((q) => ({ question_text: (q as any).question_text.trim(), theme: typeof (q as any).theme === "string" ? (q as any).theme : "personal" }));
  } catch {
    return [];
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const DB_THEME_FALLBACK = new Map<string, string>([
  ["team", "team"], ["traction", "traction"], ["problem", "problem"], ["solution", "solution"],
  ["market", "market"], ["vision", "vision"], ["personal", "personal"], ["fit", "fit"],
  ["leadership", "team"], ["technical", "technical"], ["career_goals", "vision"],
  ["why_this_school", "fit"], ["ethics", "personal"], ["other", "personal"],
]);

async function findOrCreateArchivedQuestion(questionText: string, theme: string): Promise<{ id: string; wasNew: boolean } | null> {
  const trimmed = questionText.trim();
  const head = trimmed.slice(0, 60);

  if (head.length >= 8) {
    const { data } = await supabase
      .from("archived_questions")
      .select("id")
      .ilike("text", `%${head}%`)
      .limit(1);
    if (data && data.length > 0) return { id: data[0].id as string, wasNew: false };
  }

  const dbTheme = DB_THEME_FALLBACK.get(theme) ?? "personal";
  const insert = await supabase
    .from("archived_questions")
    .insert({ text: trimmed, theme: dbTheme })
    .select("id")
    .single();

  let createdId: string | null = null;
  if (!insert.error && insert.data) {
    createdId = insert.data.id as string;
  } else {
    const fallback = await supabase
      .from("archived_questions")
      .insert({ text: trimmed, theme: dbTheme })
      .select("id")
      .single();
    if (!fallback.error && fallback.data) createdId = fallback.data.id as string;
  }
  if (!createdId) return null;

  await embedAndStoreQuestion(createdId, trimmed);
  return { id: createdId, wasNew: true };
}

export function registerIntakeApplication(server: McpServer) {
  server.registerTool("hub_intake_application", {
    title: "Intake Application (authenticated)",
    description: `Grab an application in one call: archives the raw source, finds-or-creates the program, indexes every question individually (exact wording preserved, embedded on create for matching), and opens the application for the user.

Then call hub_fill_application with the returned application_id to fill it from the answer bank.

Question extraction: AI when ANTHROPIC_API_KEY or GROQ_API_KEY is set in the server env (Anthropic tried first, then Groq/Llama), otherwise a deterministic Q:/A: / markdown-header parser (format text accordingly when no AI key is available).`,
    inputSchema: Schema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ user_token, program_name, program_url, application_text, source_kind, response_format }) => {
    const user_id = await validateUserToken(user_token);

    // 1. Extract questions
    let questions = await extractWithAI(application_text, program_name, source_kind);
    const extraction = questions.length > 0 ? "ai" : "regex";
    if (questions.length === 0) questions = parseStructuredText(application_text);

    // 2. Archive the source
    await supabase.from("app_import_sessions").insert({
      user_id,
      source_kind,
      program_name: program_name.trim(),
      raw_text: application_text,
      extracted_count: questions.length,
      status: questions.length > 0 ? "complete" : "failed",
      error_text: questions.length > 0 ? null : "no extractable questions",
    });

    if (questions.length === 0) {
      const msg = "No questions extracted. Without ANTHROPIC_API_KEY, format the text as 'Q: ... / A: ...' pairs or markdown '## Question' sections.";
      return { content: [{ type: "text", text: msg }] };
    }

    // 3. Index the program
    const slug = slugify(program_name);
    const { data: existingProgram } = await supabase
      .from("programs").select("id, slug").eq("slug", slug).maybeSingle();

    let programId: string;
    let programWasNew = false;
    if (existingProgram) {
      programId = existingProgram.id as string;
    } else {
      const { data: created, error: programError } = await supabase
        .from("programs")
        .insert({
          name: program_name.trim(),
          organization: program_name.trim(),
          slug,
          type: SOURCE_KIND_TO_PROGRAM_TYPE[source_kind] ?? "other",
          kind: SOURCE_KIND_TO_OPPORTUNITY_KIND[source_kind] ?? "other",
          apply_url: program_url ?? null,
        })
        .select("id")
        .single();
      if (programError || !created) {
        return { content: [{ type: "text", text: `Failed to create program: ${programError?.message ?? "unknown"}` }] };
      }
      programId = created.id as string;
      programWasNew = true;
    }

    // 4. Index questions individually + link occurrences + unlock
    let newQuestions = 0;
    let reusedQuestions = 0;
    let linked = 0;
    const failures: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const archived = await findOrCreateArchivedQuestion(q.question_text, q.theme);
      if (!archived) {
        failures.push(q.question_text.slice(0, 80));
        continue;
      }
      if (archived.wasNew) newQuestions++;
      else reusedQuestions++;

      const { data: existingLink } = await supabase
        .from("program_questions")
        .select("id")
        .eq("program_id", programId)
        .eq("archived_question_id", archived.id)
        .maybeSingle();

      if (!existingLink) {
        const { error: linkError } = await supabase.from("program_questions").insert({
          program_id: programId,
          archived_question_id: archived.id,
          asked_as: q.question_text,
          order_index: i,
          is_required: true,
        });
        if (linkError) failures.push(q.question_text.slice(0, 80));
        else linked++;
      }

      const { data: existingUnlock } = await supabase
        .from("user_question_unlocks")
        .select("id")
        .eq("user_id", user_id)
        .eq("archived_question_id", archived.id)
        .maybeSingle();
      if (!existingUnlock) {
        await supabase.from("user_question_unlocks").insert({
          user_id,
          archived_question_id: archived.id,
          source: "manual",
        });
      }
    }

    // 5. Open the application
    const { data: existingApp } = await supabase
      .from("user_applications")
      .select("id")
      .eq("user_id", user_id)
      .eq("program_id", programId)
      .maybeSingle();

    let applicationId = (existingApp?.id as string | undefined) ?? null;
    if (!applicationId) {
      const { data: appRow } = await supabase
        .from("user_applications")
        .insert({
          user_id,
          program_id: programId,
          status: "drafting",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      applicationId = (appRow?.id as string | undefined) ?? null;
    }

    const output = {
      program_id: programId,
      program_slug: slug,
      program_was_new: programWasNew,
      application_id: applicationId,
      question_count: questions.length,
      linked,
      new_questions: newQuestions,
      reused_questions: reusedQuestions,
      failures,
      extraction,
      workspace_url: `/workspace/${programId}`,
      next_step: applicationId ? `hub_fill_application with application_id=${applicationId}` : null,
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output,
      };
    }

    const lines = [
      "# Application Intaked",
      `**Program**: ${program_name} (${programWasNew ? "new" : "existing"})`,
      `**Questions**: ${questions.length} indexed — ${newQuestions} new to archive, ${reusedQuestions} matched existing`,
      `**Extraction**: ${extraction}`,
      failures.length > 0 ? `**Failures**: ${failures.length}` : null,
      "",
      `**Application ID**: \`${applicationId ?? "failed to create"}\``,
      `**Next**: call \`hub_fill_application\` with that application_id to fill from the bank, then review at ${output.workspace_url}`,
    ].filter((l): l is string => l !== null);

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output,
    };
  });
}
