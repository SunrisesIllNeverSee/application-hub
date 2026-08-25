import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, comparisonArticle } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA vs Manual Application Tracking',
  description:
    'AQUA Application Hub vs manual tracking: structured answer bank, answer lineage, fit scoring, and Smart Matcher replace spreadsheets, docs, and copy-paste.',
  alternates: { canonical: '/vs/manual-application-tracking' },
}

const ROWS: { dimension: string; aqua: string; manual: string }[] = [
  {
    dimension: 'How answers are stored',
    aqua: 'Structured answer bank. Each answer is a reusable asset with variants and source material.',
    manual: 'Copy-pasted into docs, spreadsheets, or note apps. No canonical home; duplicates drift.',
  },
  {
    dimension: 'Time spent per application',
    aqua: 'Reuse surfaces the best existing answer for a new question; you adapt, not rewrite.',
    manual: 'Each application starts from a blank page or a prior doc you hunt down and re-paste.',
  },
  {
    dimension: 'Evidence preserved',
    aqua: 'Answer lineage connects every variant back to its source answer and supporting evidence.',
    manual: 'Evidence lives in your head or scattered files. Why an answer says what it says is lost.',
  },
  {
    dimension: 'Fit signals',
    aqua: 'Fit score combines coverage, theme alignment, criteria match, and answer completeness per program.',
    manual: 'No fit signal. You guess fit by reading the program page and comparing in your head.',
  },
  {
    dimension: 'Reuse across programs',
    aqua: 'One question surface shared across accelerators, fellowships, grants, and jobs.',
    manual: 'Each program is an isolated document; reuse is manual copy-paste with no connection.',
  },
  {
    dimension: 'Coverage tracking',
    aqua: 'Smart Matcher shows how much of a program question surface you have already answered.',
    manual: 'You track coverage manually, if at all, by skimming prior applications.',
  },
  {
    dimension: 'Review history',
    aqua: 'Persisted reviews and stress tests are attached to answers in the application graph.',
    manual: 'Review notes live in separate docs or are never written down.',
  },
  {
    dimension: 'Agent integration',
    aqua: 'Local MCP server exposes retrieval, ranking, review-context, stress-test, and write-back.',
    manual: 'No agent surface. Everything is human-operated copy-paste.',
  },
]

export default function VsManualTrackingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.vsManualTracking).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            comparisonArticle(
              'AQUA Application Hub vs Manual Application Tracking',
              'A comparison of AQUA Application Hub against manual application tracking with spreadsheets, docs, and copy-paste across time saved, evidence preserved, fit signals, and reuse.',
              '/vs/manual-application-tracking',
            ),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/vs" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Comparisons</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">AQUA vs Manual Tracking</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Comparison</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA Application Hub vs Manual Application Tracking</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Application infrastructure replaces the manual tracking most founders rely on — spreadsheets, docs, and copy-paste — with a structured answer bank, answer lineage, fit scoring, and Smart Matcher. This comparison shows what manual tracking costs you and what AQUA preserves instead.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What manual tracking looks like</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Manual application tracking usually means a spreadsheet of deadlines, a folder of past applications, and a habit of copying answers from one doc into the next form. It works for a few applications. It breaks down as the number of programs grows: answers drift, evidence disappears, and you can never tell how prepared you are for a new program without rereading everything.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What AQUA preserves</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA stores each answer as a reusable asset in a structured answer bank. When you adapt an answer for a new program, the variant keeps its lineage back to the source answer and its supporting evidence, so you always know why an answer says what it says. Fit scoring tells you how well your current profile aligns to a program, and Smart Matcher shows how much of a program question surface you have already answered before you draft.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The result is time saved per application, evidence that survives between applications, and fit signals that replace guesswork. Reviews and stress tests persist in the application graph instead of vanishing into separate docs.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Feature comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white">Dimension</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white">AQUA Application Hub</th>
                  <th className="py-3 font-semibold text-neutral-900 dark:text-white">Manual tracking</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.dimension} className="border-b border-neutral-200 dark:border-neutral-800">
                    <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">{row.dimension}</td>
                    <td className="py-3 pr-4 leading-6 text-neutral-600 dark:text-neutral-300">{row.aqua}</td>
                    <td className="py-3 leading-6 text-neutral-600 dark:text-neutral-300">{row.manual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">When the switch pays off</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            If you apply to one or two programs once, manual tracking is fine. If you apply to accelerators, fellowships, grants, and jobs repeatedly, the cost of lost evidence, duplicated effort, and invisible fit adds up fast. AQUA is built for the repeated-application case where reuse, lineage, and fit signals compound across programs.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer reuse</Link>
          <Link href="/guides/how-to-build-an-answer-bank" className="btn-secondary">Build an answer bank</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
