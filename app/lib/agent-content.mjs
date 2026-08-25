export const MARKDOWN_PAGES = {
  '/': `# AQUA Application Hub

Application answer reuse lets you write strong answers to common application questions once and adapt them across multiple programs. AQUA is founder-first application infrastructure operated by Ello Cello LLC that turns recurring application questions, reusable answers, opportunity fit signals, and review history into a portable application graph. The public product is available at https://mos2es.xyz.

## What AQUA does

AQUA helps people build an answer bank once and reuse strong source material across accelerator, fellowship, grant, job, and school applications. Applications, questions, answers, variants, and exports remain connected by lineage so an answer can be improved without losing its source. The product also ranks opportunities using program structure, coverage, fit, and readiness signals. These scores are preparation tools; they are not admissions predictions and do not influence the organizations receiving an application.

## Smart Matcher

Smart Matcher compares the material already present in an answer bank with the question surface of an opportunity. It can show where coverage is strong, where an answer needs revision, and where a gap remains. The purpose is to reduce repeated drafting while preserving the user's original commitments and evidence.

## Agent access

Agents should read https://mos2es.xyz/llms.txt for when-to-use guidance. The repository includes a local/stdio MCP server for answer retrieval, fit and ranking tools, review context, persisted stress tests, and write-back. Do not assume a hosted public MCP endpoint. Web users can start at https://mos2es.xyz/login.

## Trust and identity

- About: https://mos2es.xyz/about
- Contact: https://mos2es.xyz/contact
- Privacy: https://mos2es.xyz/privacy
- Scoring methodology: https://mos2es.xyz/about/scoring
- Sitemap: https://mos2es.xyz/sitemap.xml
- Source repository: https://github.com/SunrisesIllNeverSee/application-hub
`,
  '/about': `# About AQUA Application Hub

Application answer reuse is the practice of writing strong answers to common application questions once and adapting them across multiple programs — accelerators, fellowships, grants, jobs, and schools. AQUA Application Hub is a platform for reusable application infrastructure built around a simple observation: many applications ask different versions of the same underlying questions. Rewriting those answers from scratch loses time, evidence, and consistency. AQUA stores questions and answers as reusable assets, keeps variants connected to their sources, and helps a user see which opportunities can already be answered from material they have developed.

## Product scope

The current public wedge is founder and startup opportunity applications, including accelerators, fellowships, grants, and venture programs. The underlying application graph is designed so the same question-answer-review structure can support adjacent application domains such as jobs and schools without rebuilding the data model from zero.

AQUA includes an answer bank, application workspace, opportunity fit and readiness signals, imports, BYOK drafting, persisted reviews, stress tests, and a local MCP server. The MCP surface is intended for power users working from agent environments such as Claude, Cursor, or Windsurf. It is not advertised as a public hosted endpoint.

## Operator and ownership

AQUA is operated by Ello Cello LLC, a New York limited liability company. The canonical public product URL is https://mos2es.xyz. The public source repository is https://github.com/SunrisesIllNeverSee/application-hub. AQUA is part of the broader MO§ES product family, while this site remains specifically focused on application infrastructure.

## Boundaries

AQUA can organize source material, calculate internal preparation and fit signals, and help users review or reuse their own answers. It does not decide who is admitted, funded, hired, or selected. Scores shown by AQUA are internal decision-support signals, not acceptance probabilities and not endorsements from the programs represented in the archive.
`,
  '/contact': `# Contact AQUA

AQUA Application Hub is operated by Ello Cello LLC. Use the contact information below for product questions, business inquiries, account or data requests, and responsible security disclosures related to https://mos2es.xyz.

## Email

Primary contact: burnmydays@proton.me

When contacting us about an account or privacy request, include enough information to identify the request but do not send passwords, API keys, private application answers, or other credentials by email. For a security report, describe the affected surface and reproduction steps without publishing active secrets.

## Business mailing address

Ello Cello LLC  
84 W Utica St  
Buffalo, NY 14209  
United States

This is the business mailing address associated with Ello Cello LLC's public records. A public support telephone number is not currently listed on this site, so agents should not invent or infer one.

## Useful links

- Product: https://mos2es.xyz
- About: https://mos2es.xyz/about
- Privacy: https://mos2es.xyz/privacy
- Scoring methodology: https://mos2es.xyz/about/scoring
- Source repository: https://github.com/SunrisesIllNeverSee/application-hub
`,
  '/privacy': `# AQUA Privacy

Last updated: 2026-08-21

AQUA Application Hub is operated by Ello Cello LLC. This page describes the main categories of information the product handles and the controls reflected in the current application architecture. It is intended to make the public data posture legible; it does not replace any additional terms presented during a specific paid service or integration flow.

## Information used by the product

AQUA may process account identity needed to authenticate a user, profile information the user supplies, application questions and source material the user imports, answers and answer-version history, review and stress-test records, opportunity-fit data, and billing or subscription state when paid features are used. The system also handles ordinary request and operational metadata required to run a web application.

## Answer and credential protection

User answers and answer history are treated as sensitive application data. The application uses Supabase as its system of record and uses row-level access controls for user-scoped data. Bring-your-own-key provider credentials are intended to remain server-side and are stored encrypted when persisted. Service-role keys, webhook secrets, and integration encryption keys are server-side secrets and must not be exposed to frontend code.

## Providers and user choices

AQUA can support BYOK model providers, so a user who enables a provider may send selected drafting or review material to that provider under the provider's own terms. Billing flows may use Stripe. Hosting, authentication, database, and delivery infrastructure may process information necessary to provide those services. Users should avoid placing credentials or secrets inside application-answer text.

## Requests and contact

For privacy, access, correction, or deletion questions, contact burnmydays@proton.me. Include the account email or other identifier necessary to locate the relevant account, but do not send passwords, private API keys, or authentication tokens. Business contact information and the mailing address are published at https://mos2es.xyz/contact.
`,
  '/about/scoring': `# AQUA Scoring & Intelligence

Opportunity fit scoring measures how well your existing application answers align with what a specific program asks for. AQUA computes significance scores, fit scores, composite scores, and program value signals using defined internal formulas applied consistently to structured data. These are preparation signals, not admissions predictions or objective truth.

## Significance Score

Significance describes how structurally important a question appears across the program archive. Signals can include how often a question is asked, its word-limit weight, theme prestige, and whether it is broadly reusable. It does not grade the quality of an individual user's answer.

## Fit Score

Fit describes how well the user's current profile and answer coverage align with the question surface and themes of a specific program. Coverage, theme alignment, criteria match, and answer completeness contribute to the signal. A fit score does not predict acceptance; programs make their own decisions using information outside AQUA's model.

## Composite, heat, and program value

Composite scoring combines personal fit with an estimated program-value signal to help sort opportunities for one user. Heat is a structural desirability signal when personalized fit data is thin. Program value is an estimate derived from factors such as brand, network, check size, and terms. These are product navigation signals, not universal rankings.

## Boundaries

AQUA does not decide who gets into a program, does not expose a leaderboard ranking founders against one another, and does not represent any accelerator, grantmaker, employer, school, or fellowship listed in the archive. The detailed human-readable methodology is available at https://mos2es.xyz/about/scoring.
`,
  '/developers': `# AQUA Application Hub Developer Portal

An application infrastructure API lets developers programmatically access reusable application answers, opportunity fit scoring, and application graph data. The AQUA Application Hub exposes an authenticated REST API with typed operations, a local MCP server with 27 tools for agent environments, and the Appfeeder browser extension for capturing answers from program websites. This document is the Markdown representation of the developer portal at https://mos2es.xyz/developers.

## Quickstart

AQUA is an authenticated product. Sign in at https://mos2es.xyz/login to get a session cookie, or retrieve a Bearer JWT from GET /api/auth/token for extension or agent use.

\`\`\`bash
# Get your auth token (requires active session)
curl https://mos2es.xyz/api/auth/token

# Match a question against your answer bank
curl -X POST https://mos2es.xyz/api/match-question \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <JWT>" \\
  -d '{"text": "Tell us what you have built", "limit": 5}'
\`\`\`

## OpenAPI specification

The full OpenAPI 3.0.3 document is published at https://mos2es.xyz/openapi.json. It documents 10 operations with unique operationIds, typed request/response schemas, and ProblemDetails error models (RFC 9457). Operations include matchQuestion, intakeApplication, captureAnswer, smartMatcher, checkAutofillEligibility, stressTestAnswer, generateDraft, and getAuthToken.

## Authentication

AQUA uses Supabase Auth. Two credential types are accepted:

- Session cookie (browser): After login, Supabase sets an sb-access-token cookie. The web app and browser extension use this automatically.
- Bearer JWT (extension/agent): Send Authorization: Bearer <JWT> with API requests. Get the JWT from GET /api/auth/token while logged in.

## MCP server

The AQUA MCP server exposes 27 tools across programs, questions, rankings, intelligence, and user-authenticated operations. It is published on npm as application-hub-mcp-server and can be run with npx -y application-hub-mcp-server. It runs locally via stdio (Claude Desktop, Cursor, Windsurf) or self-hosted via Streamable HTTP transport. There is no public hosted MCP endpoint at mos2es.xyz. The MCP manifest is at https://mos2es.xyz/.well-known/mcp. Source code is at https://github.com/SunrisesIllNeverSee/application-hub/tree/main/application-hub-mcp-server.

## CLI

The AQUA MCP server is published on npm at https://www.npmjs.com/package/application-hub-mcp-server. Install globally with npm install -g application-hub-mcp-server or run directly with npx -y application-hub-mcp-server.

### Public tools (11, no auth required)

hub_search_programs, hub_get_program_detail, hub_get_program_by_slug, hub_get_program_rankings, hub_get_heat_scores, hub_get_program_questions, hub_find_similar_questions, hub_get_universal_questions, hub_get_program_dna, hub_get_question_significance, hub_get_acceptance_stats.

### Authenticated tools (16, require Supabase JWT)

hub_get_profile_answers, hub_get_application_readiness, hub_get_fit_score, hub_find_best_programs, hub_rank_my_answers, hub_log_draft_run, hub_save_answer, hub_get_answer_review_context, hub_save_answer_review, hub_stress_test_answer, hub_intake_application, hub_fill_application, hub_set_borrow_threshold, hub_search_answer_bank.

## Error handling

All API error responses use a ProblemDetails shape (RFC 9457) with machine-readable error codes, human-readable title and detail, and a resolution hint.

## Appfeeder browser extension

The Appfeeder Chrome extension captures answers from application form fields using /api/answers/capture and /api/match-question with a Bearer JWT. Source is in the repository under appfeeder/.

## Agent integration

For agent guidance see https://mos2es.xyz/llms.txt. For Contribution Exchange behavior see https://mos2es.xyz/agents. The MCP manifest at https://mos2es.xyz/.well-known/mcp describes the tool surface in machine-readable form.
`,

  '/faq': `# AQUA Application Hub — Frequently Asked Questions

AQUA Application Hub is a platform for reusable application infrastructure at https://mos2es.xyz. These answers cover what AQUA is, how answer reuse works, what the scores mean, and how to get started.

## What is AQUA Application Hub?

AQUA Application Hub is a platform for reusable application infrastructure. It turns recurring application questions, reusable answers, opportunity-fit signals, and review history into a portable application graph. The current public wedge is founder and startup opportunity applications — accelerators, fellowships, grants, and jobs.

## Is AQUA an admissions oracle?

No. AQUA does not decide who is admitted, funded, hired, or selected. Its scores are decision-support and preparation signals, not acceptance probabilities, external rankings, or endorsements from any organization represented in the archive. AQUA helps you prepare; it does not predict outcomes.

## How does answer reuse work?

Many accelerators, fellowships, grants, jobs, and schools ask different versions of the same underlying questions. AQUA treats questions and answers as reusable assets. You write a strong answer once, improve it over time, create variants for different destinations, and keep those variants connected to the source material. When a new application asks a similar question, AQUA surfaces the best existing answer instead of making you start from scratch.

## What is Smart Matcher?

Smart Matcher compares your current profile against a program question surface and identifies how well your existing answers align. It measures coverage, theme alignment, criteria match, and answer completeness. Smart Matcher helps you prioritize programs where you are already strong and identify gaps before you start drafting.

## What is fit score?

Fit score measures how well your current profile aligns to a specific program. It combines four dimensions: coverage of the program question surface (40%), theme alignment (35%), criteria match (15%), and a quality signal from answer completeness (10%). A fit score is not a prediction of acceptance — it tells you where you are prepared relative to what the program measures.

## What is significance score?

Significance score measures how important a question is across the universe of programs. A high significance score means the question appears frequently, commands longer answers, and aligns with high-prestige themes. It does not grade the quality of your answer — it measures the question structural importance in the ecosystem.

## What is the application graph?

The application graph is the data structure that connects your questions, answers, applications, fit signals, review loops, and reusable identity material. Instead of treating each application as an isolated document, the graph links related questions and answers across programs so that improving one answer benefits all applications that touch the same underlying question.

## What is answer lineage?

Answer lineage is the connection between an answer variant and its source material. When you create a variant of an answer for a different program, AQUA tracks the relationship back to the original answer and its supporting evidence. This means you can trace why an answer says what it says, update the source, and see which variants are affected.

## Is AQUA free?

AQUA is operated by Ello Cello LLC and is part of the broader MO§ES product family. The web application at mos2es.xyz is the canonical public product surface. The local MCP server and developer resources are publicly accessible.

## How does the MCP server work?

AQUA ships a local MCP server (Model Context Protocol) that exposes answer retrieval, ranking, review-context, stress-test, and write-back capabilities for power users operating through agent environments. The MCP server runs locally via stdio — install it with npx application-hub-mcp-server. There is no hosted public MCP endpoint at mos2es.xyz; the server is designed for local use alongside your agent client.

## What is the Appfeeder extension?

Appfeeder is a browser extension that lets you capture application questions and draft answers directly from program websites. It feeds captured content into your AQUA answer bank so you can refine and reuse it across applications.

## Does AQUA rank applicants?

No. AQUA does not rank founders against each other. Scores are personal — your composite score tells you how you fit a program, not how you compare to other people applying to that program. AQUA never exposes inter-founder comparisons. The Hub ranks programs for you, not you against other applicants.

## Does AQUA influence admissions decisions?

No. AQUA has no relationship with any program admissions process. No score AQUA surfaces influences any decision made by YC, Techstars, NSF, or any other program. AQUA surfaces signal that helps you prepare. What programs do with what you submit is entirely outside the AQUA scope.

## What is the Contribution Exchange?

The Contribution Exchange is an agent-facing protocol that allows AI agents to propose or request contributions through a central Steward. It has moved to signalaf.com — see signalaf.com/agents.md for the full agent carry guide.

## How do I get started with AQUA?

Visit mos2es.xyz and create an account. Build your answer bank by importing existing application answers or capturing new ones with the Appfeeder extension. Use Smart Matcher to find programs where your profile aligns. Check the Hub for ranked opportunities. Developers can install the MCP server with npx application-hub-mcp-server for agent-based workflows.
`,
  '/application-infrastructure': `# Application Infrastructure — Concepts, Guides, and Comparisons

Application infrastructure is the layer that connects reusable answers, source lineage, fit signals, and review loops across many programs — accelerators, fellowships, grants, and jobs. This hub ties the AQUA content layer together: the concepts that define the model, the guides that show how to use it, and the comparisons that place it against alternatives.

## Concepts

- **Answer Reuse** — Treating questions and answers as reusable assets with variants kept connected to source material. https://mos2es.xyz/concepts/answer-reuse
- **Fit Score** — How well your current profile aligns to a specific program across coverage, themes, criteria, and completeness. https://mos2es.xyz/concepts/fit-score
- **Application Graph** — The data structure connecting questions, answers, applications, fit signals, and review loops. https://mos2es.xyz/concepts/application-graph
- **Answer Lineage** — The connection between an answer variant and its source material, so updates propagate to affected variants. https://mos2es.xyz/concepts/answer-lineage
- **Smart Matcher** — Compares your profile against a program question surface and identifies coverage gaps before drafting. https://mos2es.xyz/concepts/smart-matcher

## Guides

- **Build an Answer Bank** — How to import or capture answers and structure them for reuse across programs. https://mos2es.xyz/guides/how-to-build-an-answer-bank
- **Reuse Application Answers** — How to adapt existing answers for a new program while preserving lineage. https://mos2es.xyz/guides/how-to-reuse-application-answers
- **Compare Accelerator Fit** — How to use fit score and Smart Matcher to prioritize programs where you are already strong. https://mos2es.xyz/guides/how-to-compare-accelerator-fit

## Comparisons

- **AQUA vs FounderApp** — Application graph and fit scoring versus universal profile autofill. https://mos2es.xyz/vs/founderapp
- **AQUA vs Manual Tracking** — Structured answer bank and lineage versus spreadsheets, docs, and copy-paste. https://mos2es.xyz/vs/manual-application-tracking
- **AQUA vs Spreadsheets** — Graph structure and fit signals versus flat, manual application tracking. https://mos2es.xyz/vs/spreadsheets-for-applications

## Related pages

- About AQUA: https://mos2es.xyz/about
- Scoring methodology: https://mos2es.xyz/about/scoring
- FAQ: https://mos2es.xyz/faq
`,
  '/concepts/answer-reuse': `# What is answer reuse in applications?

Answer reuse is the practice of writing a strong answer to a recurring application question once, then carrying that answer — and its variants — across every program that asks a version of the same underlying question. Accelerators, fellowships, grants, and jobs routinely ask different phrasings of the same core prompts: tell us about your team, describe your traction, what problem are you solving. Answer reuse treats those questions and answers as reusable assets rather than disposable, per-application text. AQUA Application Hub is built around this idea — it maintains an answer bank, tracks variants, and preserves lineage so every improvement to a source answer propagates to the programs that depend on it.

## Why answer reuse matters

Most application questions are not unique. A founder applying to Y Combinator, Techstars, an NSF grant, and a fellowship will answer near-identical prompts about team, problem, market, and traction four times over. Writing each from scratch wastes effort and produces inconsistent quality. Answer reuse lets you invest once in a strong, well-evidenced answer, then adapt it for each destination — preserving the substance while tuning the framing. The result is higher-quality applications with less manual work and a single source of truth you can keep improving.

## How AQUA implements answer reuse

AQUA implements answer reuse through three connected mechanisms:

- **Answer bank.** A central store of your strongest answers to recurring questions, indexed by the underlying question rather than by program. When a new application asks a similar question, AQUA surfaces the best existing answer instead of a blank field.
- **Variants.** Each program may need a different framing of the same answer. AQUA lets you create variants tuned to a specific destination while keeping them linked to the source answer, so you never lose the relationship between an adapted answer and the material that produced it.
- **Lineage.** Every variant traces back to its source answer and supporting evidence. When you update the source, AQUA can show which variants are affected and which programs depend on them.

## What answer reuse is not

Answer reuse is not plagiarism. You are reusing your own answers to your own questions, not copying someone else's work. It is also not copy-paste without adaptation. A strong reused answer is tailored to each program's framing, word limits, and evaluation criteria — the substance carries over, but the presentation is adapted. Answer reuse is a structured workflow for compounding quality over time, not a shortcut for submitting identical text everywhere.

## Related pages

- Answer Lineage: https://mos2es.xyz/concepts/answer-lineage
- Smart Matcher: https://mos2es.xyz/concepts/smart-matcher
- Guide: Reuse Answers: https://mos2es.xyz/guides/how-to-reuse-application-answers
- FAQ: https://mos2es.xyz/faq
`,
  '/concepts/fit-score': `# What is opportunity fit scoring?

Opportunity fit scoring measures how well your current profile aligns to a specific program. It combines four dimensions — coverage of the program question surface, theme alignment, criteria match, and answer quality — into a single signal that tells you where you are prepared relative to what the program measures. AQUA Application Hub computes fit scores to help you prioritize programs where you are already strong and identify gaps before you start drafting.

## The four dimensions of fit

A fit score is not a single number pulled from intuition. It is a weighted combination of four measurable dimensions:

- **Coverage (40%).** How much of the program question surface your existing answers already address. High coverage means you can reuse strong answers instead of starting from scratch.
- **Theme alignment (35%).** How well your profile's themes — market, stage, technology, mission — match the themes the program is known to evaluate and reward.
- **Criteria match (15%).** How directly your answers map to the program's stated evaluation criteria, not just its questions.
- **Quality (10%).** A signal from answer completeness — whether your answers are full, evidenced, and free of obvious gaps relative to the question's demands.

## How fit scoring differs from admissions predictions

A fit score is not a prediction of acceptance. It does not estimate the probability that a program will admit, fund, or hire you. It tells you how prepared your current profile is relative to what the program measures — where you are strong, where you have gaps, and which programs are worth your drafting time. Admissions decisions depend on factors AQUA cannot see: the applicant pool, reviewer judgment, program capacity, and criteria that are never published. Fit scoring is decision-support for preparation, not a forecast of outcomes.

## How AQUA computes fit scores

AQUA computes fit scores by comparing your answer bank and profile against a program's question surface — the full set of questions the program asks, weighted by their significance across the ecosystem. Smart Matcher performs the comparison, measuring coverage, theme alignment, criteria match, and completeness against your existing answers. The four dimensions are combined using the weights above to produce a single fit score for that program. Because the score is computed from your current answer bank, it updates as you add and improve answers — so fit is a living signal, not a static label.

## Related pages

- Scoring methodology: https://mos2es.xyz/about/scoring
- Smart Matcher: https://mos2es.xyz/concepts/smart-matcher
- Guide: Compare Fit: https://mos2es.xyz/guides/how-to-compare-accelerator-fit
- FAQ: https://mos2es.xyz/faq
`,
  '/concepts/application-graph': `# What is a portable application graph?

A portable application graph is the data structure that connects your applications, questions, answers, variants, and reviews through typed edges representing lineage, coverage, and fit. Instead of treating each application as an isolated document, the graph links related questions and answers across programs so that improving one answer benefits every application that touches the same underlying question. AQUA Application Hub is built on a portable application graph — it is the substrate that makes answer reuse, fit scoring, and lineage tracking possible.

## Nodes in the graph

The application graph is made up of several types of nodes, each representing a distinct unit of application infrastructure:

- **Applications.** A specific submission to a specific program — the container that ties questions and answers to a destination.
- **Questions.** The underlying prompts a program asks, normalized so that the same question asked different ways maps to one node.
- **Answers.** Your strongest response to an underlying question, stored once and reused across programs.
- **Variants.** Program-specific adaptations of a source answer, tuned for framing, word limits, and evaluation criteria.
- **Reviews.** Feedback and review-loop records attached to answers or variants, preserving the history of how an answer evolved.

## Edges in the graph

Nodes are connected by typed edges that carry meaning, not just references:

- **Lineage edges.** Connect a variant back to its source answer and supporting evidence, so you can trace why an answer says what it says.
- **Coverage edges.** Connect a program's question surface to the answers in your bank that address each question, powering fit scoring.
- **Fit edges.** Connect your profile to a program through computed fit signals, so the graph carries live scoring state, not just static content.

## Why portability matters

Most application tools treat each submission as a standalone document. When you improve an answer for one program, that improvement is trapped inside that application. A portable application graph breaks that isolation: because answers, questions, and lineage are shared across programs, an improvement to a source answer propagates to every variant and application that depends on it. Portability also means the graph is not tied to a single program's format — it follows you across accelerators, fellowships, grants, and jobs, accumulating value as your application infrastructure grows.

## How AQUA implements the application graph

AQUA stores the application graph as the core data model behind its answer bank, Smart Matcher, and scoring engine. Questions are normalized to underlying prompts so reuse is automatic. Answers are linked to variants through lineage edges, and coverage edges connect your answer bank to each program's question surface for fit computation. The graph is queryable through the web application and, for power users, through the local MCP server — so agents can retrieve answers, trace lineage, and write back improvements without leaving the graph model.

## Related pages

- Answer Reuse: https://mos2es.xyz/concepts/answer-reuse
- Answer Lineage: https://mos2es.xyz/concepts/answer-lineage
- About AQUA: https://mos2es.xyz/about
- FAQ: https://mos2es.xyz/faq
`,
  '/concepts/answer-lineage': `# What is answer lineage?

Answer lineage is the connection between an answer variant and its source material. When you create a variant of an answer for a different program, lineage tracks the relationship back to the original answer and its supporting evidence. This means you can trace why an answer says what it says, update the source, and see which variants are affected. AQUA Application Hub preserves lineage as a first-class edge in the application graph, so every adapted answer stays connected to the material that produced it.

## Source-variant relationships

A source answer is your strongest, most complete response to an underlying question — the version backed by evidence, refined over time, and intended to be reused. A variant is a program-specific adaptation of that source: tuned for framing, word limits, and evaluation criteria, but carrying the same core substance. Lineage is the typed edge that connects a variant back to its source. One source can have many variants, each tailored to a different destination, and every variant knows exactly where it came from.

## Why lineage matters

Lineage solves three problems that isolated answer storage cannot:

- **Traceability.** When a reviewer asks why your answer makes a specific claim, lineage lets you point back to the source answer and the evidence behind it — not just the adapted variant you submitted.
- **Update propagation.** When you improve a source answer — new data, sharper framing, corrected fact — lineage tells you which variants are affected so you can update them consistently instead of hunting through past applications.
- **Evidence preservation.** The supporting material that makes an answer strong is attached to the source, not duplicated into every variant. Lineage keeps evidence in one place while letting every variant reference it.

## How AQUA implements answer lineage

AQUA stores lineage as typed edges in the application graph. When you create a variant from a source answer, AQUA records the relationship automatically — you do not have to manually link them. The source answer carries the supporting evidence and the canonical framing; each variant carries only its program-specific deltas. When a source is updated, AQUA can surface the variants that depend on it, so you can review and refresh adapted answers in one pass. Lineage is queryable through the web application and through the local MCP server, so agents can trace an answer back to its source and evidence without leaving the graph model.

## Related pages

- Answer Reuse: https://mos2es.xyz/concepts/answer-reuse
- Application Graph: https://mos2es.xyz/concepts/application-graph
- About AQUA: https://mos2es.xyz/about
- FAQ: https://mos2es.xyz/faq
`,
  '/concepts/smart-matcher': `# What is Smart Matcher for applications?

Smart Matcher is a feature that compares your current profile against a program's question surface and identifies how well your existing answers align. It measures coverage, theme alignment, criteria match, and answer completeness so you can prioritize programs where you are already strong and spot gaps before you start drafting. AQUA Application Hub uses Smart Matcher as the engine behind fit scoring — it performs the comparison that produces the signal.

## What Smart Matcher measures

Smart Matcher evaluates four dimensions when comparing your profile to a program:

- **Coverage.** How much of the program's question surface your existing answers already address. High coverage means you can reuse strong answers instead of writing from scratch.
- **Theme alignment.** How well your profile's themes — market, stage, technology, mission — match the themes the program is known to evaluate and reward.
- **Criteria match.** How directly your answers map to the program's stated evaluation criteria, not just its surface questions.
- **Completeness.** Whether your answers are full, evidenced, and free of obvious gaps relative to what each question demands.

## How Smart Matcher helps prioritize programs

Applying to every program that looks interesting is not a strategy — it is a way to burn out. Smart Matcher turns your answer bank into a prioritization tool. For each program, it shows you where you are already strong (high coverage, aligned themes) and where you have gaps (missing questions, weak criteria match). You can rank programs by fit, focus your drafting time on the ones where you are closest to ready, and defer or skip programs where the gap is large. The result is fewer, better-targeted applications instead of scattered effort.

## How Smart Matcher differs from admissions predictions

Smart Matcher does not predict whether you will be admitted, funded, or hired. It measures alignment between your current profile and what a program asks for — a preparation signal, not an outcome forecast. Admissions decisions depend on the applicant pool, reviewer judgment, program capacity, and unpublished criteria that no tool can see. Smart Matcher tells you where you are prepared and where you are not, so you can decide where to invest your effort. What programs do with what you submit is entirely outside its scope.

## Related pages

- Fit Score: https://mos2es.xyz/concepts/fit-score
- Scoring methodology: https://mos2es.xyz/about/scoring
- Guide: Compare Fit: https://mos2es.xyz/guides/how-to-compare-accelerator-fit
- FAQ: https://mos2es.xyz/faq
`,
  '/guides/how-to-reuse-application-answers': `# How to reuse application answers

Answer reuse is a core capability of AQUA Application Hub. Many accelerators, fellowships, grants, and jobs ask different versions of the same underlying questions. This guide walks you through identifying recurring questions, writing canonical answers, creating program-specific variants, preserving lineage, and using Smart Matcher to find programs where your answers already align.

## 1. Identify recurring questions across your programs

Review the applications you have already completed and the programs in the Hub. Group questions by their underlying type — team background, traction, market size, why this program, failure and resilience. Most accelerators, fellowships, and grants ask different phrasings of the same handful of questions. AQUA surfaces these recurring patterns so you can treat each question type as a reusable asset rather than a one-off prompt.

## 2. Write canonical answers for each question type

For every recurring question type, draft one strong canonical answer. This is the version you will reuse and improve over time. Write it to be complete and specific — include concrete numbers, named outcomes, and real examples. A canonical answer is not a template with blanks; it is the best version of that answer you can produce, written to be adapted later.

## 3. Create variants for different program contexts

Each program frames questions differently and weighs different criteria. Create a variant of your canonical answer tailored to each destination — adjust emphasis, length, and framing to match what that program measures. AQUA keeps every variant linked to its parent canonical answer so you never lose track of where a version came from or why it diverged.

## 4. Preserve lineage back to source material

Every variant should trace back to the source material that produced it — the original answer, the evidence behind it, and the program context that shaped it. Answer lineage lets you update the source and see which variants are affected, so improving one answer benefits every application that touches the same underlying question. Never copy an answer without keeping the connection to its origin.

## 5. Use Smart Matcher to find programs where your answers align

Run Smart Matcher against programs in the Hub to see how well your existing answer bank covers each program question surface. Smart Matcher measures coverage, theme alignment, criteria match, and answer completeness. It surfaces programs where you are already strong and flags gaps before you start drafting, so you spend effort where it matters.

## 6. Review and refine before submitting

Before you submit any application, review the variants you are using against the specific program questions. Check that each variant still fits, that the framing matches the program criteria, and that no source material has changed since the variant was written. Refine weak answers and update the canonical version so the improvement propagates to future applications.

## Related pages

- Answer reuse concept: https://mos2es.xyz/concepts/answer-reuse
- Answer lineage concept: https://mos2es.xyz/concepts/answer-lineage
- Smart Matcher concept: https://mos2es.xyz/concepts/smart-matcher
- FAQ: https://mos2es.xyz/faq
`,
  '/guides/how-to-compare-accelerator-fit': `# How to compare accelerator fit

Comparing accelerator fit is a core workflow in AQUA Application Hub. Rather than treating each application as an isolated document, AQUA lets you measure how well your existing answer bank aligns to each program question surface. This guide walks you through building your answer bank, running Smart Matcher against target programs, comparing fit scores, and prioritizing where to apply.

## 1. Build your answer bank with existing material

Start by collecting the application answers you have already written — for accelerators, fellowships, grants, jobs, or any other opportunity. Import them into AQUA or capture new ones with the Appfeeder browser extension. Your answer bank is the foundation for every fit comparison, so the more complete and well-organized it is, the more accurate your fit scores will be.

## 2. Identify target programs in the Hub

Browse the AQUA Application Hub for programs relevant to your startup. The Hub ranks accelerators, fellowships, and grants by composite score — a combination of your personal fit and the program estimated value. Identify a shortlist of programs you want to evaluate, focusing on those whose themes and criteria align with your stage and sector.

## 3. Run Smart Matcher against each program

For every target program, run Smart Matcher to compare your current answer bank against that program question surface. Smart Matcher measures four dimensions: coverage of the program questions, theme alignment, criteria match, and answer completeness. The result is a fit score that tells you how prepared you are relative to what that program measures — not a prediction of acceptance.

## 4. Compare fit scores across programs

Lay out the fit scores from your target programs side by side. A higher fit score means your existing answers already cover more of what that program asks. Look for programs where coverage and theme alignment are both strong — those are the applications you can complete fastest and most confidently. Fit score is personal: it tells you where you are prepared, not how you compare to other applicants.

## 5. Identify coverage gaps before drafting

For each program, review the questions Smart Matcher flagged as uncovered or weak. These are the gaps you need to close before submitting. Prioritize gaps in high-significance questions — the ones that appear frequently across programs and carry the most weight. Filling a gap in a high-significance question improves your fit across multiple programs at once, not just the one you are targeting.

## 6. Prioritize programs where fit is strongest

Rank your shortlist by fit score and focus your drafting effort on the programs where you are already strongest. These are the applications with the highest return on effort — you have the most material ready and the fewest gaps to fill. Save programs with lower fit scores for later rounds, after you have strengthened the underlying answers that those programs depend on.

## Related pages

- Fit score concept: https://mos2es.xyz/concepts/fit-score
- Smart Matcher concept: https://mos2es.xyz/concepts/smart-matcher
- Scoring methodology: https://mos2es.xyz/about/scoring
- FAQ: https://mos2es.xyz/faq
`,
  '/guides/how-to-build-an-answer-bank': `# How to build an answer bank for applications

Building an answer bank is the foundational workflow in AQUA Application Hub. An answer bank turns your scattered application responses into a structured, reusable asset that powers answer reuse, Smart Matcher, and fit scoring. This guide walks you through collecting existing answers, importing them into AQUA, organizing by question type, tagging with themes, creating variants, and improving your bank over time.

## 1. Collect your existing application answers

Gather every application answer you have already written — for accelerators, fellowships, grants, jobs, or schools. Pull them from email drafts, Google Docs, submitted applications, and any spreadsheets you use to track responses. The goal is a complete inventory of the material you have already produced, because every past answer is a reusable asset for future applications.

## 2. Import them into AQUA or capture with Appfeeder

Import your collected answers into AQUA Application Hub. For answers still living on program websites or in browser sessions, use the Appfeeder browser extension to capture questions and draft answers directly from the source page. Appfeeder feeds captured content into your AQUA answer bank so nothing is lost to manual copy-paste or forgotten tabs.

## 3. Organize by question type

Group your answers by the underlying question type rather than by program. Most applications ask variations of the same recurring questions — team background, traction, market size, why this program, failure and resilience. Organizing by question type lets you see where you have strong material and where you have gaps, independent of any single program.

## 4. Tag with themes and criteria

Tag each answer with the themes and criteria it addresses — for example, technical depth, market understanding, leadership, resilience, or social impact. Thematic tagging is what makes Smart Matcher work: it compares your tagged answers against a program theme and criteria profile to measure alignment. The richer your tags, the more accurate your fit scores.

## 5. Create variants for different destinations

For each canonical answer, create variants tailored to the programs you are targeting. Adjust emphasis, length, and framing to match what each program measures. AQUA preserves the lineage between every variant and its parent canonical answer, so when you improve the source, every connected variant benefits. Never create a variant without keeping the link to its origin.

## 6. Review and improve over time

Your answer bank is a living asset, not a one-time import. After each application cycle, review your answers — update stale numbers, sharpen weak responses, and retire material that no longer reflects your current situation. Every improvement to a canonical answer propagates to all variants that depend on it, so incremental maintenance compounds across every future application.

## Related pages

- Answer reuse concept: https://mos2es.xyz/concepts/answer-reuse
- Application graph concept: https://mos2es.xyz/concepts/application-graph
- Developer portal: https://mos2es.xyz/developers
- FAQ: https://mos2es.xyz/faq
`,
  '/vs/founderapp': `# AQUA Application Hub vs FounderApp

Application infrastructure is the layer that connects reusable answers, source lineage, fit signals, and review loops across many programs. AQUA Application Hub is built around that layer; FounderApp is built around universal profile autofill. This comparison breaks down where the two overlap and where they diverge.

## Where they overlap

Both tools reduce repetitive data entry across applications. Both let you maintain a persistent profile instead of retyping the same facts into every form. If your only goal is filling in name, role, and company fields faster, either tool helps.

## Where they diverge

AQUA treats each answer as a reusable asset with lineage. When you adapt an answer for a new program, the variant stays connected to its source answer and supporting evidence, so updating the source shows you which variants are affected. FounderApp treats the profile as the single source and autofills from it, without tracking answer-level variants or their provenance.

AQUA also adds fit scoring and Smart Matcher — signals that tell you how well your current profile aligns to a specific program before you start drafting. FounderApp is form-completion oriented: it surfaces forms your profile can fill, not programs you are prepared for. AQUA additionally ships a local MCP server for agent-based workflows, while FounderApp is a closed-source browser product.

## Feature comparison

| Dimension | AQUA Application Hub | FounderApp |
| --- | --- | --- |
| What it is | Reusable application infrastructure — an answer bank, application graph, fit signals, and review loops for accelerators, fellowships, grants, and jobs. | A universal profile that autofills application forms across many destinations. |
| Answer reuse | First-class. Questions and answers are reusable assets with variants kept connected to source material. | Profile-driven autofill; one profile reused across forms rather than answer-level reuse. |
| Lineage tracking | Yes. Each answer variant traces back to its source answer and supporting evidence, so updates propagate to affected variants. | No lineage concept. The profile is the single source; variants are not tracked. |
| Fit scoring | Yes. Fit score combines coverage, theme alignment, criteria match, and answer completeness for a specific program. | No program-level fit score. Autofill is form-completion oriented, not fit-oriented. |
| Opportunity matching | Smart Matcher compares your current profile against a program question surface and identifies coverage gaps before drafting. | Profile-to-form matching; surfaces forms the profile can fill, not programs you fit. |
| MCP / agent integration | Ships a local MCP server exposing answer retrieval, ranking, review-context, stress-test, and write-back for agent environments. | No MCP server. Browser-based autofill is the primary interaction model. |
| Cross-program coverage | Accelerators, fellowships, grants, and jobs share one question surface and answer graph. | Broad form coverage, but treated as independent autofill targets rather than a connected graph. |
| Open source | Public source repository available on GitHub so technical users and agents can inspect the shipped architecture. | Closed source product. |
| Pricing model | Operated by Ello Cello LLC; web app at mos2es.xyz is the canonical surface, local MCP server and developer resources are publicly accessible. | Commercial SaaS pricing on its own surface. |

## When to pick which

Choose FounderApp if your primary need is fast, universal profile autofill across many unrelated forms and you do not need answer lineage, fit scoring, or agent integration. Choose AQUA if you apply to many programs that ask variations of the same underlying questions, you want to preserve why each answer says what it says, and you want fit signals that tell you where you are prepared before you draft.

## Related pages

- Answer reuse: https://mos2es.xyz/concepts/answer-reuse
- Answer lineage: https://mos2es.xyz/concepts/answer-lineage
- Smart Matcher: https://mos2es.xyz/concepts/smart-matcher
- FAQ: https://mos2es.xyz/faq
`,
  '/vs/manual-application-tracking': `# AQUA Application Hub vs Manual Application Tracking

Application infrastructure replaces the manual tracking most founders rely on — spreadsheets, docs, and copy-paste — with a structured answer bank, answer lineage, fit scoring, and Smart Matcher. This comparison shows what manual tracking costs you and what AQUA preserves instead.

## What manual tracking looks like

Manual application tracking usually means a spreadsheet of deadlines, a folder of past applications, and a habit of copying answers from one doc into the next form. It works for a few applications. It breaks down as the number of programs grows: answers drift, evidence disappears, and you can never tell how prepared you are for a new program without rereading everything.

## What AQUA preserves

AQUA stores each answer as a reusable asset in a structured answer bank. When you adapt an answer for a new program, the variant keeps its lineage back to the source answer and its supporting evidence, so you always know why an answer says what it says. Fit scoring tells you how well your current profile aligns to a program, and Smart Matcher shows how much of a program question surface you have already answered before you draft.

The result is time saved per application, evidence that survives between applications, and fit signals that replace guesswork. Reviews and stress tests persist in the application graph instead of vanishing into separate docs.

## Feature comparison

| Dimension | AQUA Application Hub | Manual tracking |
| --- | --- | --- |
| How answers are stored | Structured answer bank. Each answer is a reusable asset with variants and source material. | Copy-pasted into docs, spreadsheets, or note apps. No canonical home; duplicates drift. |
| Time spent per application | Reuse surfaces the best existing answer for a new question; you adapt, not rewrite. | Each application starts from a blank page or a prior doc you hunt down and re-paste. |
| Evidence preserved | Answer lineage connects every variant back to its source answer and supporting evidence. | Evidence lives in your head or scattered files. Why an answer says what it says is lost. |
| Fit signals | Fit score combines coverage, theme alignment, criteria match, and answer completeness per program. | No fit signal. You guess fit by reading the program page and comparing in your head. |
| Reuse across programs | One question surface shared across accelerators, fellowships, grants, and jobs. | Each program is an isolated document; reuse is manual copy-paste with no connection. |
| Coverage tracking | Smart Matcher shows how much of a program question surface you have already answered. | You track coverage manually, if at all, by skimming prior applications. |
| Review history | Persisted reviews and stress tests are attached to answers in the application graph. | Review notes live in separate docs or are never written down. |
| Agent integration | Local MCP server exposes retrieval, ranking, review-context, stress-test, and write-back. | No agent surface. Everything is human-operated copy-paste. |

## When the switch pays off

If you apply to one or two programs once, manual tracking is fine. If you apply to accelerators, fellowships, grants, and jobs repeatedly, the cost of lost evidence, duplicated effort, and invisible fit adds up fast. AQUA is built for the repeated-application case where reuse, lineage, and fit signals compound across programs.

## Related pages

- Answer reuse: https://mos2es.xyz/concepts/answer-reuse
- Build an answer bank: https://mos2es.xyz/guides/how-to-build-an-answer-bank
- FAQ: https://mos2es.xyz/faq
`,
  '/vs/spreadsheets-for-applications': `# AQUA Application Hub vs Spreadsheets for Applications

Application infrastructure is a graph, not a grid. Spreadsheets are flat, manual, and lose the relationships between answers, programs, and evidence. AQUA Application Hub replaces that flat model with an application graph that carries lineage, fit scoring, Smart Matcher, and MCP integration. This comparison shows what you lose with spreadsheets and what AQUA keeps.

## What spreadsheets lose

A spreadsheet can track deadlines and store pasted answers, but it has no concept of relationships. An answer pasted into a cell is a dead copy — it does not link back to the source answer or the evidence behind it. When you reuse that answer for a new program, there is no lineage to update, so improvements to the source never reach the variants. Coverage tracking becomes a manual checklist column, and fit is a guess based on reading program pages.

## What the application graph keeps

AQUA stores questions, answers, applications, fit signals, and review loops as a connected graph. Answer lineage connects every variant to its source, so updating the source shows you which variants are affected. Smart Matcher measures how much of a program question surface you have already answered, and fit score combines coverage, theme alignment, criteria match, and answer completeness into a single signal per program. The local MCP server exposes all of this for agent-based workflows.

## Feature comparison

| Dimension | AQUA Application Hub | Spreadsheets |
| --- | --- | --- |
| Data structure | Application graph linking questions, answers, applications, fit signals, and review loops. | Flat rows and cells. No relationships between answers, programs, or evidence. |
| Answer lineage | Each variant traces back to its source answer and supporting evidence; updates propagate. | No lineage. A pasted answer is a dead copy with no link to where it came from. |
| Coverage tracking | Smart Matcher measures how much of a program question surface you have already answered. | Manual. You build a checklist column and update it by hand, if you remember. |
| Fit signals | Fit score combines coverage, theme alignment, criteria match, and answer completeness. | No fit signal. You sort by deadline and guess fit by reading program pages. |
| Reuse across programs | One question surface shared across accelerators, fellowships, grants, and jobs. | Copy-paste between sheets. Variants are not tracked and drift over time. |
| Opportunity matching | Smart Matcher ranks programs by how well your current profile aligns. | No matching. You maintain a list of programs and decide priority manually. |
| Agent integration | Local MCP server exposes retrieval, ranking, review-context, stress-test, and write-back. | No agent surface. Spreadsheets are human-operated and not programmable. |
| Evidence preservation | Source material stays connected to answers in the graph. | Evidence lives in separate files or cells with no link to the answers it supports. |

## When to move off spreadsheets

A spreadsheet is enough for a single application with no reuse. Once you apply to multiple programs that ask variations of the same questions, the flat model costs you lineage, coverage tracking, and fit signals — the exact things that make reuse compound. AQUA is built for that repeated-application case.

## Related pages

- Application graph: https://mos2es.xyz/concepts/application-graph
- Answer lineage: https://mos2es.xyz/concepts/answer-lineage
- Build an answer bank: https://mos2es.xyz/guides/how-to-build-an-answer-bank
- FAQ: https://mos2es.xyz/faq
`,
}

export const NOT_FOUND_MARKDOWN = `# 404 — Not found

The requested AQUA resource does not exist at this path.

## Where to look next

- Home: https://mos2es.xyz/
- Agent guidance: https://mos2es.xyz/llms.txt
- Sitemap: https://mos2es.xyz/sitemap.xml
- About AQUA: https://mos2es.xyz/about
- Contact: https://mos2es.xyz/contact
- Privacy: https://mos2es.xyz/privacy
- Scoring methodology: https://mos2es.xyz/about/scoring
`
