import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'
import { AGENT_GUIDANCE as G } from '@/lib/agent-guidance.generated.mjs'

export const metadata: Metadata = {
  title: 'AQUA Application Hub Developer Portal — API, MCP, OpenAPI',
  description: `Developer resources for AQUA Application Hub at aquaidp.xyz: OpenAPI spec, REST API, the local AQUA companion (stdio MCP, ${G.total} tools), authentication, Appfeeder extension, and agent integration guidance.`,
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
            An application infrastructure API lets developers programmatically access reusable application answers, opportunity fit scoring, and application graph data. The AQUA Application Hub REST API exposes these capabilities with typed operations, the local AQUA companion (a stdio MCP server with {G.total} tools) for agent environments, and a deferred Appfeeder capture integration. Public discovery routes are available without authentication; user-account endpoints require a Supabase session cookie or Bearer JWT.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Quickstart</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Public discovery APIs are available without authentication; private account APIs require a session or Bearer JWT. Under local-first mode, legacy hosted private-answer write routes refuse requests (HTTP 403 with local_first:true).
            Sign in at <Link href="/login" className="text-brand-600 hover:underline dark:text-brand-400">/login</Link> to get
            a session cookie, or retrieve a Bearer JWT from <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">GET /api/auth/token</code> for
            the browser extension. Agents never need a JWT: they work through the local AQUA companion. Start with the OpenAPI document for typed operations and error models.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`# Get your auth token (requires active session)
curl https://aquaidp.xyz/api/auth/token

# The local-first MCP manifest and the public catalog configuration
curl https://aquaidp.xyz/.well-known/mcp
curl https://aquaidp.xyz/.well-known/aqua-catalog.json

# Private answer matching happens in the local vault, not
# /api/match-question — that route returns 403 under local-first.

# Read the OpenAPI spec
curl https://aquaidp.xyz/openapi.json | jq .info`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">OpenAPI specification</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The full OpenAPI 3.0.3 document is published at{' '}
            <a href="/openapi.json" className="text-brand-600 hover:underline dark:text-brand-400">/openapi.json</a>.
            It documents 10 operations across matching, applications, answers, hub,
            review, drafting, and auth. Every operation has a unique operationId,
            typed request/response schemas, and documented error models. Some legacy private-write operations are listed for compatibility but refuse with HTTP 403 in local-first mode.
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
              <h3 className="font-semibold">Bearer JWT (browser extension)</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Send <code className="text-xs">Authorization: Bearer &lt;JWT&gt;</code> with API requests.
                Get the JWT from <code className="text-xs">GET /api/auth/token</code> while logged in.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 id="mcp" className="text-2xl font-semibold tracking-tight">MCP server: the local AQUA companion</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Agents work through the AQUA companion, a zero-dependency command-line tool and stdio MCP
            server the user runs on their own machine. It works on one consented, encrypted workspace
            plus the public catalog, holds no account token and no database key, and cannot approve,
            sign, freeze, export or submit anything: the human approves in the browser review. It
            registers {G.total} tools ({G.tiers.map((t) => `${t.count} ${t.tier}`).join(', ')}); tiers are enforced in code.
            The full guide is at{' '}
            <Link href="/agents" className="text-brand-600 hover:underline dark:text-brand-400">/agents</Link>.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`# Install (versioned tarball from this site; Node.js 22+)
${G.install.help}

# Connect Claude Code (the server starts without a workspace)
${G.install.claude_code}

# Self-check: config, catalog, workspace, keychain
${G.install.doctor}`}</code></pre>
          <ul className="list-disc space-y-1 pl-6 text-sm text-neutral-600 dark:text-neutral-300">
            <li>npm: {G.companion.npm_status}</li>
            <li>{G.mcp_server.status}</li>
            <li>Hosted read-only MCP at <code className="text-xs">{G.hosted_mcp.url}</code>: {G.hosted_mcp.status}.</li>
            <li>Public catalog configuration: <a href="/.well-known/aqua-catalog.json" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/aqua-catalog.json</a> (publishable/anon key only).</li>
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            {G.tiers.map((t) => (
              <div key={t.tier} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <h3 className="font-semibold">{t.tier} ({t.count})</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{t.meaning}</p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {G.tools.filter((x) => x.tier === t.tier).map((x) => x.name).join(', ')}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            The machine-readable manifest is at{' '}
            <a href="/.well-known/mcp" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/mcp</a>.
            Source: <a href="https://github.com/SunrisesIllNeverSee/application-hub/tree/main/aqua-companion" className="text-brand-600 hover:underline dark:text-brand-400">aqua-companion/</a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Appfeeder browser extension</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Appfeeder source is preserved, but its hosted capture and matching endpoints
            refuse private-content operations while local-first is active. The extension
            capture workflow is deferred; a JWT does not override those privacy guards.
            Its legacy paths include <code className="text-xs">/api/answers/capture</code> and{' '}
            <code className="text-xs">/api/match-question</code>.
            Source is in the repository under <code className="text-xs">appfeeder/</code>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Error handling</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Many API errors use a ProblemDetails shape (RFC 9457) with
            machine-readable <code className="text-xs">error</code> codes, human-readable{' '}
            <code className="text-xs">title</code> and <code className="text-xs">detail</code>, and a{' '}
            <code className="text-xs">resolution</code> hint suggesting the next step.
            Local-first refusals may instead return a compact JSON response with <code className="text-xs">local_first: true</code>.
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
            The step-by-step agent path is the{' '}
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
            The agent companion is in <code className="text-xs">aqua-companion/</code>, the
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
