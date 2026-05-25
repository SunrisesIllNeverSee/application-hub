import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { validateUserToken } from "../services/auth.js";

const VerticalSchema = z.enum(["founder", "college", "grants", "jobs"]);

const HubBase = z.object({
  user_token: z.string().describe("Supabase JWT from client auth"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
});

async function callHub(userToken: string, body: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY/SERVICE_ROLE_KEY are required");

  const resp = await fetch(`${url.replace(/\/$/, "")}/functions/v1/canonical-hub`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${userToken}`
    },
    body: JSON.stringify(body)
  });

  const payload = await resp.json().catch(() => ({}));
  const errorMessage = typeof payload === "object" && payload !== null && "error" in payload
    ? String((payload as { error?: unknown }).error)
    : `Canonical Hub failed with ${resp.status}`;
  if (!resp.ok) throw new Error(errorMessage);
  return payload;
}

function resultResponse(payload: unknown, responseFormat: ResponseFormat, title: string) {
  if (responseFormat === ResponseFormat.JSON) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2).slice(0, CHARACTER_LIMIT) }],
      structuredContent: payload as Record<string, unknown>
    };
  }
  return {
    content: [{ type: "text" as const, text: `# ${title}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2).slice(0, CHARACTER_LIMIT - title.length - 16)}\n\`\`\`` }],
    structuredContent: payload as Record<string, unknown>
  };
}

export function registerAquaHubTools(server: McpServer) {
  server.registerTool("aqua.ingest_application", {
    title: "AQUA: Ingest Application",
    description: "Ingest a raw application into the Canonical Hub and return mapped canonicals, variants, package id, and credit estimate.",
    inputSchema: HubBase.extend({
      vertical: VerticalSchema.default("founder"),
      entity: z.string().min(1).max(240),
      source: z.string().max(500).optional(),
      content: z.string().min(1).max(200_000),
      metadata: z.record(z.unknown()).default({})
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async ({ user_token, response_format, ...params }) => {
    const user_id = await validateUserToken(user_token);
    const payload = await callHub(user_token, { action: "ingest", user_id, ...params });
    return resultResponse(payload, response_format, "AQUA Ingestion Result");
  });

  server.registerTool("aqua.process_reward", {
    title: "AQUA: Process Reward",
    description: "Evaluate a canonical contribution for credits or payout eligibility. This creates a pending reward for manual approval.",
    inputSchema: HubBase.extend({
      entity_type: z.string().default("canonical"),
      entity_id: z.string().uuid(),
      action: z.string().default("first_load_review"),
      credit_amount: z.number().int().min(0).default(25),
      cash_amount_cents: z.number().int().min(0).default(0),
      metadata: z.record(z.unknown()).default({})
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ user_token, response_format, ...params }) => {
    const user_id = await validateUserToken(user_token);
    const { supabase } = await import("../services/supabase.js");
    const { data, error } = await supabase
      .from("contribution_rewards")
      .insert({ user_id, ...params, status: "pending" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return resultResponse({ reward: data, status: "pending_manual_approval" }, response_format, "AQUA Reward");
  });

  server.registerTool("aqua.get_variations", {
    title: "AQUA: Get Variations",
    description: "Get all variants for one canonical commitment, ordered by fidelity.",
    inputSchema: HubBase.extend({
      canonical_id: z.string().uuid()
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, response_format, canonical_id }) => {
    const user_id = await validateUserToken(user_token);
    const payload = await callHub(user_token, { action: "export", user_id, canonical_id, export_format: "json" });
    return resultResponse(payload, response_format, "AQUA Variations");
  });

  server.registerTool("aqua.qualify_answer", {
    title: "AQUA: Qualify Answer",
    description: "Run fidelity and qualification scoring for an answer variant against a canonical commitment.",
    inputSchema: HubBase.extend({
      canonical_id: z.string().uuid(),
      variant_id: z.string().uuid().optional(),
      content: z.string().max(25_000).optional(),
      metadata: z.record(z.unknown()).default({})
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, response_format, ...params }) => {
    const user_id = await validateUserToken(user_token);
    const payload = await callHub(user_token, { action: "qualify", user_id, ...params });
    return resultResponse(payload, response_format, "AQUA Qualification");
  });

  server.registerTool("aqua.get_canonical_package", {
    title: "AQUA: Get Canonical Package",
    description: "Retrieve one canonical package with user variants and lineage for editing.",
    inputSchema: HubBase.extend({
      canonical_id: z.string().uuid()
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, response_format, canonical_id }) => {
    const user_id = await validateUserToken(user_token);
    const payload = await callHub(user_token, { action: "export", user_id, canonical_id, export_format: "json" });
    return resultResponse(payload, response_format, "AQUA Canonical Package");
  });

  server.registerTool("aqua.export_package", {
    title: "AQUA: Export Package",
    description: "Export a clean package as JSON, Markdown, or PDF-ready JSON while preserving lineage.",
    inputSchema: HubBase.extend({
      package_id: z.string().uuid().optional(),
      canonical_id: z.string().uuid().optional(),
      export_format: z.enum(["json", "markdown", "pdf"]).default("json")
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ user_token, response_format, ...params }) => {
    const user_id = await validateUserToken(user_token);
    const payload = await callHub(user_token, { action: "export", user_id, ...params });
    return resultResponse(payload, response_format, "AQUA Export");
  });
}
