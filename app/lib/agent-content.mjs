export const MARKDOWN_PAGES = {
  '/': `# AQUA Application Hub

AQUA is founder-first application infrastructure operated by Ello Cello LLC. It turns recurring application questions, reusable answers, opportunity fit signals, and review history into a portable application graph. The public product is available at https://mos2es.xyz.

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

AQUA is application infrastructure built around a simple observation: many applications ask different versions of the same underlying questions. Rewriting those answers from scratch loses time, evidence, and consistency. AQUA stores questions and answers as reusable assets, keeps variants connected to their sources, and helps a user see which opportunities can already be answered from material they have developed.

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

AQUA uses defined internal signals to help users understand preparation and opportunity fit. The system measures structured data consistently; it does not claim that an internal score is objective truth or an admissions prediction.

## Significance Score

Significance describes how structurally important a question appears across the program archive. Signals can include how often a question is asked, its word-limit weight, theme prestige, and whether it is broadly reusable. It does not grade the quality of an individual user's answer.

## Fit Score

Fit describes how well the user's current profile and answer coverage align with the question surface and themes of a specific program. Coverage, theme alignment, criteria match, and answer completeness contribute to the signal. A fit score does not predict acceptance; programs make their own decisions using information outside AQUA's model.

## Composite, heat, and program value

Composite scoring combines personal fit with an estimated program-value signal to help sort opportunities for one user. Heat is a structural desirability signal when personalized fit data is thin. Program value is an estimate derived from factors such as brand, network, check size, and terms. These are product navigation signals, not universal rankings.

## Boundaries

AQUA does not decide who gets into a program, does not expose a leaderboard ranking founders against one another, and does not represent any accelerator, grantmaker, employer, school, or fellowship listed in the archive. The detailed human-readable methodology is available at https://mos2es.xyz/about/scoring.
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
