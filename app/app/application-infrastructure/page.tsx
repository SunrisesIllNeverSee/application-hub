import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, itemList } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Application Infrastructure — Concepts, Guides, and Comparisons',
  description:
    'The AQUA application infrastructure hub: concepts, guides, and comparisons covering answer reuse, fit score, the application graph, answer lineage, and Smart Matcher.',
  alternates: { canonical: '/application-infrastructure' },
}

const CONCEPTS: { name: string; href: string; blurb: string }[] = [
  { name: 'Answer Reuse', href: '/concepts/answer-reuse', blurb: 'Treating questions and answers as reusable assets with variants kept connected to source material.' },
  { name: 'Fit Score', href: '/concepts/fit-score', blurb: 'How well your current profile aligns to a specific program across coverage, themes, criteria, and completeness.' },
  { name: 'Application Graph', href: '/concepts/application-graph', blurb: 'The data structure connecting questions, answers, applications, fit signals, and review loops.' },
  { name: 'Answer Lineage', href: '/concepts/answer-lineage', blurb: 'The connection between an answer variant and its source material, so updates propagate to affected variants.' },
  { name: 'Smart Matcher', href: '/concepts/smart-matcher', blurb: 'Compares your profile against a program question surface and identifies coverage gaps before drafting.' },
]

const GUIDES: { name: string; href: string; blurb: string }[] = [
  { name: 'Build an Answer Bank', href: '/guides/how-to-build-an-answer-bank', blurb: 'How to import or capture answers and structure them for reuse across programs.' },
  { name: 'Reuse Application Answers', href: '/guides/how-to-reuse-application-answers', blurb: 'How to adapt existing answers for a new program while preserving lineage.' },
  { name: 'Compare Accelerator Fit', href: '/guides/how-to-compare-accelerator-fit', blurb: 'How to use fit score and Smart Matcher to prioritize programs where you are already strong.' },
]

const COMPARISONS: { name: string; href: string; blurb: string }[] = [
  { name: 'AQUA vs FounderApp', href: '/vs/founderapp', blurb: 'Application graph and fit scoring versus universal profile autofill.' },
  { name: 'AQUA vs Manual Tracking', href: '/vs/manual-application-tracking', blurb: 'Structured answer bank and lineage versus spreadsheets, docs, and copy-paste.' },
  { name: 'AQUA vs Spreadsheets', href: '/vs/spreadsheets-for-applications', blurb: 'Graph structure and fit signals versus flat, manual application tracking.' },
]

const hubList = itemList(
  'AQUA Application Infrastructure — Concepts, Guides, and Comparisons',
  '/application-infrastructure',
  [
    { name: 'Answer Reuse', url: 'https://mos2es.xyz/concepts/answer-reuse' },
    { name: 'Fit Score', url: 'https://mos2es.xyz/concepts/fit-score' },
    { name: 'Application Graph', url: 'https://mos2es.xyz/concepts/application-graph' },
    { name: 'Answer Lineage', url: 'https://mos2es.xyz/concepts/answer-lineage' },
    { name: 'Smart Matcher', url: 'https://mos2es.xyz/concepts/smart-matcher' },
    { name: 'Build an Answer Bank', url: 'https://mos2es.xyz/guides/how-to-build-an-answer-bank' },
    { name: 'Reuse Application Answers', url: 'https://mos2es.xyz/guides/how-to-reuse-application-answers' },
    { name: 'Compare Accelerator Fit', url: 'https://mos2es.xyz/guides/how-to-compare-accelerator-fit' },
    { name: 'AQUA vs FounderApp', url: 'https://mos2es.xyz/vs/founderapp' },
    { name: 'AQUA vs Manual Tracking', url: 'https://mos2es.xyz/vs/manual-application-tracking' },
    { name: 'AQUA vs Spreadsheets', url: 'https://mos2es.xyz/vs/spreadsheets-for-applications' },
  ],
)

export default function ApplicationInfrastructurePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.applicationInfrastructure).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubList).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Application Infrastructure</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Topic hub</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">Application Infrastructure</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Application infrastructure is the layer that connects reusable answers, source lineage, fit signals, and review loops across many programs — accelerators, fellowships, grants, and jobs. This hub ties the AQUA content layer together: the concepts that define the model, the guides that show how to use it, and the comparisons that place it against alternatives.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Concepts</h2>
          <ul className="space-y-5">
            {CONCEPTS.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="group block">
                  <span className="text-lg font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                    {c.name}
                  </span>
                  <p className="mt-1 leading-7 text-neutral-600 dark:text-neutral-300">{c.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Guides</h2>
          <ul className="space-y-5">
            {GUIDES.map((g) => (
              <li key={g.href}>
                <Link href={g.href} className="group block">
                  <span className="text-lg font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                    {g.name}
                  </span>
                  <p className="mt-1 leading-7 text-neutral-600 dark:text-neutral-300">{g.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Comparisons</h2>
          <ul className="space-y-5">
            {COMPARISONS.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="group block">
                  <span className="text-lg font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                    {c.name}
                  </span>
                  <p className="mt-1 leading-7 text-neutral-600 dark:text-neutral-300">{c.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about" className="btn-secondary">About AQUA</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
