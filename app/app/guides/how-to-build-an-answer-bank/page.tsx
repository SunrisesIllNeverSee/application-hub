import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, howTo } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'How to build an answer bank for applications — AQUA Application Hub',
  description:
    'Step-by-step guide to building an answer bank: collect existing answers, import with Appfeeder, organize by question type, tag themes, create variants, and improve over time.',
  alternates: { canonical: '/guides/how-to-build-an-answer-bank' },
}

const STEPS: { name: string; text: string }[] = [
  {
    name: 'Collect your existing application answers',
    text: 'Gather every application answer you have already written — for accelerators, fellowships, grants, jobs, or schools. Pull them from email drafts, Google Docs, submitted applications, and any spreadsheets you use to track responses. The goal is a complete inventory of the material you have already produced, because every past answer is a reusable asset for future applications.',
  },
  {
    name: 'Import them into AQUA or capture with Appfeeder',
    text: 'Import your collected answers into AQUA Application Hub. For answers still living on program websites or in browser sessions, use the Appfeeder browser extension to capture questions and draft answers directly from the source page. Appfeeder feeds captured content into your AQUA answer bank so nothing is lost to manual copy-paste or forgotten tabs.',
  },
  {
    name: 'Organize by question type',
    text: 'Group your answers by the underlying question type rather than by program. Most applications ask variations of the same recurring questions — team background, traction, market size, why this program, failure and resilience. Organizing by question type lets you see where you have strong material and where you have gaps, independent of any single program.',
  },
  {
    name: 'Tag with themes and criteria',
    text: 'Tag each answer with the themes and criteria it addresses — for example, technical depth, market understanding, leadership, resilience, or social impact. Thematic tagging is what makes Smart Matcher work: it compares your tagged answers against a program theme and criteria profile to measure alignment. The richer your tags, the more accurate your fit scores.',
  },
  {
    name: 'Create variants for different destinations',
    text: 'For each canonical answer, create variants tailored to the programs you are targeting. Adjust emphasis, length, and framing to match what each program measures. AQUA preserves the lineage between every variant and its parent canonical answer, so when you improve the source, every connected variant benefits. Never create a variant without keeping the link to its origin.',
  },
  {
    name: 'Review and improve over time',
    text: 'Your answer bank is a living asset, not a one-time import. After each application cycle, review your answers — update stale numbers, sharpen weak responses, and retire material that no longer reflects your current situation. Every improvement to a canonical answer propagates to all variants that depend on it, so incremental maintenance compounds across every future application.',
  },
]

export default function HowToBuildAnAnswerBankPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.guideBuildAnswerBank).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo(
          'How to build an answer bank for applications',
          'Step-by-step guide to building an answer bank: collect existing answers, import with Appfeeder, organize by question type, tag themes, create variants, and improve over time.',
          '/guides/how-to-build-an-answer-bank',
          STEPS,
        )).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/guides" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Guides</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Build an Answer Bank</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Guide</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">How to build an answer bank for applications</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Building an answer bank is the foundational workflow in AQUA Application Hub. An answer bank turns your scattered application responses into a structured, reusable asset that powers answer reuse, Smart Matcher, and fit scoring. This guide walks you through collecting existing answers, importing them into AQUA, organizing by question type, tagging with themes, creating variants, and improving your bank over time.
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
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer reuse concept</Link>
          <Link href="/concepts/application-graph" className="btn-secondary">Application graph concept</Link>
          <Link href="/developers" className="btn-secondary">Developer portal</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
