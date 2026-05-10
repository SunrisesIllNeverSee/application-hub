import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { validateUserToken } from "../../services/auth.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../../constants.js";

const STRESS_DEPTHS = ["light", "medium", "deep"] as const;

const Schema = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  answer_id: z.string().uuid().describe("profile_answers.id for the saved answer to stress-test"),
  program_id: z.string().uuid().optional().describe("Optional program scope for program-specific DNA and phrasing"),
  stress_depth: z.enum(STRESS_DEPTHS).default("medium").describe("How many follow-ups to return: light=3, medium=4, deep=5"),
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

const THEME_FOLLOW_UPS: Record<string, FollowUpTemplate[]> = {
  traction: [
    {
      focus: "metric provenance",
      prompt: "Where did the traction number in this answer come from, and what source would verify it?",
      expected_evidence: ["analytics export", "Stripe or bank record", "CRM or customer list"],
      risk_if_unanswered: "The answer may read as polished but unverifiable."
    },
    {
      focus: "customer quality",
      prompt: "How many distinct customers or users produced this traction, and how concentrated is it?",
      expected_evidence: ["customer count", "top customer concentration", "repeat usage or renewal data"],
      risk_if_unanswered: "A strong topline number may hide fragile demand."
    },
    {
      focus: "trend durability",
      prompt: "What changed over the last 30 to 90 days, and what explains the change?",
      expected_evidence: ["growth chart", "cohort trend", "specific launch or sales activity"],
      risk_if_unanswered: "The claim may be a snapshot rather than a durable signal."
    }
  ],
  market: [
    {
      focus: "buyer specificity",
      prompt: "Who is the exact buyer or user, and what painful event makes them seek this now?",
      expected_evidence: ["ICP definition", "buyer interview", "use-case frequency"],
      risk_if_unanswered: "The market may be described too broadly to prove urgency."
    },
    {
      focus: "market entry",
      prompt: "Which narrow wedge lets this company win before it has broad market power?",
      expected_evidence: ["beachhead segment", "distribution channel", "early adopter proof"],
      risk_if_unanswered: "The answer may rely on a big-market claim without a credible entry point."
    }
  ],
  problem: [
    {
      focus: "pain evidence",
      prompt: "What direct evidence shows this problem is urgent enough for someone to change behavior?",
      expected_evidence: ["customer quotes", "failed workaround", "time or money lost"],
      risk_if_unanswered: "The problem may sound plausible but not painful."
    },
    {
      focus: "current alternative",
      prompt: "What do people do today instead, and why is that alternative breaking down?",
      expected_evidence: ["manual workflow", "incumbent tool", "measured inefficiency"],
      risk_if_unanswered: "The answer may not prove why now is the moment to switch."
    }
  ],
  solution: [
    {
      focus: "mechanism",
      prompt: "What is the core mechanism that makes the solution work better than the current alternative?",
      expected_evidence: ["workflow comparison", "technical insight", "before/after result"],
      risk_if_unanswered: "The solution may read as a feature list instead of a defensible approach."
    },
    {
      focus: "adoption friction",
      prompt: "What must a user change to adopt this, and how are you reducing that friction?",
      expected_evidence: ["onboarding steps", "integration plan", "time-to-value metric"],
      risk_if_unanswered: "The answer may underestimate implementation risk."
    }
  ],
  team: [
    {
      focus: "founder-market fit",
      prompt: "What lived experience, technical edge, or network gives this team unusual access to the problem?",
      expected_evidence: ["past work", "domain relationship", "earned insight"],
      risk_if_unanswered: "The team claim may sound generic against stronger founder-market-fit narratives."
    },
    {
      focus: "execution proof",
      prompt: "What has this team already shipped, sold, or learned together?",
      expected_evidence: ["launched product", "customer result", "operating milestone"],
      risk_if_unanswered: "The answer may assert capability without showing execution."
    }
  ],
  financials: [
    {
      focus: "unit economics",
      prompt: "What does one healthy customer or transaction look like in revenue, cost, margin, and payback?",
      expected_evidence: ["gross margin", "CAC or acquisition path", "payback estimate"],
      risk_if_unanswered: "Financial claims may not show whether growth is economically healthy."
    },
    {
      focus: "assumption quality",
      prompt: "Which financial assumption would most change the story if it were wrong?",
      expected_evidence: ["sensitivity model", "cost driver", "conversion assumption"],
      risk_if_unanswered: "The answer may depend on an untested projection."
    }
  ],
  impact: [
    {
      focus: "beneficiary proof",
      prompt: "Who benefits, how much do they benefit, and how do you know?",
      expected_evidence: ["outcome metric", "beneficiary interview", "baseline comparison"],
      risk_if_unanswered: "The impact claim may be morally compelling but hard to validate."
    },
    {
      focus: "measurement",
      prompt: "What metric would prove the impact is happening without relying on your own narrative?",
      expected_evidence: ["third-party metric", "pre/post measurement", "auditable result"],
      risk_if_unanswered: "The answer may not separate intention from measurable effect."
    }
  ],
  fit: [
    {
      focus: "program fit",
      prompt: "Why is this specific program the right next constraint, network, or validation point?",
      expected_evidence: ["program thesis match", "mentor or network relevance", "next milestone"],
      risk_if_unanswered: "The answer may sound like a generic application reused everywhere."
    },
    {
      focus: "mutual value",
      prompt: "What would this founder bring to the cohort or program beyond needing help?",
      expected_evidence: ["peer contribution", "domain expertise", "community or ecosystem value"],
      risk_if_unanswered: "The application may read as extractive rather than mutually valuable."
    }
  ]
};

const GENERAL_FOLLOW_UPS: FollowUpTemplate[] = [
  {
    focus: "specificity",
    prompt: "Which claim in this answer is most important, and what concrete evidence supports it?",
    expected_evidence: ["named metric", "customer example", "date or time window"],
    risk_if_unanswered: "The answer may stay persuasive at the sentence level but weak at the evidence level."
  },
  {
    focus: "falsifiability",
    prompt: "What would have to be true for this answer to be overstated or wrong?",
    expected_evidence: ["counterexample", "risk condition", "missing validation"],
    risk_if_unanswered: "The answer may not expose the assumptions a reviewer will probe."
  },
  {
    focus: "next proof",
    prompt: "What is the next proof point this founder can produce within 30 days?",
    expected_evidence: ["customer action", "product milestone", "measurable experiment"],
    risk_if_unanswered: "The answer may not translate into an actionable readiness path."
  }
];

function followUpCount(depth: typeof STRESS_DEPTHS[number]): number {
  if (depth === "light") return 3;
  if (depth === "deep") return 5;
  return 4;
}

function compactSignals(answerContent: string) {
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

function buildFollowUps(theme: string | null, topDnaThemes: string[], depth: typeof STRESS_DEPTHS[number]) {
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

export function registerStressTestAnswer(server: McpServer) {
  server.registerTool("hub_stress_test_answer", {
    title: "Stress Test Answer (authenticated)",
    description: `Returns a deterministic stress-test plan for a saved answer.

This is a read-only groundwork tool. It gathers the same saved-answer context used by hub_get_answer_review_context, then returns 3-5 probing follow-up prompts, evidence expectations, and a checklist. It does not call an LLM, score confidence, or persist results yet.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, answer_id, program_id, stress_depth, response_format }) => {
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

    let programQuestionQuery = supabase
      .from("program_questions")
      .select(`program_id, asked_as, word_limit, char_limit, section, order_index,
               programs(id, slug, name, type, status, program_value_score)`)
      .eq("archived_question_id", answer.archived_question_id)
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
    const answerContent = answer.answer_content || answer.content || "";
    const theme = answer.theme ?? archivedQuestion?.theme ?? null;
    const topDnaThemes = Array.from(new Set(normalizedDna.slice(0, 5).map((dna) => dna.theme)));
    const followUps = buildFollowUps(theme, topDnaThemes, stress_depth);

    const output = {
      answer_id: answer.id,
      mode: "stub_no_llm",
      stress_depth,
      persisted: false,
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
        matched_program_count: normalizedProgramQuestions.length,
        program_usage: normalizedProgramQuestions,
        program_dna: normalizedDna
      },
      detected_signals: compactSignals(answerContent),
      follow_up_prompts: followUps,
      checklist: [
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
      ],
      future_persistence_contract: {
        table: "answer_stress_tests",
        fields: ["answer_id", "follow_up_questions", "responses", "confidence_score", "run_at"],
        note: "Not written by this stub. Persist only after the schema and scoring behavior land."
      }
    };

    if (response_format === ResponseFormat.JSON) {
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2).slice(0, CHARACTER_LIMIT) }],
        structuredContent: output
      };
    }

    const lines = [
      "# Answer Stress Test",
      `**Mode**: ${output.mode}`,
      `**Question**: ${output.answer.question_text || archivedQuestion?.text || "unknown"}`,
      `**Theme**: ${output.answer.theme ?? "unknown"}`,
      `**Depth**: ${stress_depth}`,
      `**Program scope**: ${program_id ?? "all programs asking this question"}`,
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
      "- This tool does not call an LLM, score confidence, or persist a stress-test run yet.",
      "- Future persistence target: answer_stress_tests(answer_id, follow_up_questions, responses, confidence_score, run_at)."
    ];

    return {
      content: [{ type: "text", text: lines.join("\n").slice(0, CHARACTER_LIMIT) }],
      structuredContent: output
    };
  });
}
