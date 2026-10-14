import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AQUA MCP Server — 31 tools for agent environments',
  description:
    'The AQUA MCP server exposes 31 tools across programs, questions, rankings, and applicant intelligence over stdio or self-hosted Streamable HTTP. Local-first mode refuses private writes to the hosted hub.',
  alternates: { canonical: '/mcp' },
}

const BREADCRUMB = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aquaidp.xyz/' },
    { '@type': 'ListItem', position: 2, name: 'MCP Server', item: 'https://aquaidp.xyz/mcp' },
  ],
}

export default function McpPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/developers" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Developers</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">MCP</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl space-y-12 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">AQUA Application Hub</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">AQUA MCP server</h1>
          <p className="text-lg leading-7 text-neutral-600 dark:text-neutral-300">
            A local/stdio Model Context Protocol server exposing 31 tools across
            programs, questions, rankings, and applicant intelligence — for Claude
            Desktop, Cursor, Windsurf, and other agent environments.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">What it is</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The server runs in the user&rsquo;s agent environment and connects to
            the user&rsquo;s Supabase session. There is no public hosted MCP
            endpoint at aquaidp.xyz — the server is deliberately local: stdio for
            agent clients, or self-hosted Streamable HTTP for your own tooling.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The machine-readable manifest is published at{' '}
            <a href="/.well-known/mcp" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/mcp</a>.
            Source code is in the repository under{' '}
            <a href="https://github.com/SunrisesIllNeverSee/application-hub/tree/main/application-hub-mcp-server" className="text-brand-600 hover:underline dark:text-brand-400">application-hub-mcp-server/</a>{' '}
            and on npm as <code className="text-xs">aqua-mcp-server</code>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Install &amp; run</h2>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`# npm (published)
npm install -g aqua-mcp-server

# Run directly without installing
npx -y aqua-mcp-server

# Or build from source
git clone https://github.com/SunrisesIllNeverSee/application-hub
cd application-hub/application-hub-mcp-server
npm ci && npm run build
node dist/index.js

# Self-hosted Streamable HTTP
TRANSPORT=http PORT=3000 node dist/index.js`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Client configuration</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Claude Desktop (<code className="text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>),
            Cursor (<code className="text-xs">~/.cursor/mcp.json</code>), or Windsurf
            (<code className="text-xs">~/.codeium/windsurf/mcp_config.json</code>):
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"><code>{`{
  "mcpServers": {
    "aqua": {
      "command": "npx",
      "args": ["-y", "aqua-mcp-server"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_ACCESS_TOKEN": "your-session-jwt"
      }
    }
  }
}`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Public — 11 tools</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Program search, detail, slug lookup, rankings, heat scores,
                questions, similar questions, universal questions, program DNA,
                question significance, acceptance stats. No auth required.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Authenticated — 14 tools</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Profile answers, application readiness, fit score, best programs,
                rank answers, draft runs, save answers, review context, stress
                test, intake, fill, borrow threshold, answer bank search.
                Requires a Supabase session JWT.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Canonical hub — 6 tools</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                The <code className="text-xs">aqua.*</code> family bridges to the
                hosted canonical hub. Under local-first mode, private-write tools
                return explicit refusals instead of transmitting user content.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Local-first mode</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Set <code className="text-xs">AQUA_LOCAL_FIRST=1</code> in the server
            environment to enable local-first mode. Private-write tools
            (<code className="text-xs">aqua.ingest_application</code>,{' '}
            <code className="text-xs">aqua.process_reward</code>,{' '}
            <code className="text-xs">aqua.qualify_answer</code>, and similar)
            return an explicit refusal instead of sending user content to the
            hosted hub. Read and discovery tools remain available. This mirrors
            the web app&rsquo;s local-first custody model — private answer
            content stays on the user&rsquo;s device.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">More</h2>
          <ul className="list-disc space-y-2 pl-5 text-neutral-600 dark:text-neutral-300">
            <li><a href="/.well-known/mcp" className="text-brand-600 hover:underline dark:text-brand-400">/.well-known/mcp</a> — machine-readable manifest</li>
            <li><a href="/openapi.json" className="text-brand-600 hover:underline dark:text-brand-400">/openapi.json</a> — REST API specification</li>
            <li><Link href="/developers" className="text-brand-600 hover:underline dark:text-brand-400">/developers</Link> — REST API, authentication, extension docs</li>
            <li><a href="https://github.com/SunrisesIllNeverSee/application-hub" className="text-brand-600 hover:underline dark:text-brand-400">GitHub repository</a> — source + issues</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
