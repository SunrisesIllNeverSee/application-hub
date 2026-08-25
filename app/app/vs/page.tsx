import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Comparisons — AQUA Application Hub',
  description:
    'Honest comparisons of AQUA Application Hub against FounderApp, manual tracking, and spreadsheets for application management.',
  alternates: { canonical: '/vs' },
}

const comparisons = [
  {
    href: '/vs/founderapp',
    title: 'AQUA vs FounderApp',
    description:
      'FounderApp is a universal profile autofill tool. AQUA adds lineage tracking, fit scoring, MCP integration, and an application graph.',
  },
  {
    href: '/vs/manual-application-tracking',
    title: 'AQUA vs Manual Application Tracking',
    description:
      'Manual tracking with spreadsheets and docs loses lineage, fit signals, and reuse across programs. AQUA structures it.',
  },
  {
    href: '/vs/spreadsheets-for-applications',
    title: 'AQUA vs Spreadsheets for Applications',
    description:
      'Spreadsheets are flat — no lineage, no coverage tracking, no fit scoring. AQUA is a graph with live scoring state.',
  },
]

export default function VsIndexPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.vsFounderApp).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-neutral-900 dark:text-white">AQUA</Link>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-1">/</span>
            <span>Comparisons</span>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Comparisons</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
          Honest comparisons of AQUA Application Hub against alternatives for application management.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {comparisons.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{c.description}</p>
              <span className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400">Read comparison →</span>
            </Link>
          ))}
        </div>
        <div className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Related</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/concepts/answer-reuse" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Answer Reuse</Link>
            <Link href="/concepts/answer-lineage" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Answer Lineage</Link>
            <Link href="/concepts/application-graph" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Application Graph</Link>
            <Link href="/application-infrastructure" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Application Infrastructure Hub</Link>
            <Link href="/faq" className="text-sm text-blue-600 hover:underline dark:text-blue-400">FAQ</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
