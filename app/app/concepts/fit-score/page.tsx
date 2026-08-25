import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, definedTerm } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Opportunity Fit Score — AQUA Application Hub',
  description:
    'Opportunity fit scoring measures how well your profile aligns to a program across four dimensions: coverage, theme alignment, criteria match, and answer quality.',
  alternates: { canonical: '/concepts/fit-score' },
}

export default function FitScorePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.conceptFitScore).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            definedTerm(
              'Opportunity Fit Score',
              'A measure of how well a user current profile aligns to a specific program. Combines four dimensions: coverage of the program question surface (40%), theme alignment (35%), criteria match (15%), and a quality signal from answer completeness (10%). A fit score is a decision-support signal, not a prediction of acceptance.',
              '/concepts/fit-score',
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
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Fit Score</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Concept</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">What is opportunity fit scoring?</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Opportunity fit scoring measures how well your current profile aligns to a specific program. It combines four dimensions — coverage of the program question surface, theme alignment, criteria match, and answer quality — into a single signal that tells you where you are prepared relative to what the program measures. AQUA Application Hub computes fit scores to help you prioritize programs where you are already strong and identify gaps before you start drafting.
          </p>
        </section>

        <section className="space-y-12">
          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">The four dimensions of fit</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              A fit score is not a single number pulled from intuition. It is a weighted combination of four measurable dimensions:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Coverage (40%).</strong> How much of the program question surface your existing answers already address. High coverage means you can reuse strong answers instead of starting from scratch.</li>
              <li><strong className="text-neutral-900 dark:text-white">Theme alignment (35%).</strong> How well your profile&apos;s themes — market, stage, technology, mission — match the themes the program is known to evaluate and reward.</li>
              <li><strong className="text-neutral-900 dark:text-white">Criteria match (15%).</strong> How directly your answers map to the program&apos;s stated evaluation criteria, not just its questions.</li>
              <li><strong className="text-neutral-900 dark:text-white">Quality (10%).</strong> A signal from answer completeness — whether your answers are full, evidenced, and free of obvious gaps relative to the question&apos;s demands.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How fit scoring differs from admissions predictions</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              A fit score is not a prediction of acceptance. It does not estimate the probability that a program will admit, fund, or hire you. It tells you how prepared your current profile is relative to what the program measures — where you are strong, where you have gaps, and which programs are worth your drafting time. Admissions decisions depend on factors AQUA cannot see: the applicant pool, reviewer judgment, program capacity, and criteria that are never published. Fit scoring is decision-support for preparation, not a forecast of outcomes.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How AQUA computes fit scores</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              AQUA computes fit scores by comparing your answer bank and profile against a program&apos;s question surface — the full set of questions the program asks, weighted by their significance across the ecosystem. Smart Matcher performs the comparison, measuring coverage, theme alignment, criteria match, and completeness against your existing answers. The four dimensions are combined using the weights above to produce a single fit score for that program. Because the score is computed from your current answer bank, it updates as you add and improve answers — so fit is a living signal, not a static label.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about/scoring" className="btn-secondary">Scoring methodology</Link>
          <Link href="/concepts/smart-matcher" className="btn-secondary">Smart Matcher</Link>
          <Link href="/guides/how-to-compare-accelerator-fit" className="btn-secondary">Guide: Compare Fit</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
