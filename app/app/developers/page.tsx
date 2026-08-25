import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA Application Hub Developer Portal — API, MCP, OpenAPI',
  description:
    'Developer resources for AQUA Application Hub at mos2es.xyz: OpenAPI spec, REST API, MCP server with 27 tools, authentication, Appfeeder extension, and agent integration guidance.',
  alternates: { canonical: '/developers' },
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.developers).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Developers</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl space-y-12 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">AQUA Application Hub Developers</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">AQUA developer portal</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            An application infrastructure API lets developers programmatically access reusable application answers, opportunity fit scoring, and application graph data. The AQUA Application Hub REST API exposes these capabilities with typed operations, a local MCP server with 27 tools for agent environments, and an Appfeeder browser extension for capturing answers from program websites. All REST routes require a Supabase session cookie or Bearer JWT.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Quickstart</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA is an authenticated product — there is no unauthenticated public API.
            Sign in at <Link href="/login" className="text-brand-600 hover:underline dark:text-brand-400">/login</Link> to get
            a session cookie, or retrieve a Bearer JWT from <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">GET /api/auth/token</code> for
            extension or agent use. Start with the OpenAPI document for typed operations and error models.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`# Get your auth token (requires active session)
curl https://mos2es.xyz/api/auth/token

# Match a question against your answer bank
curl -X POST https://mos2es.xyz/api/match-question \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <JWT>" \\
  -d '{"text": "Tell us what you have built", "limit": 5}'

# Read the OpenAPI spec
curl https://mos2es.xyz/openapi.json | jq .info`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">OpenAPI specification</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The full OpenAPI 3.0.3 document is published at{' '}
            <a href="/openapi.json" className="text-brand-600 hover:underline dark:text-brand-400">/openapi.json</a>.
            It documents 10 operations across matching, applications, answers, hub,
            review, drafting, and auth. Every operation has a unique operationId,
            typed request/response schemas, and ProblemDetails error models
            (RFC 9457).
          </p>
          <ul className="list-disc space-y-1 pl-6 text-neutral-600 dark:text-neutral-300">
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">matchQuestion</code> — match a question against the user answer bank</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">intakeApplication</code> — ingest raw application text and extract questions</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">captureAnswer</code> — capture an answer from a form field (extension)</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">smartMatcher</code> — compute fit scores for a target program</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">checkAutofillEligibility</code> — check auto-fill eligibility thresholds</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">stressTestAnswer</code> — run a reviewer-persona stress test</li>
            <li><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">generateDraft</code> — generate a draft answer via BYOK or platform LLM</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 id="authentication" className="text-2xl font-semibold tracking-tight">Authentication</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA uses Supabase Auth. Two credential types are accepted:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Session cookie (browser)</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                After login at /login, Supabase sets an <code className="text-xs">sb-access-token</code> cookie.
                The web app and browser extension use this automatically.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Bearer JWT (extension/agent)</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Send <code className="text-xs">Authorization: Bearer &lt;JWT&gt;</code> with API requests.
                Get the JWT from <code className="text-xs">GET /api/auth/token</code> while logged in.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 id="mcp" className="text-2xl font-semibold tracking-tight">MCP server</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The AQUA MCP server exposes 27 tools across programs, questions,
            rankings, intelligence, and user-authenticated operations. It runs
            locally via stdio (Claude Desktop, Cursor, Windsurf) or self-hosted
            via Streamable HTTP transport. There is no public hosted MCP endpoint
            at mos2es.xyz — the server runs in the user agent environment and
            connects to the user Supabase session.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The MCP manifest is published at{' '}
            <a href="/.well-known/mcp" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/mcp</a>.
            Source code is in the repository under{' '}
            <a href="https://github.com/SunrisesIllNeverSee/application-hub/tree/main/application-hub-mcp-server" className="text-brand-600 hover:underline dark:text-brand-400">application-hub-mcp-server/</a>.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`# Install via npm (published)
npm install -g application-hub-mcp-server

# Or run directly without installing
npx -y application-hub-mcp-server

# Or clone and build from source
git clone https://github.com/SunrisesIllNeverSee/application-hub
cd application-hub/application-hub-mcp-server
npm install && npm run build
node dist/index.js

# Run via Streamable HTTP (self-hosted)
TRANSPORT=http PORT=3000 node dist/index.js`}</code></pre>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Public tools (11)</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Program search, detail, rankings, heat scores, questions, similar
                questions, universal questions, program DNA, question significance,
                acceptance stats. No auth required.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Authenticated tools (16)</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Profile answers, application readiness, fit score, find best
                programs, rank answers, log draft runs, save answers, review
                context, stress test, intake, fill, borrow threshold, answer bank
                search. Requires Supabase JWT.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Appfeeder browser extension</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The Appfeeder Chrome extension captures answers directly from
            application form fields. It uses the <code className="text-xs">/api/answers/capture</code> and{' '}
            <code className="text-xs">/api/match-question</code> endpoints with a Bearer JWT.
            Source is in the repository under <code className="text-xs">appfeeder/</code>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Error handling</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            All API error responses use a ProblemDetails shape (RFC 9457) with
            machine-readable <code className="text-xs">error</code> codes, human-readable{' '}
            <code className="text-xs">title</code> and <code className="text-xs">detail</code>, and a{' '}
            <code className="text-xs">resolution</code> hint suggesting the next step.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`{
  "error": "Unauthorized",
  "title": "Authentication required",
  "status": 401,
  "detail": "A valid Supabase session cookie or Bearer JWT is required.",
  "resolution": "Sign in at /login or include Authorization: Bearer <JWT>"
}`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Agent integration</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            For agent guidance including when-to-use, how-to-use, limitations,
            and Markdown content negotiation, see{' '}
            <a href="/llms.txt" className="text-brand-600 hover:underline dark:text-brand-400">llms.txt</a>.
            For Contribution Exchange behavior, see the{' '}
            <a href="/agents" className="text-brand-600 hover:underline dark:text-brand-400">agent guide</a>.
            The MCP manifest at{' '}
            <a href="/.well-known/mcp" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/mcp</a> describes
            the tool surface in machine-readable form.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Repository</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Full source code is available at{' '}
            <a href="https://github.com/SunrisesIllNeverSee/application-hub" className="text-brand-600 hover:underline dark:text-brand-400">github.com/SunrisesIllNeverSee/application-hub</a>.
            The MCP server is in <code className="text-xs">application-hub-mcp-server/</code>, the
            Next.js app is in <code className="text-xs">app/</code>, and the Appfeeder extension is
            in <code className="text-xs">appfeeder/</code>.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/openapi.json" className="btn-secondary">OpenAPI spec</Link>
          <Link href="/.well-known/mcp" className="btn-secondary">MCP manifest</Link>
          <a href="/llms.txt" className="btn-secondary">Agent guidance (llms.txt)</a>
          <Link href="/about" className="btn-secondary">About AQUA</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
        </div>
      </main>
    </div>
  )
}
