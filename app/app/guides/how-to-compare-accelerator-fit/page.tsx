import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, howTo } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'How to compare accelerator fit — AQUA Application Hub',
  description:
    'Step-by-step guide to comparing accelerator fit for your startup: build your answer bank, run Smart Matcher, compare fit scores, and prioritize programs.',
  alternates: { canonical: '/guides/how-to-compare-accelerator-fit' },
}

const STEPS: { name: string; text: string }[] = [
  {
    name: 'Build your answer bank with existing material',
    text: 'Start by collecting the application answers you have already written — for accelerators, fellowships, grants, jobs, or any other opportunity. Import them into AQUA or capture new ones with the Appfeeder browser extension. Your answer bank is the foundation for every fit comparison, so the more complete and well-organized it is, the more accurate your fit scores will be.',
  },
  {
    name: 'Identify target programs in the Hub',
    text: 'Browse the AQUA Application Hub for programs relevant to your startup. The Hub ranks accelerators, fellowships, and grants by composite score — a combination of your personal fit and the program estimated value. Identify a shortlist of programs you want to evaluate, focusing on those whose themes and criteria align with your stage and sector.',
  },
  {
    name: 'Run Smart Matcher against each program',
    text: 'For every target program, run Smart Matcher to compare your current answer bank against that program question surface. Smart Matcher measures four dimensions: coverage of the program questions, theme alignment, criteria match, and answer completeness. The result is a fit score that tells you how prepared you are relative to what that program measures — not a prediction of acceptance.',
  },
  {
    name: 'Compare fit scores across programs',
    text: 'Lay out the fit scores from your target programs side by side. A higher fit score means your existing answers already cover more of what that program asks. Look for programs where coverage and theme alignment are both strong — those are the applications you can complete fastest and most confidently. Fit score is personal: it tells you where you are prepared, not how you compare to other applicants.',
  },
  {
    name: 'Identify coverage gaps before drafting',
    text: 'For each program, review the questions Smart Matcher flagged as uncovered or weak. These are the gaps you need to close before submitting. Prioritize gaps in high-significance questions — the ones that appear frequently across programs and carry the most weight. Filling a gap in a high-significance question improves your fit across multiple programs at once, not just the one you are targeting.',
  },
  {
    name: 'Prioritize programs where fit is strongest',
    text: 'Rank your shortlist by fit score and focus your drafting effort on the programs where you are already strongest. These are the applications with the highest return on effort — you have the most material ready and the fewest gaps to fill. Save programs with lower fit scores for later rounds, after you have strengthened the underlying answers that those programs depend on.',
  },
]

export default function HowToCompareAcceleratorFitPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.guideCompareFit).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo(
          'How to compare accelerator fit for your startup',
          'Step-by-step guide to comparing accelerator fit: build your answer bank, identify target programs, run Smart Matcher, compare fit scores, identify gaps, and prioritize programs.',
          '/guides/how-to-compare-accelerator-fit',
          STEPS,
        )).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/guides" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Guides</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Compare Accelerator Fit</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Guide</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">How to compare accelerator fit</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Comparing accelerator fit is a core workflow in AQUA Application Hub. Rather than treating each application as an isolated document, AQUA lets you measure how well your existing answer bank aligns to each program question surface. This guide walks you through building your answer bank, running Smart Matcher against target programs, comparing fit scores, and prioritizing where to apply.
          </p>
        </section>

        <section className="space-y-10">
          {STEPS.map((step, i) => (
            <div key={step.name} className="border-b border-neutral-200 pb-8 dark:border-neutral-800">
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                <span className="mr-3 text-brand-600 dark:text-brand-400">{i + 1}.</span>
                {step.name}
              </h2>
              <p className="leading-7 text-neutral-600 dark:text-neutral-300">
                {step.text}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/fit-score" className="btn-secondary">Fit score concept</Link>
          <Link href="/concepts/smart-matcher" className="btn-secondary">Smart Matcher concept</Link>
          <Link href="/about/scoring" className="btn-secondary">Scoring methodology</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
