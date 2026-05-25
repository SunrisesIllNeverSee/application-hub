import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const logos = ['Y Combinator', 'Techstars', 'a16z', '500 Global', 'Stanford', 'NSF', 'Stripe', 'Google']

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/applications')

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800/70 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight">AQUA</Link>
          <nav className="flex items-center gap-5 text-sm text-neutral-400">
            <a className="hidden transition-colors hover:text-neutral-100 sm:inline" href="#matcher">Smart Matcher</a>
            <a className="hidden transition-colors hover:text-neutral-100 sm:inline" href="#features">Features</a>
            <Link className="btn-primary px-3 py-1.5 text-xs" href="/login">Start Free</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1fr_520px] lg:pb-24 lg:pt-24">
          <div className="flex flex-col justify-center">
            <h1 className="text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
              APPLICATIONS.
              <br />
              QUESTIONS.
              <br />
              ANSWERS.
            </h1>
            <p className="mt-5 bg-gradient-to-r from-brand-300 via-cyan-200 to-emerald-200 bg-clip-text text-7xl font-bold leading-none tracking-tight text-transparent md:text-8xl">
              AQUA
            </p>
            <p className="mt-7 max-w-xl text-xl leading-8 text-neutral-300">
              One answer bank — for every application you&apos;ll ever write.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-neutral-300">
              {['Commitment Engine', 'Multi-Mode', 'Governed Answers'].map((item) => (
                <span key={item} className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">{item}</span>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="btn-primary px-5 py-3">Start Free — Seed Your Bank</Link>
              <a href="#matcher" className="btn-secondary border border-neutral-800 bg-neutral-900 px-5 py-3 text-neutral-100 hover:bg-neutral-800">See Smart Matcher</a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-brand-600/25 via-cyan-500/10 to-emerald-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-brand-950/40">
              <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                <span className="ml-3 font-mono text-xs text-neutral-500">canonical-hub/aqua</span>
              </div>
              <div className="grid gap-0 md:grid-cols-[170px_1fr]">
                <aside className="hidden border-r border-neutral-800 bg-neutral-950/60 p-4 text-xs text-neutral-400 md:block">
                  {['Applications', 'Questions', 'Answers', 'Variants', 'Lineage'].map((item, index) => (
                    <div key={item} className={`mb-1 rounded px-2 py-2 ${index === 0 ? 'bg-brand-600/20 text-brand-200' : ''}`}>{item}</div>
                  ))}
                </aside>
                <div className="space-y-3 p-4">
                  {[
                    ['YC W26', '87 fit', 'Tell us what you have built.'],
                    ['NSF SBIR', '82 fit', 'Describe the technical innovation.'],
                    ['Stanford Seed', '79 fit', 'What change will your work create?'],
                  ].map(([entity, fit, question]) => (
                    <div key={entity} className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 transition-all duration-300 hover:border-brand-700">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-neutral-100">{entity}</p>
                        <span className="font-mono text-xs text-brand-300">{fit}</span>
                      </div>
                      <p className="mt-2 text-sm text-neutral-400">{question}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                        <div className="h-full w-4/5 rounded-full bg-brand-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-neutral-900 bg-neutral-950 px-4 py-10 sm:px-6">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-neutral-500">Trusted at top accelerators, universities and companies</p>
          <div className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-neutral-300">
            {logos.map((logo) => <span key={logo}>{logo}</span>)}
          </div>
        </section>

        <section id="matcher" className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight">Smart Matcher turns your answer bank into a fit engine.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-neutral-300">
              AQUA reads your canonical commitments, checks coverage and fidelity, then ranks applications by where your existing proof is strongest.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-neutral-300">
              {['60%+ bank coverage unlocks one-click manual pre-fill', '85%+ fidelity plus outcome data unlocks premium auto-fill', 'Lineage preserves every source, variant, and export'].map((item) => (
                <div key={item} className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            {[
              ['AQUA Fit', '92', 'Y Combinator asks 14 canonicals already covered by your bank.'],
              ['Fidelity', '0.88', 'Highest variant maps cleanly to team, traction, and problem commitments.'],
              ['Deadline', '18d', 'Package export is ready; review before portal entry.'],
            ].map(([label, value, body]) => (
              <div key={label} className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4 last:mb-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="font-mono text-xl font-semibold text-brand-300">{value}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ['Commitment Conservation', 'Every answer maps back to a canonical commitment, so variants stay useful without losing the original proof.'],
              ['Living Archive', 'Applications, questions, answers, packages, rewards, and exports share one lineage graph.'],
              ['Pay-to-Seed', 'High-quality first loads can earn credits or payout-ready rewards after review gates.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-700">
                <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-24 text-center sm:px-6">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Own your application capital.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-neutral-300">
            Fill once, improve continuously, apply everywhere.
          </p>
          <Link href="/login" className="btn-primary mt-8 px-6 py-3">Start Free</Link>
        </section>
      </main>
    </div>
  )
}
