import Link from 'next/link'
import { APPLICANT_MODES, modeLabel, isModeDeeplyCurated, modeCommunityLabel, modeCommunityDescription, defaultSubmitKindForMode } from '@/lib/applicantMode'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isBetaMode } from '@/lib/beta'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/applications')
  }

  // Fetch top questions for the live archive preview
  const { data: topQuestions } = await supabase
    .from('archived_questions')
    .select('id, text, theme, asked_by_count, significance_score')
    .order('significance_score', { ascending: false })
    .limit(8)

  type ArchiveQuestion = { id: string; text: string; theme: string; asked_by_count: number; significance_score: number }
  const questions = (topQuestions ?? []) as ArchiveQuestion[]
  const THEME_LABELS: Record<string, string> = {
    traction: 'Traction & metrics',
    team: 'Team & leadership',
    vision: 'Vision & market',
    market: 'Vision & market',
    product: 'Product',
    financials: 'Financials',
    impact: 'Impact',
    other: 'Other',
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/60 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-brand-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-semibold tracking-tight">AQUA</span>
              <span className="text-[10px] text-neutral-500 tracking-tight">Applications · Questions · Answers</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            <a href="#archive" className="text-neutral-400 hover:text-neutral-100 transition-colors hidden sm:inline">Archive</a>
            <a href="#compare" className="text-neutral-400 hover:text-neutral-100 transition-colors hidden sm:inline">Compare</a>
            <a href="#mcp" className="text-neutral-400 hover:text-neutral-100 transition-colors hidden sm:inline">MCP</a>
            <a href="#pricing" className="text-neutral-400 hover:text-neutral-100 transition-colors hidden sm:inline">Pricing</a>
            <Link href="/login" className="btn-primary text-xs px-3 py-1.5">Sign in</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 text-center">
          <div className="sm:hidden -mt-4 mb-8 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-neutral-300">
            {[
              ['Archive', '#archive'],
              ['Compare', '#compare'],
              ['MCP', '#mcp'],
              ['Pricing', '#pricing'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="shrink-0 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 hover:border-neutral-700 hover:text-neutral-100 transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            One answer bank — for every application you&apos;ll ever write
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            The question archive
            <br />
            <span className="text-neutral-400">for every application you&apos;ll ever write.</span>
          </h1>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {APPLICANT_MODES.map((mode) => {
              const curated = isModeDeeplyCurated(mode)
              return curated ? (
                <span key={mode} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-600 text-white text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  {modeLabel(mode)} mode
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] uppercase tracking-wider">Live</span>
                </span>
              ) : (
                <Link
                  key={mode}
                  href={`/applications/submit?kind=${defaultSubmitKindForMode(mode)}`}
                  title={modeCommunityDescription(mode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-medium hover:border-amber-700 hover:text-amber-300 transition-colors"
                >
                  {modeLabel(mode)} mode
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px] uppercase tracking-wider">{modeCommunityLabel(mode)}</span>
                </Link>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Built deep on tech startup applications first. Same archive/answer-bank engine across all modes — jobs, schools, and grants ship next.
          </p>
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-neutral-300 leading-relaxed">
            <span className="text-neutral-100">Every applicant faces the same problem</span>: 10 applications, the same 10 essays. AQUA archives every question across <span className="text-neutral-100">accelerators, jobs, schools, and grants</span> — scored by significance — so you build a reusable answer bank that pre-fills across <span className="text-neutral-100">YC, Stripe, Stanford, NSF</span>, and 800+ more.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="btn-primary px-5 py-2.5 text-sm">
              Get started free
            </Link>
            <a href="#mcp" className="btn-secondary px-5 py-2.5 text-sm bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800">
              Connect via MCP
            </a>
          </div>
          <p className="mt-5 text-xs text-neutral-400">
            Free tier · 10 AI drafts/month · No credit card
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs text-neutral-500">Powered by</span>
            <span className="text-xs font-semibold text-neutral-400">MO§ES™</span>
          </div>

          <div className="mt-16 mx-auto max-w-4xl">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-2xl shadow-brand-900/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-neutral-950/60">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                <span className="ml-3 text-xs text-neutral-400 font-mono">mos2es.xyz/hub</span>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-300 text-[10px] font-medium">
                  <span className="w-1 h-1 rounded-full bg-brand-400" />
                  Founder mode · 225 curated questions
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 text-left">
                <aside className="col-span-3 hidden lg:flex flex-col gap-1 p-4 border-r border-neutral-800 bg-neutral-950/40 text-xs">
                  <p className="text-neutral-400 uppercase tracking-wide mb-2 px-2">Archive</p>
                  {['Universal questions', 'Team & leadership', 'Traction & metrics', 'Vision & market', 'Financials'].map((cat, i) => (
                    <div key={cat} className={`px-2 py-1.5 rounded ${i === 0 ? 'bg-brand-600/15 text-brand-300' : 'text-neutral-400'}`}>{cat}</div>
                  ))}
                </aside>
                <div className="col-span-12 lg:col-span-9 p-4 sm:p-5 space-y-2.5">
                  {[
                    { q: 'Tell us about your team.', programs: 28, score: 0.92 },
                    { q: 'What problem are you solving and for whom?', programs: 26, score: 0.89 },
                    { q: 'Why now? Why is this the right time?', programs: 22, score: 0.81 },
                    { q: 'What is your traction so far?', programs: 21, score: 0.78 },
                    { q: 'How will you spend the funding?', programs: 18, score: 0.71 },
                  ].map((row) => (
                    <div key={row.q} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 sm:px-4 py-3 hover:border-neutral-700 transition-colors gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100 leading-snug sm:truncate">{row.q}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{row.programs} programs ask this</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 sm:gap-3">
                        <div className="w-14 sm:w-20 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${row.score * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-brand-300 w-9 text-right">{row.score.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-400">Live preview · Data from the production archive</p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-16">
          <p className="text-center text-xs uppercase tracking-wider text-neutral-400 mb-5">Indexed across · Founder mode</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-neutral-300">
            {['Y Combinator', 'Techstars', 'a16z', 'SBIR', 'NSF', 'MassChallenge', 'Echoing Green', 'First Round', 'Pear VC', 'Hustle Fund', '+ 20 more'].map((p, i) => (
              <span key={p} className={i === 10 ? 'text-neutral-400 font-mono text-xs' : 'hover:text-neutral-100 transition-colors'}>
                {p}
              </span>
            ))}
          </div>
          <p className="mt-8 text-center text-xs uppercase tracking-wider text-neutral-500 mb-3">Coming next · other modes</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
            <span><span className="text-neutral-400">Job-seeker:</span> Greenhouse · Lever · Ashby</span>
            <span className="text-neutral-700">·</span>
            <span><span className="text-neutral-400">Student:</span> Common App · LSAC · AMCAS</span>
            <span className="text-neutral-700">·</span>
            <span><span className="text-neutral-400">Researcher:</span> Grants.gov · NIH · NSF</span>
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">
            Same engine, different vertical. Help us build them out —{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 underline">submit a program</Link>{' '}
            and earn 5 drip unlocks per accepted submission.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-3">Traditional</p>
              <p className="text-lg text-neutral-200 leading-relaxed">
                10 Google Docs. 10 different versions of
                <span className="text-neutral-100"> &ldquo;tell us about your team.&rdquo;</span> Copy-paste hell every deadline.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-600/30 bg-gradient-to-br from-brand-950/40 to-neutral-900/40 p-6">
              <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">AQUA</p>
              <p className="text-lg text-neutral-100 leading-relaxed">
                One answer bank. One canonical answer per universal question. Pre-filled across every program you apply to.
              </p>
            </div>
          </div>
        </section>

        <section id="archive" className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">The archive</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Questions are data. Answers are capital.</h2>
            <p className="mt-4 text-neutral-300 max-w-2xl mx-auto">
              Every question ever asked by any program, stored once and scored by significance. The questions YC actually cares about — and the ones that are filler.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
              <p className="text-4xl font-semibold text-neutral-100">{questions.length > 0 ? `${questions.length}+` : '225'}</p>
              <p className="mt-1 text-xs text-neutral-400 uppercase tracking-wide">Questions archived</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
              <p className="text-4xl font-semibold text-neutral-100">800+</p>
              <p className="mt-1 text-xs text-neutral-400 uppercase tracking-wide">Programs indexed</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
              <p className="text-4xl font-semibold text-neutral-100">
                {questions[0] ? questions[0].significance_score.toFixed(2) : '0.92'}
              </p>
              <p className="mt-1 text-xs text-neutral-400 uppercase tracking-wide">Top significance score</p>
            </div>
          </div>

          {/* Live question list */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-neutral-400 font-medium">Top questions · live from the archive</p>
              <Link href="/login" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Browse all 225 →
              </Link>
            </div>
            <div className="divide-y divide-neutral-800/60">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-800/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-200 group-hover:text-white transition-colors truncate">
                      {q.text}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {q.asked_by_count} program{q.asked_by_count !== 1 ? 's' : ''} ask this
                      {q.theme && THEME_LABELS[q.theme] ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] uppercase tracking-wide">
                          {THEME_LABELS[q.theme]}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-brand-400 tabular-nums">
                      {q.significance_score.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-neutral-800/60 bg-neutral-900/40">
              <p className="text-xs text-neutral-500">
                Showing top {questions.length} by significance score · <Link href="/login" className="text-brand-400 hover:text-brand-300">Sign up to unlock yours →</Link>
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">Answer bank</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Your bank grows every time you show up.</h2>
            <p className="mt-4 text-neutral-300 max-w-2xl mx-auto">
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
                <p className="text-xs font-mono text-neutral-400">{s.step}</p>
                <p className="mt-3 text-lg font-semibold text-neutral-100">{s.title}</p>
                <p className="mt-2 text-sm text-neutral-300 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="compare" className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">How we compare</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">The other ways applicants try to do this.</h2>
            <p className="mt-4 text-neutral-300 max-w-2xl mx-auto">
              Most applicants hack together a workflow from generic tools. Here&apos;s why none of them solve the actual problem.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-neutral-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-neutral-900/60 border-b border-neutral-800">
                  <th className="text-left p-4 font-medium text-neutral-300">Feature</th>
                  <th className="p-4 font-medium text-brand-300">AQUA</th>
                  <th className="p-4 font-medium text-neutral-400">ChatGPT alone</th>
                  <th className="p-4 font-medium text-neutral-400">App consultant</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                {[
                  ['Question archive (225+)', '✓', '—', '—'],
                  ['Significance scoring', '✓', '—', 'Maybe'],
                  ['Auto pre-fill across programs', '✓', '—', '—'],
                  ['Program-specific fit score', '✓', '—', 'Manual'],
                  ['MCP / agent integration', '✓', '—', '—'],
                  ['Reuses your answers as data', '✓', '—', '—'],
                  ['Cost', '$0–49/mo', '$20/mo', '$2k–10k/app'],
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-neutral-800/60 ${i === 6 ? 'bg-neutral-900/40' : ''}`}>
                    <td className="p-4 text-neutral-200 font-medium">{row[0]}</td>
                    <td className="p-4 text-center text-brand-300 font-semibold">{row[1]}</td>
                    <td className="p-4 text-center text-neutral-400">{row[2]}</td>
                    <td className="p-4 text-center text-neutral-400">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="mcp" className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950 p-10 md:p-14">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">For power users</p>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Connect via MCP.</h2>
                <p className="mt-4 text-neutral-300 leading-relaxed">
                  Use Claude Desktop, Cursor, or Windsurf to query the archive directly. Draft answers in your editor. Save to your bank. Never touch our UI if you don&apos;t want to.
                </p>
                <p className="mt-4 text-sm text-neutral-400">
                  21 tools · 7 resources · 3 prompts · Source on GitHub
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 font-mono text-sm">
                <p className="text-neutral-400"># Connect to AQUA</p>
                <p className="mt-2 text-neutral-300">
                  <span className="text-brand-300">npx</span> @modelcontextprotocol/inspector \
                </p>
                <p className="text-neutral-300 pl-3">application-hub-mcp-server</p>
                <p className="mt-3 text-neutral-400"># 225 questions, indexed and queryable</p>
                <p className="text-neutral-400"># Sub-200ms semantic search via pgvector</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Simple. Applicant-friendly.</h2>
            <p className="mt-4 text-neutral-300">No usage traps. No contact-us tier.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8">
              <p className="text-sm font-semibold text-neutral-200">Free</p>
              <p className="mt-2 text-4xl font-semibold">$0</p>
              <p className="text-xs text-neutral-400 mb-6">forever</p>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>· 10 AI drafts/month</li>
                <li>· 2–5 unlocks daily</li>
                <li>· Access to all 800+ programs</li>
                <li>· Answer bank with drip cap</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-brand-600/60 bg-gradient-to-b from-brand-950/40 to-neutral-900/40 p-8 relative">
              <span className="absolute -top-2 left-8 px-2 py-0.5 rounded-full bg-brand-700 text-xs font-medium text-white">{isBetaMode() ? 'Beta — $1/mo' : 'Most popular'}</span>
              <p className="text-sm font-semibold text-brand-300">Pro</p>
              {isBetaMode() ? (
                <p className="mt-2 text-4xl font-semibold">$1<span className="text-base text-neutral-400 font-normal">/mo</span></p>
              ) : (
                <p className="mt-2 text-4xl font-semibold">$19<span className="text-base text-neutral-400 font-normal">/mo</span></p>
              )}
              <p className="text-xs text-neutral-400 mb-6">{isBetaMode() ? '14-day free trial · 30 days free after beta ends' : 'per applicant'}</p>
              <ul className="space-y-2 text-sm text-neutral-200">
                <li>· Unlimited AI drafts</li>
                <li>· All 225 questions unlocked</li>
                <li>· Fit scores + program DNA</li>
                <li>· Heat scores and acceptance signals</li>
                <li>· {isBetaMode() ? '30 days free after beta ends' : 'Priority support'}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8">
              <p className="text-sm font-semibold text-neutral-200">Team</p>
              <p className="mt-2 text-4xl font-semibold">$49<span className="text-base text-neutral-400 font-normal">/mo</span></p>
              <p className="text-xs text-neutral-400 mb-6">per seat</p>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>· Everything in Pro</li>
                <li>· Shared answer library</li>
                <li>· Multi-seat workspaces</li>
                <li>· Team analytics</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-wide text-brand-300 mb-3">Questions</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">The ones applicants actually ask.</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'Is this just another AI writer?',
                a: "No. The AI is downstream. The product is the question archive itself — a graph of what every program asks, scored by how often it shows up. Drafting is one feature; the data structure is the moat.",
              },
              {
                q: 'Where does the question data come from?',
                a: "Manually curated from public application forms across 800+ programs (YC, Techstars, a16z, SBIR, NSF, and more). New programs added monthly. Submissions from users with first-hand application screenshots are credited and reviewed.",
              },
              {
                q: 'What about my answers — is my data private?',
                a: "Yes. Your answer bank is row-level-secured to your account. Service-side migrations and encryption keys are isolated. Bring-your-own-key (BYOK) for AI providers is supported on Pro.",
              },
              {
                q: 'Do you auto-submit applications for me?',
                a: "No. This is a preparation layer, not a submission layer. You still hit Submit on the program's own portal — we just make the work to get there 10× faster.",
              },
              {
                q: 'Does this only work for tech startup applications?',
                a: "No — the engine is general-purpose. Tech startup applications are the first deeply-curated mode (225 questions, 30 programs scored, 800+ indexed). Job-seeker, Student, and Researcher modes run on the same archive/answer-bank/significance-score architecture; full curation for those modes ships next. Submit programs in those verticals today and earn drip unlocks toward your answer bank — the same answer you write for one mode is reusable in every other.",
              },
              {
                q: 'Why MCP instead of a chat sidebar?',
                a: "Because power users already live in Claude Desktop, Cursor, and Windsurf. MCP exposes the archive as a queryable backend so you can draft in your editor, not in our chat box.",
              },
              {
                q: 'Is the free tier actually free?',
                a: "Yes — 10 AI drafts/month and full read access to all 800+ programs and 225 questions. No credit card required. The drip mechanic on the answer bank is the natural ceiling — you grow it daily, or upgrade to unlock everything.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-neutral-800 bg-neutral-900/40 open:bg-neutral-900/60 transition-colors">
                <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 text-neutral-100 font-medium">
                  <span>{item.q}</span>
                  <span className="ml-4 text-neutral-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-neutral-300 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Answer once. Apply everywhere.</h2>
          <p className="mt-4 text-neutral-300">Build your answer bank in 10 minutes. Use it for the next decade.</p>
          <div className="mt-8">
            <Link href="/login" className="btn-primary px-6 py-3 text-sm">
              Start free — no card required
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800/60 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-neutral-100 font-semibold">AQUA</span>
            </Link>
            <p className="text-xs text-neutral-400 leading-relaxed">AI-native infrastructure for accelerator and grant applications.</p>
          </div>
          <div>
            <p className="text-neutral-200 font-semibold mb-3 text-xs uppercase tracking-wide">Product</p>
            <ul className="space-y-2 text-neutral-400">
              <li><a href="#archive" className="hover:text-neutral-100 transition-colors">Archive</a></li>
              <li><a href="#mcp" className="hover:text-neutral-100 transition-colors">MCP server</a></li>
              <li><a href="#pricing" className="hover:text-neutral-100 transition-colors">Pricing</a></li>
              <li><Link href="/about/scoring" className="hover:text-neutral-100 transition-colors">How scores work</Link></li>
              <li><Link href="/login" className="hover:text-neutral-100 transition-colors">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-neutral-200 font-semibold mb-3 text-xs uppercase tracking-wide">Programs</p>
            <ul className="space-y-2 text-neutral-400">
              <li>Y Combinator</li>
              <li>Techstars</li>
              <li>SBIR / NSF</li>
              <li>+ 27 more</li>
            </ul>
          </div>
          <div>
            <p className="text-neutral-200 font-semibold mb-3 text-xs uppercase tracking-wide">Company</p>
            <ul className="space-y-2 text-neutral-400">
              <li><a href="https://ellocello.com" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100 transition-colors">Ello Cello LLC</a></li>
              <li><a href="https://github.com/SunrisesIllNeverSee/application-hub" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100 transition-colors">GitHub</a></li>
              <li><a href="mailto:hello@mos2es.xyz" className="hover:text-neutral-100 transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-neutral-800/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-neutral-400">
            <p>© 2026 Ello Cello LLC. All rights reserved.</p>
            <p>Built in the open · <Link href="/login" className="hover:text-neutral-200 transition-colors">Sign in →</Link></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
