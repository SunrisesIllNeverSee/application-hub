import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

// ── Public tools: programs ──────────────────────────────────────────────────
import { registerSearchPrograms } from "./tools/programs/hub_search_programs.js";
import { registerGetProgramDetail } from "./tools/programs/hub_get_program_detail.js";
import { registerGetProgramRankings } from "./tools/programs/hub_get_program_rankings.js";
import { registerGetHeatScores } from "./tools/programs/hub_get_heat_scores.js";

// ── Public tools: questions ─────────────────────────────────────────────────
import { registerGetProgramQuestions } from "./tools/questions/hub_get_program_questions.js";
import { registerFindSimilarQuestions } from "./tools/questions/hub_find_similar_questions.js";
import { registerGetUniversalQuestions } from "./tools/questions/hub_get_universal_questions.js";
import { registerGetProgramDna } from "./tools/questions/hub_get_program_dna.js";

// ── Public tools: intelligence ──────────────────────────────────────────────
import { registerGetQuestionSignificance } from "./tools/intelligence/hub_get_question_significance.js";
import { registerGetAcceptanceStats } from "./tools/intelligence/hub_get_acceptance_stats.js";

// ── Authenticated tools ─────────────────────────────────────────────────────
import { registerGetProfileAnswers } from "./tools/user/hub_get_profile_answers.js";
import { registerGetApplicationReadiness } from "./tools/user/hub_get_application_readiness.js";
import { registerGetFitScore } from "./tools/user/hub_get_fit_score.js";
import { registerFindBestPrograms } from "./tools/user/hub_find_best_programs.js";
import { registerRankMyAnswers } from "./tools/user/hub_rank_my_answers.js";
import { registerLogDraftRun } from "./tools/user/hub_log_draft_run.js";

// ── Resources ───────────────────────────────────────────────────────────────
import { registerProgramResources } from "./resources/programs.js";
import { registerQuestionResources } from "./resources/questions.js";
import { registerRankingResources } from "./resources/rankings.js";

// ── Prompts ─────────────────────────────────────────────────────────────────
import { registerOpportunityScout } from "./prompts/opportunity_scout.js";
import { registerDraftAnswer } from "./prompts/draft_answer.js";
import { registerProgramComparison } from "./prompts/program_comparison.js";

// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const server = new McpServer({
    name: "application-hub-mcp-server",
    version: "1.0.0"
  });

  // Register all public tools
  registerSearchPrograms(server);
  registerGetProgramDetail(server);
  registerGetProgramRankings(server);
  registerGetHeatScores(server);
  registerGetProgramQuestions(server);
  registerFindSimilarQuestions(server);
  registerGetUniversalQuestions(server);
  registerGetProgramDna(server);
  registerGetQuestionSignificance(server);
  registerGetAcceptanceStats(server);

  // Register authenticated tools
  registerGetProfileAnswers(server);
  registerGetApplicationReadiness(server);
  registerGetFitScore(server);
  registerFindBestPrograms(server);
  registerRankMyAnswers(server);
  registerLogDraftRun(server);

  // Register resources
  registerProgramResources(server);
  registerQuestionResources(server);
  registerRankingResources(server);

  // Register prompts
  registerOpportunityScout(server);
  registerDraftAnswer(server);
  registerProgramComparison(server);

  // ── Transport ──────────────────────────────────────────────────────────────
  const transport = process.env.TRANSPORT ?? "stdio";

  if (transport === "http") {
    const app = express();
    app.use(express.json());

    // Stateless HTTP — new transport per request (simpler, scales better)
    app.post("/mcp", async (req, res) => {
      const t = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true
      });
      res.on("close", () => t.close());
      await server.connect(t);
      await t.handleRequest(req, res, req.body);
    });

    // Health check
    app.get("/health", (_req, res) => {
      res.json({ status: "ok", server: "application-hub-mcp-server", version: "1.0.0" });
    });

    const port = parseInt(process.env.PORT ?? "3000");
    app.listen(port, () => {
      console.error(`Application Hub MCP server running on :${port}/mcp`);
    });
  } else {
    // stdio — default for local use with Claude, Cursor, Windsurf
    const t = new StdioServerTransport();
    await server.connect(t);
    console.error("Application Hub MCP server running on stdio");
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
