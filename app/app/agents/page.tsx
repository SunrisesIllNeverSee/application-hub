import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'
import { AGENT_GUIDANCE as G } from '@/lib/agent-guidance.generated.mjs'

// M09b B0.2/B1.1 — the agent guide. Every tool name, tier, count and install
// line comes from lib/agent-guidance.generated.mjs (scripts/gen-agent-guidance.mjs),
// the same data behind /agents.md, /llms.txt and /.well-known/mcp.

export const metadata: Metadata = {
  title: 'Agent Guide — AQUA companion (local-first MCP)',
  description: `How an AI agent helps a user finish an application with AQUA: install the local AQUA companion (stdio MCP, ${G.total} tools), set up a consented workspace, import submitted history, draft, and hand approval to the human in the browser.`,
  robots: { index: true, follow: true },
  alternates: { canonical: '/agents' },
}

const code = 'rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800'
const pre = 'overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900'
const p = 'leading-7 text-neutral-600 dark:text-neutral-300'
const h2 = 'text-2xl font-semibold tracking-tight'
const a = 'text-brand-600 hover:underline dark:text-brand-400'

export default function AgentsPage() {
  const sha = G.companion.tarball.sha256
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.agents).replace(/</g, '\\u003c') }}
      />
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">For AI agents</p>
          <h1 className="text-4xl font-semibold tracking-tight">AQUA agent guide</h1>
          <p className={`max-w-3xl text-lg ${p}`}>
            AQUA is founder-first application infrastructure for answer reuse. It is local-first: a user&rsquo;s
            private answers live in an encrypted vault in their browser and, if they choose, in an encrypted
            companion workspace on their own computer. They are never stored on AQUA&rsquo;s servers. An agent
            helps by running the <strong>AQUA companion</strong> on the user&rsquo;s machine: a command-line tool
            and stdio MCP server with {G.total} tools over one consented workspace plus the public catalog.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Markdown: <a className={a} href="/agents.md">/agents.md</a> · <a className={a} href="/llms.txt">/llms.txt</a> ·{' '}
            <a className={a} href="/llms-full.txt">/llms-full.txt</a> · manifest <a className={a} href="/.well-known/mcp">/.well-known/mcp</a>
          </p>
        </header>

        <section className="space-y-3" id="install">
          <h2 className={h2}>1. Install</h2>
          <p className={p}>Primary: <code className={code}>aqua-mcp-server</code> from npm (Node.js 22 or newer). It includes the companion and serves the same tools.</p>
          <pre className={pre}><code>{G.install.mcp_help}</code></pre>
          <p className={p}>Fallback: the companion also ships as a versioned tarball from this site (no dependencies):</p>
          <pre className={pre}><code>{G.install.help}</code></pre>
          <p className={p}>
            {sha === 'pending' ? (
              <>The sha256 is published at <a className={a} href={G.companion.tarball.sha256_url}>{G.companion.tarball.file}.sha256</a> once the tarball is packed.</>
            ) : (
              <>sha256 <code className={`${code} break-all`}>{sha}</code> (also at <a className={a} href={G.companion.tarball.sha256_url}>{G.companion.tarball.file}.sha256</a>; <a className={a} href={G.companion.tarball.latest_url}>latest.json</a> lists the current version).</>
            )}
          </p>
          <ul className={`list-disc space-y-1 pl-6 ${p}`}>
            <li>
              From a downloaded, verified copy: <code className={code}>{G.install.local_copy}</code> (pass the file with{' '}
              <code className={code}>--package</code>; npx treats a bare absolute <code className={code}>.tgz</code> path as a program and fails).
            </li>
            <li>npm: {G.companion.npm_status}</li>
            <li>{G.mcp_server.status}</li>
            <li>Self-check: <code className={code}>{G.install.doctor}</code></li>
          </ul>
        </section>

        <section className="space-y-3" id="connect">
          <h2 className={h2}>2. Connect it to the agent</h2>
          <pre className={pre}><code>{G.install.mcp_claude_code}</code></pre>
          <p className={p}>Tarball fallback: <code className={code}>{G.install.claude_code}</code></p>
          <p className={p}>
            The server starts even when no workspace exists yet; workspace tools then return{' '}
            <code className={code}>workspace_not_initialized</code> with next steps.{' '}
            <code className={code}>init --path &lt;folder&gt;</code> creates <code className={code}>&lt;folder&gt;/AQUA</code>; the server and the CLI
            find a workspace only through <code className={code}>--workspace</code>, <code className={code}>AQUA_WORKSPACE</code>, or the folder they
            run in (or a parent). After init, re-add the server with the workspace and restart the client:
          </p>
          <pre className={pre}><code>{G.install.mcp_claude_code_with_workspace}</code></pre>
          <p className={p}>
            <code className={code}>--keychain</code> reads the passphrase from a macOS Keychain item the user creates once after init:{' '}
            <code className={code}>security add-generic-password -s aqua-companion -a &lt;workspace id&gt; -w</code> (the workspace id is in{' '}
            <code className={code}>aqua-companion status</code>). Without that item, drop <code className={code}>--keychain</code> and give the server{' '}
            <code className={code}>AQUA_PASSPHRASE</code> in its own environment instead.
          </p>
        </section>

        <section className="space-y-3" id="workspace">
          <h2 className={h2}>3. Workspace setup and consent</h2>
          <ul className={`list-disc space-y-1 pl-6 ${p}`}>
            <li><code className={code}>locate_workspace</code> reports where a workspace is, or would be created.</li>
            <li>
              <code className={code}>init_workspace</code> uses MCP elicitation when the client supports it: the user confirms the folder
              and consent in the client UI, outside the model. Otherwise it returns <code className={code}>requires_human</code> with the exact
              command, for example <code className={code}>aqua-companion init --path &lt;folder&gt;</code>.
            </li>
            <li>The passphrase is typed by the user (terminal prompt, macOS Keychain or the server environment). It never travels through the model or a tool argument.</li>
            <li>The agent reads files only from the workspace <code className={code}>inbox/</code> folder.</li>
          </ul>
        </section>

        <section className="space-y-3" id="tiers">
          <h2 className={h2}>4. Tiers</h2>
          <p className={p}>Every tool declares a tier, and the server enforces it in code.</p>
          <ul className={`list-disc space-y-1 pl-6 ${p}`}>
            {G.tiers.map((t) => (
              <li key={t.tier}><strong>{t.tier}</strong> ({t.count}): {t.meaning}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3" id="history">
          <h2 className={h2}>5. Submitted history</h2>
          <p className={p}>
            The user copies past submitted applications into a folder inside <code className={code}>inbox/</code> (for example{' '}
            <code className={code}>inbox/history/</code>); <code className={code}>{'import_history { folder: "history" }'}</code>{' '}
            stages each answer with its exact question, program, source hash and submission date (unknown dates are flagged, never
            guessed). After <code className={code}>aqua-companion export-backup</code> and Restore, the user confirms them at{' '}
            <Link className={a} href="/history">/history</Link>. Confirmed answers count as approved as of their submission date. Answers
            with unfilled placeholders can never be confirmed; the vault refuses them.
          </p>
        </section>

        <section className="space-y-3" id="approval">
          <h2 className={h2}>6. The human approves in the browser</h2>
          <ol className={`list-decimal space-y-1 pl-6 ${p}`}>
            <li>The user runs <code className={code}>aqua-companion export-backup &lt;file&gt; --workspace &lt;folder&gt;/AQUA</code>.</li>
            <li>In the browser: <Link className={a} href="/aqua-local">AQUA Local</Link>, Restore backup, then review and approve each answer on the review board. Approval binds the exact version hash.</li>
            <li>The user exports a browser backup into the workspace <code className={code}>inbox/</code>.</li>
            <li>The agent runs <code className={code}>sync_from_vault_export</code>; <code className={code}>read_review_status</code> then shows the approvals.</li>
            <li><code className={code}>prepare_packet</code> reports readiness; the user freezes and exports in the browser; <code className={code}>verify_packet</code> checks the export. The agent never submits anything.</li>
          </ol>
        </section>

        <section className="space-y-3" id="catalog">
          <h2 className={h2}>7. Public catalog configuration</h2>
          <p className={p}>
            <a className={a} href="/.well-known/aqua-catalog.json">/.well-known/aqua-catalog.json</a> returns{' '}
            <code className={code}>{`{${G.catalog_config.fields.join(', ')}}`}</code>. The key is the public publishable/anon key the web
            app already ships to every browser. Clients must {G.catalog_config.rule}.
          </p>
          <p className={p}>The companion keeps a public catalog cache: {G.catalog_config.auto_refresh}.</p>
        </section>

        <section className="space-y-3" id="hosted">
          <h2 className={h2}>8. Hosted read-only MCP</h2>
          <p className={p}><code className={code}>{G.hosted_mcp.url}</code>: {G.hosted_mcp.status} ({G.hosted_mcp.scope}).</p>
        </section>

        <section className="space-y-3" id="absent">
          <h2 className={h2}>9. Intentionally absent</h2>
          <ul className={`list-disc space-y-1 pl-6 ${p}`}>
            {G.intentionally_absent.map((x) => (
              <li key={x.name}><code className={code}>{x.name}</code>{x.why ? `: ${x.why}` : ''}</li>
            ))}
            <li>No service-role key, no account token and no hosted private-answer tool exist anywhere in the agent path.</li>
          </ul>
        </section>

        <section className="space-y-3" id="tools">
          <h2 className={h2}>Tools ({G.total})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800"><th className="py-2 pr-4">Tool</th><th className="py-2 pr-4">Tier</th><th className="py-2">What it does</th></tr>
              </thead>
              <tbody>
                {G.tools.map((t) => (
                  <tr key={t.name} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                    <td className="py-2 pr-4"><code className="text-xs">{t.name}</code></td>
                    <td className="py-2 pr-4 whitespace-nowrap">{t.tier}</td>
                    <td className="py-2 text-neutral-600 dark:text-neutral-300">{t.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3" id="journey">
          <h2 className={h2}>The fresh-agent journey</h2>
          <ol className={`list-decimal space-y-1 pl-6 ${p}`}>
            {G.journey.map((j) => (
              <li key={j.step}><strong>{j.step}:</strong> {j.how}</li>
            ))}
          </ol>
        </section>

        <p className="border-t border-neutral-200 pt-6 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          The Contribution Exchange is not part of AQUA; it lives at <a className={a} href="https://signalaf.com/exchange">signalaf.com/exchange</a>.
        </p>
      </main>
    </div>
  )
}
