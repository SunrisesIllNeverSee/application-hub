import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/hub')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight">Application Hub</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#archive" className="text-neutral-400 hover:text-neutral-100 transition-colors">Archive</a>
            <a href="#mcp" className="text-neutral-400 hover:text-neutral-100 transition-colors">MCP</a>
            <a href="#pricing" className="text-neutral-400 hover:text-neutral-100 transition-colors">Pricing</a>
            <Link href="/login" className="btn-primary text-xs px-3 py-1.5">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          AI-native infrastructure for founder applications
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          The question archive
          <br />
          <span className="text-neutral-500">for founders.</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-neutral-400 leading-relaxed">
          Founders apply to 10+ programs and answer the same questions 10+ times. Application Hub archives every question, scores it by significance, and lets you build a reusable answer bank that pre-fills across <span className="text-neutral-200">YC, Techstars, SBIR</span>, and 27 more.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login" className="btn-primary px-5 py-2.5 text-sm">
            Get started free
          </Link>
          <a href="#mcp" className="btn-secondary px-5 py-2.5 text-sm bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800">
            Connect via MCP
          </a>
        </div>
        <p className="mt-5 text-xs text-neutral-600">
          Free tier · 10 AI drafts/month · No credit card
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">Traditional</p>
            <p className="text-lg text-neutral-300 leading-relaxed">
              10 Google Docs. 10 different versions of
              <span className="text-neutral-100"> &ldquo;tell us about your team.&rdquo;</span> Copy-paste hell every deadline.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-600/30 bg-gradient-to-br from-brand-950/40 to-neutral-900/40 p-6">
            <p className="text-xs uppercase tracking-wide text-brand-400 mb-3">Application Hub</p>
            <p className="text-lg text-neutral-100 leading-relaxed">
              One answer bank. One canonical answer per universal question. Pre-filled across every program you apply to.
            </p>
          </div>
        </div>
      </section>

      <section id="archive" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-wide text-brand-400 mb-3">The archive</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Questions are data. Answers are capital.</h2>
          <p className="mt-4 text-neutral-400 max-w-2xl mx-auto">
            Every question ever asked by any program, stored once and scored by significance. The questions YC actually cares about — and the ones that are filler.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
            <p className="text-4xl font-semibold text-neutral-100">225</p>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wide">Questions archived</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
            <p className="text-4xl font-semibold text-neutral-100">30</p>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wide">Programs indexed</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
            <p className="text-4xl font-semibold text-neutral-100">0.92</p>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wide">Top significance score</p>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Sample archived question</p>
              <p className="text-lg text-neutral-100 font-medium">Tell us about your team.</p>
              <p className="mt-2 text-sm text-neutral-400">Asked by 28 of 30 programs · Universal across stages and sectors</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-neutral-500">Significance</p>
              <p className="text-2xl font-semibold text-brand-400">0.92</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-wide text-brand-400 mb-3">Answer bank</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Your bank grows every time you show up.</h2>
          <p className="mt-4 text-neutral-400 max-w-2xl mx-auto">
            Sign up, unlock 10 questions. Come back daily, unlock 2–5 more. Pro tier unlocks all 225 immediately. The most significant questions surface first.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: '01', title: 'Sign up', body: 'Unlock 10 universal questions, ranked by how often programs ask them.' },
            { step: '02', title: 'Show up', body: 'Daily unlocks grow your bank. Each answer is reused across every applicable program.' },
            { step: '03', title: 'Apply anywhere', body: 'Open a program — your existing answers pre-fill. Fit score shows where you’re strong.' },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
              <p className="text-xs font-mono text-neutral-600">{s.step}</p>
              <p className="mt-3 text-lg font-semibold text-neutral-100">{s.title}</p>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="mcp" className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950 p-10 md:p-14">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-brand-400 mb-3">For power users</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Connect via MCP.</h2>
              <p className="mt-4 text-neutral-400 leading-relaxed">
                Use Claude Desktop, Cursor, or Windsurf to query the archive directly. Draft answers in your editor. Save to your bank. Never touch our UI if you don&apos;t want to.
              </p>
              <p className="mt-4 text-sm text-neutral-500">
                20 tools · 7 resources · 3 prompts · Source on GitHub
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 font-mono text-sm">
              <p className="text-neutral-600">$ Connect to Application Hub</p>
              <p className="mt-2 text-neutral-300">
                <span className="text-brand-400">npx</span> @modelcontextprotocol/inspector \
              </p>
              <p className="text-neutral-300 pl-3">application-hub-mcp-server</p>
              <p className="mt-3 text-neutral-600"># 225 questions, indexed and queryable</p>
              <p className="text-neutral-600"># Sub-200ms semantic search via pgvector</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-wide text-brand-400 mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Simple. Founder-friendly.</h2>
          <p className="mt-4 text-neutral-400">No usage traps. No contact-us tier.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8">
            <p className="text-sm font-semibold text-neutral-200">Free</p>
            <p className="mt-2 text-4xl font-semibold">$0</p>
            <p className="text-xs text-neutral-500 mb-6">forever</p>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>· 10 AI drafts/month</li>
              <li>· 2–5 unlocks daily</li>
              <li>· Access to all 30 programs</li>
              <li>· Answer bank with drip cap</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-brand-600/60 bg-gradient-to-b from-brand-950/40 to-neutral-900/40 p-8 relative">
            <span className="absolute -top-2 left-8 px-2 py-0.5 rounded-full bg-brand-600 text-xs font-medium text-white">Most popular</span>
            <p className="text-sm font-semibold text-brand-300">Pro</p>
            <p className="mt-2 text-4xl font-semibold">$19<span className="text-base text-neutral-500 font-normal">/mo</span></p>
            <p className="text-xs text-neutral-500 mb-6">per founder</p>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li>· Unlimited AI drafts</li>
              <li>· All 225 questions unlocked</li>
              <li>· Fit scores + program DNA</li>
              <li>· Heat scores and acceptance signals</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8">
            <p className="text-sm font-semibold text-neutral-200">Team</p>
            <p className="mt-2 text-4xl font-semibold">$49<span className="text-base text-neutral-500 font-normal">/mo</span></p>
            <p className="text-xs text-neutral-500 mb-6">per seat</p>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>· Everything in Pro</li>
              <li>· Shared answer library</li>
              <li>· Multi-seat workspaces</li>
              <li>· Team analytics</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Answer once. Apply everywhere.</h2>
        <p className="mt-4 text-neutral-400">Build your answer bank in 10 minutes. Use it for the next decade.</p>
        <div className="mt-8">
          <Link href="/login" className="btn-primary px-6 py-3 text-sm">
            Start free — no card required
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-800/60 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-neutral-600">
          <p>Built by <a href="https://ellocello.com" className="text-neutral-400 hover:text-neutral-200 transition-colors" target="_blank" rel="noopener noreferrer">Ello Cello LLC</a></p>
          <p>© 2026 · <Link href="/login" className="hover:text-neutral-200">Sign in</Link></p>
        </div>
      </footer>
    </div>
  )
}
