import type { Metadata } from 'next'
import Link from 'next/link'
import { AGENT_GUIDANCE } from '@/lib/agent-guidance.generated.mjs'
// Tool counts come from the generated aqua-mcp-server manifest (vendored with
// the hosted route), so this page can never disagree with the server.
import TOOLS from '../api/mcp/_vendor/TOOLS.json'

type ModeKey = 'stdio-workspace' | 'stdio-catalog' | 'hosted'
const COUNTS = TOOLS.counts as Record<ModeKey, number>
const TIERS = TOOLS.tiers as Record<ModeKey, Record<string, number>>
const tierLine = (m: ModeKey) => Object.entries(TIERS[m]).map(([t, n]) => `${n} ${t}`).join(', ')
const INSTALL = AGENT_GUIDANCE.install as Record<string, string>
const ABSENT = (TOOLS.intentionally_absent as Array<{ name: string; why: string }>)

export const metadata: Metadata = {
  title: 'AQUA MCP server 2.0: local-first agent tools',
  description: `aqua-mcp-server 2.0 gives AI agents your local encrypted AQUA workspace (${COUNTS['stdio-workspace']} tiered tools) and the public AQUA catalog, plus a read-only hosted endpoint at https://aquaidp.xyz/mcp. No account token, no privileged key; approvals happen in the browser.`,
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

const pre = 'overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900'
const p = 'leading-7 text-neutral-600 dark:text-neutral-300'
const card = 'rounded-lg border border-neutral-200 p-4 dark:border-neutral-800'
const a = 'text-brand-600 hover:underline dark:text-brand-400'

const MODES: Array<{ key: ModeKey; name: string; how: string; what: string }> = [
  { key: 'stdio-workspace', name: 'Local, with your workspace', how: 'npx -y aqua-mcp-server --workspace ~/AQUA', what: 'Your encrypted AQUA workspace with tiered tools: search your answer bank, import an application from inbox/, stage drafts, check review status, prepare an export. Plus the public catalog tools.' },
  { key: 'stdio-catalog', name: 'Local, no workspace yet', how: 'npx -y aqua-mcp-server', what: 'The public catalog tools, plus the setup tools (locate_workspace, init_workspace, doctor). init_workspace creates a workspace only after you confirm the folder in your MCP client.' },
  { key: 'hosted', name: 'Hosted, read-only', how: 'https://aquaidp.xyz/mcp', what: 'The public catalog only: approved programs, their exact questions, limits and deadlines. No sign-in, no workspace, nothing private. Rate-limited.' },
]

const TIER_TEXT: Array<[string, string]> = [
  ['read', 'Only reads your workspace or the public catalog.'],
  ['private_write', 'Stages private records in your local workspace (drafts, imports, evidence). Refused with --read-only. Nothing it writes counts as approved.'],
  ['human_consent', 'Acts only after you confirm in your MCP client (creating a workspace). Your passphrase never goes through the agent.'],
  ['human_only', 'Never acts. Returns the steps you take in the AQUA browser app: approve an answer, sign, freeze and export a packet, submit, attest.'],
]

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
            aqua-mcp-server {TOOLS.package_version} lets an AI agent (Claude Code, Claude Desktop, Cursor and
            others) work on your applications from your own computer. Your answers stay in your
            local, encrypted AQUA workspace. The agent can read, match and draft. You approve
            in the AQUA browser app.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Local-first by design</h2>
          <p className={p}>
            The server holds no account token and no privileged database key. Its only credential
            is the public catalog key that this website sends to every browser, and it refuses to
            start with any other key. Private work happens in a workspace on your machine,
            decrypted in memory only, with every agent call recorded in the workspace&rsquo;s own
            audit log. Catalog requests carry only public program ids.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Three ways to connect</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.key} className={card}>
                <h3 className="font-semibold">{m.name}: {COUNTS[m.key]} tools</h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{tierLine(m.key)}</p>
                <p className="mt-2 font-mono text-xs break-all">{m.how}</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{m.what}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Install</h2>
          <p className={p}>
            Node.js 22 or newer. aqua-mcp-server {TOOLS.package_version} is not on npm yet. Until it
            is, the same companion tool set runs from the AQUA companion package published on this
            site. Check its sha256 at <a href={(AGENT_GUIDANCE.companion as { tarball: { sha256_url: string } }).tarball.sha256_url} className={a}>the published checksum</a> first.
          </p>
          <pre className={pre}><code>{`# today: the AQUA companion from aquaidp.xyz
${INSTALL.help}
${INSTALL.init}
${INSTALL.claude_code_with_workspace}

# hosted, read-only public catalog (works now)
claude mcp add --transport http aqua-public https://aquaidp.xyz/mcp

# once aqua-mcp-server ${TOOLS.package_version} is on npm
claude mcp add aqua -- npx -y aqua-mcp-server --workspace ~/AQUA --keychain`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Client configuration</h2>
          <p className={p}>
            Claude Desktop, Cursor, or a project <code className="text-xs">.mcp.json</code>. The workspace passphrase
            comes from the macOS Keychain (<code className="text-xs">--keychain</code>) or the server&rsquo;s
            environment, never from the chat. Add <code className="text-xs">--read-only</code> to allow reading only.
          </p>
          <pre className={pre}><code>{`{
  "mcpServers": {
    "aqua": {
      "command": "npx",
      "args": ["-y", "aqua-mcp-server", "--workspace", "/Users/you/AQUA", "--keychain"]
    },
    "aqua-public": {
      "type": "http",
      "url": "https://aquaidp.xyz/mcp"
    }
  }
}`}</code></pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Tiers</h2>
          <p className={p}>Every tool declares a tier in code, and the server enforces it. Tool descriptions are not what keeps it in line.</p>
          <ul className="space-y-2">
            {TIER_TEXT.map(([t, text]) => (
              <li key={t} className="text-sm text-neutral-600 dark:text-neutral-300">
                <code className="text-xs font-semibold">{t}</code>: {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Where you approve</h2>
          <p className={p}>
            Approvals, signatures, freezing and exporting a packet, and submitting are yours, in the
            AQUA browser app. The agent stages drafts in your workspace. You export a backup, restore it at{' '}
            <Link href="/aqua-local" className={a}>AQUA Local</Link>, and approve each answer on the review
            board, where an approval binds the exact version. Nothing an agent does counts as an approval.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Not available to agents</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
            {ABSENT.map((x) => (
              <li key={x.name}><code className="text-xs">{x.name}</code>: {x.why}</li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Upgrading from 1.x? Versions below 2.0 needed a privileged key and wrote private answers to a hosted store. They are retired. The migration table is in the package README.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">More</h2>
          <ul className="list-disc space-y-2 pl-5 text-neutral-600 dark:text-neutral-300">
            <li><Link href="/agents" className={a}>/agents</Link>: the full agent journey and every tool</li>
            <li><a href="/.well-known/mcp" className={a}>/.well-known/mcp</a>: machine-readable manifest</li>
            <li><a href="/.well-known/aqua-catalog.json" className={a}>/.well-known/aqua-catalog.json</a>: public catalog config (publishable key only)</li>
            <li><a href="/llms.txt" className={a}>/llms.txt</a>: guidance for language models</li>
            <li><a href="https://github.com/SunrisesIllNeverSee/application-hub/tree/main/application-hub-mcp-server" className={a}>application-hub-mcp-server/</a>: source and README</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
