import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, definedTerm } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Smart Matcher — AQUA Application Hub',
  description:
    'Smart Matcher compares your profile against a program question surface, measuring coverage, theme alignment, criteria match, and completeness so you can prioritize where to apply.',
  alternates: { canonical: '/concepts/smart-matcher' },
}

export default function SmartMatcherPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.conceptSmartMatcher).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            definedTerm(
              'Smart Matcher',
              'An AQUA feature that compares a user current profile against a program question surface and identifies how well existing answers align. Measures coverage, theme alignment, criteria match, and answer completeness to help prioritize programs where the user is already strong and identify gaps before drafting begins.',
              '/concepts/smart-matcher',
            ),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/application-infrastructure" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Application Infrastructure</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Smart Matcher</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Concept</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">What is Smart Matcher for applications?</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Smart Matcher is a feature that compares your current profile against a program&apos;s question surface and identifies how well your existing answers align. It measures coverage, theme alignment, criteria match, and answer completeness so you can prioritize programs where you are already strong and spot gaps before you start drafting. AQUA Application Hub uses Smart Matcher as the engine behind fit scoring — it performs the comparison that produces the signal.
          </p>
        </section>

        <section className="space-y-12">
          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">What Smart Matcher measures</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              Smart Matcher evaluates four dimensions when comparing your profile to a program:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Coverage.</strong> How much of the program&apos;s question surface your existing answers already address. High coverage means you can reuse strong answers instead of writing from scratch.</li>
              <li><strong className="text-neutral-900 dark:text-white">Theme alignment.</strong> How well your profile&apos;s themes — market, stage, technology, mission — match the themes the program is known to evaluate and reward.</li>
              <li><strong className="text-neutral-900 dark:text-white">Criteria match.</strong> How directly your answers map to the program&apos;s stated evaluation criteria, not just its surface questions.</li>
              <li><strong className="text-neutral-900 dark:text-white">Completeness.</strong> Whether your answers are full, evidenced, and free of obvious gaps relative to what each question demands.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How Smart Matcher helps prioritize programs</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              Applying to every program that looks interesting is not a strategy — it is a way to burn out. Smart Matcher turns your answer bank into a prioritization tool. For each program, it shows you where you are already strong (high coverage, aligned themes) and where you have gaps (missing questions, weak criteria match). You can rank programs by fit, focus your drafting time on the ones where you are closest to ready, and defer or skip programs where the gap is large. The result is fewer, better-targeted applications instead of scattered effort.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How Smart Matcher differs from admissions predictions</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              Smart Matcher does not predict whether you will be admitted, funded, or hired. It measures alignment between your current profile and what a program asks for — a preparation signal, not an outcome forecast. Admissions decisions depend on the applicant pool, reviewer judgment, program capacity, and unpublished criteria that no tool can see. Smart Matcher tells you where you are prepared and where you are not, so you can decide where to invest your effort. What programs do with what you submit is entirely outside its scope.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/fit-score" className="btn-secondary">Fit Score</Link>
          <Link href="/about/scoring" className="btn-secondary">Scoring methodology</Link>
          <Link href="/guides/how-to-compare-accelerator-fit" className="btn-secondary">Guide: Compare Fit</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
