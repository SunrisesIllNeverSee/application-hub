import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, comparisonArticle } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA vs Spreadsheets for Applications',
  description:
    'AQUA Application Hub vs spreadsheets: graph structure, answer lineage, fit scoring, Smart Matcher, and MCP replace flat, manual application tracking.',
  alternates: { canonical: '/vs/spreadsheets-for-applications' },
}

const ROWS: { dimension: string; aqua: string; spreadsheets: string }[] = [
  {
    dimension: 'Data structure',
    aqua: 'Application graph linking questions, answers, applications, fit signals, and review loops.',
    spreadsheets: 'Flat rows and cells. No relationships between answers, programs, or evidence.',
  },
  {
    dimension: 'Answer lineage',
    aqua: 'Each variant traces back to its source answer and supporting evidence; updates propagate.',
    spreadsheets: 'No lineage. A pasted answer is a dead copy with no link to where it came from.',
  },
  {
    dimension: 'Coverage tracking',
    aqua: 'Smart Matcher measures how much of a program question surface you have already answered.',
    spreadsheets: 'Manual. You build a checklist column and update it by hand, if you remember.',
  },
  {
    dimension: 'Fit signals',
    aqua: 'Fit score combines coverage, theme alignment, criteria match, and answer completeness.',
    spreadsheets: 'No fit signal. You sort by deadline and guess fit by reading program pages.',
  },
  {
    dimension: 'Reuse across programs',
    aqua: 'One question surface shared across accelerators, fellowships, grants, and jobs.',
    spreadsheets: 'Copy-paste between sheets. Variants are not tracked and drift over time.',
  },
  {
    dimension: 'Opportunity matching',
    aqua: 'Smart Matcher ranks programs by how well your current profile aligns.',
    spreadsheets: 'No matching. You maintain a list of programs and decide priority manually.',
  },
  {
    dimension: 'Agent integration',
    aqua: 'Local MCP server exposes retrieval, ranking, review-context, stress-test, and write-back.',
    spreadsheets: 'No agent surface. Spreadsheets are human-operated and not programmable.',
  },
  {
    dimension: 'Evidence preservation',
    aqua: 'Source material stays connected to answers in the graph.',
    spreadsheets: 'Evidence lives in separate files or cells with no link to the answers it supports.',
  },
]

export default function VsSpreadsheetsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.vsSpreadsheets).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            comparisonArticle(
              'AQUA Application Hub vs Spreadsheets for Applications',
              'A comparison of AQUA Application Hub against spreadsheets for application tracking across graph structure, answer lineage, coverage tracking, fit signals, and agent integration.',
              '/vs/spreadsheets-for-applications',
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
          <span className="text-sm text-neutral-500 dark:text-neutral-400">AQUA vs Spreadsheets</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Comparison</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA Application Hub vs Spreadsheets for Applications</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Application infrastructure is a graph, not a grid. Spreadsheets are flat, manual, and lose the relationships between answers, programs, and evidence. AQUA Application Hub replaces that flat model with an application graph that carries lineage, fit scoring, Smart Matcher, and MCP integration. This comparison shows what you lose with spreadsheets and what AQUA keeps.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What spreadsheets lose</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            A spreadsheet can track deadlines and store pasted answers, but it has no concept of relationships. An answer pasted into a cell is a dead copy — it does not link back to the source answer or the evidence behind it. When you reuse that answer for a new program, there is no lineage to update, so improvements to the source never reach the variants. Coverage tracking becomes a manual checklist column, and fit is a guess based on reading program pages.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What the application graph keeps</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA stores questions, answers, applications, fit signals, and review loops as a connected graph. Answer lineage connects every variant to its source, so updating the source shows you which variants are affected. Smart Matcher measures how much of a program question surface you have already answered, and fit score combines coverage, theme alignment, criteria match, and answer completeness into a single signal per program. The local MCP server exposes all of this for agent-based workflows.
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
                  <th className="py-3 font-semibold text-neutral-900 dark:text-white">Spreadsheets</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.dimension} className="border-b border-neutral-200 dark:border-neutral-800">
                    <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">{row.dimension}</td>
                    <td className="py-3 pr-4 leading-6 text-neutral-600 dark:text-neutral-300">{row.aqua}</td>
                    <td className="py-3 leading-6 text-neutral-600 dark:text-neutral-300">{row.spreadsheets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">When to move off spreadsheets</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            A spreadsheet is enough for a single application with no reuse. Once you apply to multiple programs that ask variations of the same questions, the flat model costs you lineage, coverage tracking, and fit signals — the exact things that make reuse compound. AQUA is built for that repeated-application case.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/application-graph" className="btn-secondary">Application graph</Link>
          <Link href="/concepts/answer-lineage" className="btn-secondary">Answer lineage</Link>
          <Link href="/guides/how-to-build-an-answer-bank" className="btn-secondary">Build an answer bank</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
