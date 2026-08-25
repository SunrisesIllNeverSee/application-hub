import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, definedTerm } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Application Graph — AQUA Application Hub',
  description:
    'A portable application graph is the data structure connecting applications, questions, answers, variants, and lineage so improving one answer benefits every program that touches it.',
  alternates: { canonical: '/concepts/application-graph' },
}

export default function ApplicationGraphPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.conceptApplicationGraph).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            definedTerm(
              'Application Graph',
              'The data structure that connects applications, questions, answers, variants, and reviews through typed edges representing lineage, coverage, and fit. Instead of treating each application as an isolated document, the graph links related questions and answers across programs so that improving one answer benefits all applications that touch the same underlying question.',
              '/concepts/application-graph',
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
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Application Graph</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Concept</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">What is a portable application graph?</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            A portable application graph is the data structure that connects your applications, questions, answers, variants, and reviews through typed edges representing lineage, coverage, and fit. Instead of treating each application as an isolated document, the graph links related questions and answers across programs so that improving one answer benefits every application that touches the same underlying question. AQUA Application Hub is built on a portable application graph — it is the substrate that makes answer reuse, fit scoring, and lineage tracking possible.
          </p>
        </section>

        <section className="space-y-12">
          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Nodes in the graph</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              The application graph is made up of several types of nodes, each representing a distinct unit of application infrastructure:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Applications.</strong> A specific submission to a specific program — the container that ties questions and answers to a destination.</li>
              <li><strong className="text-neutral-900 dark:text-white">Questions.</strong> The underlying prompts a program asks, normalized so that the same question asked different ways maps to one node.</li>
              <li><strong className="text-neutral-900 dark:text-white">Answers.</strong> Your strongest response to an underlying question, stored once and reused across programs.</li>
              <li><strong className="text-neutral-900 dark:text-white">Variants.</strong> Program-specific adaptations of a source answer, tuned for framing, word limits, and evaluation criteria.</li>
              <li><strong className="text-neutral-900 dark:text-white">Reviews.</strong> Feedback and review-loop records attached to answers or variants, preserving the history of how an answer evolved.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Edges in the graph</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              Nodes are connected by typed edges that carry meaning, not just references:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Lineage edges.</strong> Connect a variant back to its source answer and supporting evidence, so you can trace why an answer says what it says.</li>
              <li><strong className="text-neutral-900 dark:text-white">Coverage edges.</strong> Connect a program&apos;s question surface to the answers in your bank that address each question, powering fit scoring.</li>
              <li><strong className="text-neutral-900 dark:text-white">Fit edges.</strong> Connect your profile to a program through computed fit signals, so the graph carries live scoring state, not just static content.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Why portability matters</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              Most application tools treat each submission as a standalone document. When you improve an answer for one program, that improvement is trapped inside that application. A portable application graph breaks that isolation: because answers, questions, and lineage are shared across programs, an improvement to a source answer propagates to every variant and application that depends on it. Portability also means the graph is not tied to a single program&apos;s format — it follows you across accelerators, fellowships, grants, and jobs, accumulating value as your application infrastructure grows.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How AQUA implements the application graph</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              AQUA stores the application graph as the core data model behind its answer bank, Smart Matcher, and scoring engine. Questions are normalized to underlying prompts so reuse is automatic. Answers are linked to variants through lineage edges, and coverage edges connect your answer bank to each program&apos;s question surface for fit computation. The graph is queryable through the web application and, for power users, through the local MCP server — so agents can retrieve answers, trace lineage, and write back improvements without leaving the graph model.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer Reuse</Link>
          <Link href="/concepts/answer-lineage" className="btn-secondary">Answer Lineage</Link>
          <Link href="/about" className="btn-secondary">About AQUA</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
