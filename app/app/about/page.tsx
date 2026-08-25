import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'About AQUA Application Hub',
  description: 'What AQUA Application Hub is, how its reusable application graph works, and where its product boundaries are.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.about).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">About</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Application infrastructure</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">About AQUA Application Hub</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            AQUA turns recurring application questions, reusable answers, opportunity-fit signals, and review history into a portable application graph.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Why the product exists</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Many accelerators, fellowships, grants, jobs, and schools ask different versions of the same underlying questions. Rewriting those answers from scratch wastes time and makes it easier for useful evidence, context, and prior decisions to disappear between applications. AQUA treats questions and answers as reusable assets instead. A user can improve a strong answer over time, create variants for different destinations, and keep those variants connected to the source material that produced them.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The current public wedge is founder and startup opportunity applications. The underlying data model is broader: questions, answers, applications, fit signals, review loops, and reusable identity material can support adjacent application domains without rebuilding the system from zero.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What is in the system</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA includes an answer bank, an application workspace, opportunity fit and readiness signals, imports, bring-your-own-key drafting, persisted reviews, and stress tests. A local MCP server exposes answer retrieval, ranking, review-context, stress-test, and write-back capabilities for power users operating through agent environments. The web application at mos2es.xyz remains the canonical public product surface; agents should not assume that a hosted public MCP endpoint exists.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA is operated by Ello Cello LLC and is part of the broader MO§ES product family. This site is specifically focused on application infrastructure. Its public source repository is available on GitHub so technical users and agents can inspect the shipped architecture rather than relying only on marketing claims.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Product boundaries</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA can organize a user&apos;s source material, calculate internal preparation and fit signals, and help review or reuse that user&apos;s answers. It does not decide who is admitted, funded, hired, or selected. Its scores are decision-support and preparation signals, not acceptance probabilities, external rankings, or endorsements from the organizations represented in the archive.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about/scoring" className="btn-secondary">Scoring methodology</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
          <Link href="/privacy" className="btn-secondary">Privacy</Link>
        </div>
      </main>
    </div>
  )
}
