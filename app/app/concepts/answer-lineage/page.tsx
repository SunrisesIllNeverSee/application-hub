import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, definedTerm } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Answer Lineage — AQUA Application Hub',
  description:
    'Answer lineage tracks each answer variant back to its source material, so you can trace why an answer says what it says, update the source, and see which variants are affected.',
  alternates: { canonical: '/concepts/answer-lineage' },
}

export default function AnswerLineagePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.conceptAnswerLineage).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            definedTerm(
              'Answer Lineage',
              'The connection between an answer variant and its source material. When you create a variant of an answer for a different program, lineage tracks the relationship back to the original answer and its supporting evidence, enabling traceability, update propagation, and evidence preservation across the application graph.',
              '/concepts/answer-lineage',
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
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Answer Lineage</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Concept</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">What is answer lineage?</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Answer lineage is the connection between an answer variant and its source material. When you create a variant of an answer for a different program, lineage tracks the relationship back to the original answer and its supporting evidence. This means you can trace why an answer says what it says, update the source, and see which variants are affected. AQUA Application Hub preserves lineage as a first-class edge in the application graph, so every adapted answer stays connected to the material that produced it.
          </p>
        </section>

        <section className="space-y-12">
          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Source-variant relationships</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              A source answer is your strongest, most complete response to an underlying question — the version backed by evidence, refined over time, and intended to be reused. A variant is a program-specific adaptation of that source: tuned for framing, word limits, and evaluation criteria, but carrying the same core substance. Lineage is the typed edge that connects a variant back to its source. One source can have many variants, each tailored to a different destination, and every variant knows exactly where it came from.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Why lineage matters</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              Lineage solves three problems that isolated answer storage cannot:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Traceability.</strong> When a reviewer asks why your answer makes a specific claim, lineage lets you point back to the source answer and the evidence behind it — not just the adapted variant you submitted.</li>
              <li><strong className="text-neutral-900 dark:text-white">Update propagation.</strong> When you improve a source answer — new data, sharper framing, corrected fact — lineage tells you which variants are affected so you can update them consistently instead of hunting through past applications.</li>
              <li><strong className="text-neutral-900 dark:text-white">Evidence preservation.</strong> The supporting material that makes an answer strong is attached to the source, not duplicated into every variant. Lineage keeps evidence in one place while letting every variant reference it.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How AQUA implements answer lineage</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              AQUA stores lineage as typed edges in the application graph. When you create a variant from a source answer, AQUA records the relationship automatically — you do not have to manually link them. The source answer carries the supporting evidence and the canonical framing; each variant carries only its program-specific deltas. When a source is updated, AQUA can surface the variants that depend on it, so you can review and refresh adapted answers in one pass. Lineage is queryable through the web application and through the local MCP server, so agents can trace an answer back to its source and evidence without leaving the graph model.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer Reuse</Link>
          <Link href="/concepts/application-graph" className="btn-secondary">Application Graph</Link>
          <Link href="/about" className="btn-secondary">About AQUA</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
