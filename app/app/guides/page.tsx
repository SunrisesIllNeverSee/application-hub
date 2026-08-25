import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Guides — AQUA Application Hub',
  description:
    'Step-by-step guides for reusing application answers, comparing accelerator fit, and building an answer bank.',
  alternates: { canonical: '/guides' },
}

const guides = [
  {
    href: '/guides/how-to-reuse-application-answers',
    title: 'How to reuse application answers',
    description:
      'Identify recurring questions, write canonical answers, create variants, and preserve lineage across programs.',
  },
  {
    href: '/guides/how-to-compare-accelerator-fit',
    title: 'How to compare accelerator fit',
    description:
      'Build your answer bank, run Smart Matcher against target programs, and compare fit scores to prioritize.',
  },
  {
    href: '/guides/how-to-build-an-answer-bank',
    title: 'How to build an answer bank for applications',
    description:
      'Collect existing answers, import them into AQUA, organize by question type, and tag with themes and criteria.',
  },
]

export default function GuidesIndexPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.guideReuseAnswers).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-neutral-900 dark:text-white">AQUA</Link>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-1">/</span>
            <span>Guides</span>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Guides</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
          Step-by-step guides for getting the most out of AQUA Application Hub.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {guides.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="block rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{g.description}</p>
              <span className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400">Read guide →</span>
            </Link>
          ))}
        </div>
        <div className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Related</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/concepts/answer-reuse" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Answer Reuse</Link>
            <Link href="/concepts/fit-score" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Fit Score</Link>
            <Link href="/concepts/smart-matcher" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Smart Matcher</Link>
            <Link href="/application-infrastructure" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Application Infrastructure Hub</Link>
            <Link href="/faq" className="text-sm text-blue-600 hover:underline dark:text-blue-400">FAQ</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
