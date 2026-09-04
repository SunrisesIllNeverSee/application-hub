/**
 * Public OpenAPI document for AQUA Application Hub.
 * Documents the authenticated REST API surface, the local MCP server,
 * and the agent integration model. All web API routes require a Supabase
 * session cookie or Bearer JWT — there is no unauthenticated public API.
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600

export async function GET() {
  const doc = {
    openapi: '3.0.3',
    info: {
      title: 'AQUA Application Hub API',
      version: '1.0.0',
      description:
        'AQUA Application Hub is founder-first application infrastructure built around a portable application graph: applications, recurring questions, reusable answers, answer variants, fit signals, reviews, and lineage. This document describes the authenticated REST API exposed at mos2es.xyz/api. All routes require a Supabase session cookie (browser) or Bearer JWT (extension/agent). A local MCP server exposes 27 tools for agent environments. See /developers for quickstart guides and integration details.',
      contact: {
        name: 'AQUA Application Hub',
        email: 'burnmydays@proton.me',
        url: 'https://mos2es.xyz/contact',
      },
      'x-service-info': {
        categories: ['application-infrastructure', 'answer-reuse', 'opportunity-fit'],
        provider: 'Ello Cello LLC',
        website: 'https://mos2es.xyz',
        product: 'AQUA Application Hub',
      },
      'x-auth-model': {
        type: 'Supabase session cookie or Bearer JWT',
        docs: 'https://mos2es.xyz/developers#authentication',
      },
      'x-mcp-server': {
        name: 'aqua-mcp-server',
        transport: 'stdio (local) or Streamable HTTP (self-hosted)',
        tools: 27,
        repo: 'https://github.com/SunrisesIllNeverSee/application-hub/tree/main/aqua-mcp-server',
        docs: 'https://mos2es.xyz/developers#mcp',
      },
    },
    externalDocs: {
      description: 'AQUA Application Hub developer portal',
      url: 'https://mos2es.xyz/developers',
    },
    servers: [
      { url: 'https://mos2es.xyz/api', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        SessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-access-token',
          description: 'Supabase session cookie set after login at /login.',
        },
        BearerJWT: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token from auth.getSession(). Used by the Appfeeder extension and agent integrations.',
        },
      },
      schemas: {
        ProblemDetails: {
          type: 'object',
          description: 'RFC 9457 problem document. All error responses use this shape.',
          properties: {
            type: { type: 'string', description: 'URI reference to the problem type.' },
            title: { type: 'string', description: 'Short human-readable summary.' },
            status: { type: 'integer', description: 'HTTP status code.' },
            detail: { type: 'string', description: 'Human-readable explanation specific to this occurrence.' },
            instance: { type: 'string', description: 'URI reference identifying the specific occurrence.' },
            error: { type: 'string', description: 'Machine-readable error code.' },
            resolution: { type: 'string', description: 'Suggested next step for the caller.' },
          },
          required: ['error', 'title', 'status'],
        },
        MatchRequest: {
          type: 'object',
          description: 'Question text to match against the user answer bank.',
          properties: {
            text: { type: 'string', minLength: 3, description: 'Question or form-field label text to match.' },
            program_id: { type: 'string', format: 'uuid', description: 'Optional program context for DNA-aware matching.' },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 3, description: 'Maximum number of matches.' },
          },
          required: ['text'],
        },
        MatchResult: {
          type: 'object',
          properties: {
            question_id: { type: 'string', format: 'uuid' },
            question_text: { type: 'string' },
            theme: { type: 'string', nullable: true },
            significance_score: { type: 'number' },
            asked_by_count: { type: 'integer' },
            similarity: { type: 'number', description: 'Cosine similarity (0-1).' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            auto_fill_safe: { type: 'boolean', description: 'True when similarity >= 0.87.' },
            user_answer: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                content: { type: 'string' },
                confidence: { type: 'string', enum: ['draft', 'solid', 'locked'] },
                word_count: { type: 'integer', nullable: true },
              },
            },
          },
        },
        MatchResponse: {
          type: 'object',
          properties: {
            matches: { type: 'array', items: { $ref: '#/components/schemas/MatchResult' } },
            mode: { type: 'string', enum: ['vector', 'fulltext'] },
            embedding_available: { type: 'boolean' },
            embedding_source: { type: 'string', enum: ['byok', 'platform'], nullable: true },
            query: { type: 'string' },
          },
        },
        IntakeRequest: {
          type: 'object',
          description: 'Raw application text to ingest. The system extracts questions, indexes the program, and opens a user application.',
          properties: {
            raw_text: { type: 'string', description: 'Full application text pasted from a portal or document.' },
            program_name: { type: 'string', description: 'Optional program name hint.' },
            source_url: { type: 'string', format: 'uri', description: 'Optional source URL.' },
          },
        },
        CaptureRequest: {
          type: 'object',
          description: 'Answer captured by the Appfeeder extension when a user finishes typing in a form field.',
          properties: {
            questionText: { type: 'string', description: 'The question or field label.' },
            answerText: { type: 'string', description: 'The user answer text.' },
          },
          required: ['questionText', 'answerText'],
        },
        SmartMatcherRequest: {
          type: 'object',
          description: 'Compute fit scores for the user answer bank against a target program.',
          properties: {
            program_id: { type: 'string', format: 'uuid' },
            application_id: { type: 'string', format: 'uuid' },
          },
        },
        AutofillEligibilityRequest: {
          type: 'object',
          properties: {
            program_question_count: { type: 'integer' },
            matched_answer_count: { type: 'integer' },
            avg_fidelity: { type: 'number' },
            outcomes_available: { type: 'boolean' },
          },
        },
        AutofillEligibilityResponse: {
          type: 'object',
          properties: {
            coverage: { type: 'number', description: 'Fraction of program questions matched (0-1).' },
            avg_fidelity: { type: 'number' },
            level_1_manual_prefill: { type: 'boolean', description: 'True when coverage >= 0.60.' },
            level_2_full_autofill: { type: 'boolean', description: 'True when coverage >= 0.85 and fidelity >= 0.85 with outcomes.' },
            auto_submit_beta: { type: 'boolean' },
            consent_required: { type: 'boolean' },
            thresholds: { type: 'object' },
          },
        },
        StressTestRequest: {
          type: 'object',
          description: 'Run a stress test against a saved answer.',
          properties: {
            answer_id: { type: 'string', format: 'uuid' },
            persona: { type: 'string', description: 'Reviewer persona to simulate.' },
          },
          required: ['answer_id'],
        },
        DraftRequest: {
          type: 'object',
          description: 'Generate a draft answer using BYOK or platform LLM.',
          properties: {
            question_id: { type: 'string', format: 'uuid' },
            context: { type: 'string', description: 'Additional context or instructions.' },
            model: { type: 'string', description: 'Model override.' },
          },
        },
      },
    },
    security: [{ SessionCookie: [] }, { BearerJWT: [] }],
    paths: {
      '/match-question': {
        post: {
          operationId: 'matchQuestion',
          summary: 'Match a question against the user answer bank',
          description: 'Core of the Appfeeder browser extension. Takes a form-field label or question text and returns the top matching archived questions plus the user saved answer for each. Uses vector search with full-text fallback.',
          tags: ['matching'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchRequest' } } },
          },
          responses: {
            '200': {
              description: 'Match results',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchResponse' } } },
            },
            '400': { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/applications/intake': {
        post: {
          operationId: 'intakeApplication',
          summary: 'Ingest a raw application and extract questions',
          description: 'Paste raw application text. The system archives the source, indexes the program, extracts and embeds every question, and opens a user application row.',
          tags: ['applications'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/IntakeRequest' } } },
          },
          responses: {
            '200': { description: 'Application ingested', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/answers/capture': {
        post: {
          operationId: 'captureAnswer',
          summary: 'Capture an answer from a form field',
          description: 'Called by the Appfeeder extension when a user finishes typing in a form field. Semantically matches the question, then saves a new answer version (never overwrites, always appends).',
          tags: ['answers'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CaptureRequest' } } },
          },
          responses: {
            '200': { description: 'Answer captured', content: { 'application/json': { schema: { type: 'object', properties: { saved: { type: 'boolean' }, questionId: { type: 'string' }, version: { type: 'integer' } } } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/hub/smart-matcher': {
        post: {
          operationId: 'smartMatcher',
          summary: 'Compute fit scores for a target program',
          description: 'Reads the user canonical commitments, checks coverage and fidelity, then ranks the application by where existing proof is strongest.',
          tags: ['hub'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SmartMatcherRequest' } } },
          },
          responses: {
            '200': { description: 'Fit scores', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/hub/autofill-eligibility': {
        post: {
          operationId: 'checkAutofillEligibility',
          summary: 'Check whether a user qualifies for auto-fill',
          description: 'Returns coverage, fidelity, and the eligibility flags for Level 1 manual pre-fill (60% coverage) and Level 2 full auto-fill (85% coverage + fidelity + outcomes).',
          tags: ['hub'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AutofillEligibilityRequest' } } },
          },
          responses: {
            '200': { description: 'Eligibility result', content: { 'application/json': { schema: { $ref: '#/components/schemas/AutofillEligibilityResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/hub/ingest': {
        post: {
          operationId: 'hubIngest',
          summary: 'Ingest a program or application into the canonical hub',
          description: 'Proxies to the canonical-hub Supabase function. Used for structured intake with idempotency keys.',
          tags: ['hub'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: {
            '200': { description: 'Ingested', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/hub/export': {
        post: {
          operationId: 'hubExport',
          summary: 'Export application package data',
          description: 'Proxies to the canonical-hub Supabase function to produce an application package export.',
          tags: ['hub'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: {
            '200': { description: 'Export produced', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/stress-test': {
        post: {
          operationId: 'stressTestAnswer',
          summary: 'Run a stress test against a saved answer',
          description: 'Simulates a reviewer persona attacking a saved answer to surface weaknesses before submission.',
          tags: ['review'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StressTestRequest' } } },
          },
          responses: {
            '200': { description: 'Stress test result', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/draft': {
        post: {
          operationId: 'generateDraft',
          summary: 'Generate a draft answer',
          description: 'Uses BYOK (bring-your-own-key) or platform LLM to generate a draft answer for a question. Respects the user connected integrations.',
          tags: ['drafting'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DraftRequest' } } },
          },
          responses: {
            '200': { description: 'Draft generated', content: { 'application/json': { schema: { type: 'object' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
      '/auth/token': {
        get: {
          operationId: 'getAuthToken',
          summary: 'Get the current user auth token for extension use',
          description: 'Returns the Supabase access token for the logged-in user. Used by the Appfeeder extension to authenticate API calls.',
          tags: ['auth'],
          responses: {
            '200': { description: 'Token', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          },
        },
      },
    },
    tags: [
      { name: 'matching', description: 'Question matching and answer retrieval' },
      { name: 'applications', description: 'Application intake and management' },
      { name: 'answers', description: 'Answer capture and versioning' },
      { name: 'hub', description: 'Canonical hub operations' },
      { name: 'review', description: 'Stress testing and review' },
      { name: 'drafting', description: 'LLM-powered draft generation' },
      { name: 'auth', description: 'Authentication token management' },
    ],
  }

  return NextResponse.json(doc, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
